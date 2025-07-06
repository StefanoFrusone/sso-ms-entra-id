import { useState, useEffect } from "react";
import { User, Shield, LogOut, Loader2 } from "lucide-react";

const App = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Configurazione Microsoft Entra ID
  const CLIENT_ID = import.meta.env.VITE_CLIENT_ID || "your-client-id";
  const TENANT_ID = import.meta.env.VITE_TENANT_ID || "your-tenant-id";
  const REDIRECT_URI =
    import.meta.env.VITE_REDIRECT_URI || "http://localhost:3000";
  const API_BASE_URL =
    import.meta.env.VITE_API_BASE_URL || "http://localhost:3001";
  const SCOPE = "openid profile email User.Read";

  // Funzioni per PKCE (Proof Key for Code Exchange)
  const generateCodeVerifier = () => {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return btoa(String.fromCharCode.apply(null, Array.from(array)))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=/g, "");
  };

  const generateCodeChallenge = async (verifier) => {
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    const digest = await crypto.subtle.digest("SHA-256", data);
    return btoa(
      String.fromCharCode.apply(null, Array.from(new Uint8Array(digest)))
    )
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=/g, "");
  };

  const generateState = () => {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  };

  // Verifica token all'avvio e gestisci logout callback
  useEffect(() => {
    // Controlla se stiamo tornando da un logout
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has("logout")) {
      // Pulizia completa dopo logout Microsoft
      localStorage.clear();
      sessionStorage.clear();
      setIsAuthenticated(false);
      setUser(null);
      setError("");
      // Pulisci URL
      window.history.replaceState({}, document.title, window.location.pathname);
      setLoading(false);
      return;
    }

    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const token = localStorage.getItem("access_token");

      if (!token) {
        setLoading(false);
        return;
      }

      // Verifica token direttamente con Microsoft Graph
      const response = await fetch("https://graph.microsoft.com/v1.0/me", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const userData = await response.json();
        const user = {
          sub: userData.id,
          given_name: userData.givenName,
          family_name: userData.surname,
          email: userData.mail || userData.userPrincipalName,
          name: userData.displayName,
        };
        setUser(user);
        setIsAuthenticated(true);
      } else {
        // Token non valido, prova il refresh se disponibile
        const refreshToken = localStorage.getItem("refresh_token");
        if (refreshToken) {
          await refreshAccessToken(refreshToken);
        } else {
          // Nessun refresh token, fai logout
          localStorage.removeItem("access_token");
          localStorage.removeItem("refresh_token");
        }
      }
    } catch (error) {
      console.error("Errore verifica autenticazione:", error);
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
    } finally {
      setLoading(false);
    }
  };

  const refreshAccessToken = async (refreshToken) => {
    if (!refreshToken) {
      return false;
    }

    try {
      const tokenData = {
        client_id: CLIENT_ID,
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        scope: SCOPE,
      };

      const response = await fetch(
        `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams(tokenData),
        }
      );

      if (response.ok) {
        const { access_token, refresh_token: newRefreshToken } =
          await response.json();
        localStorage.setItem("access_token", access_token);
        if (newRefreshToken) {
          localStorage.setItem("refresh_token", newRefreshToken);
        }

        console.log("Token refreshato con successo");
        return true;
      } else {
        console.error("Errore refresh token:", await response.text());
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
        return false;
      }
    } catch (error) {
      console.error("Errore refresh token:", error);
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
      return false;
    }
  };

  // Funzione per chiamate API con refresh automatico
  const apiCall = async (url, options = {}) => {
    const token = localStorage.getItem("access_token");

    if (!token) {
      throw new Error("Nessun token disponibile");
    }

    // Prima tentativo con token corrente
    let response = await fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        Authorization: `Bearer ${token}`,
      },
    });

    // Se token scaduto, prova il refresh
    if (response.status === 401 || response.status === 403) {
      console.log("Token scaduto, tentativo refresh...");

      const refreshSuccess = await refreshAccessToken(
        localStorage.getItem("refresh_token")
      );

      if (refreshSuccess) {
        // Riprova la chiamata con il nuovo token
        const newToken = localStorage.getItem("access_token");
        response = await fetch(url, {
          ...options,
          headers: {
            ...options.headers,
            Authorization: `Bearer ${newToken}`,
          },
        });
      } else {
        // Refresh fallito, redirect al login
        handleLogout();
        throw new Error("Sessione scaduta, effettua nuovamente il login");
      }
    }

    return response;
  };

  // Esempio di utilizzo delle API protette
  const callProtectedAPI = async () => {
    try {
      setLoading(true);

      const response = await apiCall(`${API_BASE_URL}/api/protected`);

      if (response.ok) {
        const data = await response.json();
        console.log("Dati ricevuti:", data);
        // Gestisci i dati ricevuti
      } else {
        throw new Error("Errore nella chiamata API");
      }
    } catch (error) {
      console.error("Errore API:", error);
      setError("Errore nel caricamento dei dati: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    try {
      // Genera PKCE parameters
      const codeVerifier = generateCodeVerifier();
      const codeChallenge = await generateCodeChallenge(codeVerifier);
      const state = generateState();

      // Salva i parametri PKCE per il callback
      sessionStorage.setItem("code_verifier", codeVerifier);
      sessionStorage.setItem("auth_state", state);

      // Costruisci URL di autorizzazione con PKCE
      const authUrl =
        `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/authorize?` +
        `client_id=${CLIENT_ID}&` +
        `response_type=code&` +
        `redirect_uri=${encodeURIComponent(REDIRECT_URI)}&` +
        `scope=${encodeURIComponent(SCOPE)}&` +
        `response_mode=query&` +
        `code_challenge=${codeChallenge}&` +
        `code_challenge_method=S256&` +
        `state=${state}`;

      window.location.href = authUrl;
    } catch (error) {
      console.error("Errore durante la generazione PKCE:", error);
      setError("Errore durante l'inizializzazione del login");
    }
  };

  // Logout rapido (solo locale, senza Microsoft)
  const handleQuickLogout = () => {
    setIsAuthenticated(false);
    setUser(null);
    setError("");
    localStorage.clear();
    sessionStorage.clear();
    // Resta sulla stessa pagina, mostra login
  };

  const handleLogout = async () => {
    try {
      // 1. Pulisci stato locale immediatamente
      setIsAuthenticated(false);
      setUser(null);
      setError("");

      // 2. Rimuovi token dal localStorage
      const token = localStorage.getItem("access_token");
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");

      // 3. Pulisci anche sessionStorage (PKCE remnants)
      sessionStorage.removeItem("code_verifier");
      sessionStorage.removeItem("auth_state");

      // 4. Opzionale: Revoca il token lato Microsoft (se supportato)
      if (token) {
        try {
          await fetch(
            `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/logout`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/x-www-form-urlencoded",
              },
              body: new URLSearchParams({
                token: token,
                token_type_hint: "access_token",
              }),
            }
          );
        } catch (revokeError) {
          console.warn("Errore revoca token:", revokeError);
          // Non bloccare il logout se la revoca fallisce
        }
      }

      // 5. Logout completo da Microsoft (redirect)
      const logoutUrl =
        `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/logout?` +
        `post_logout_redirect_uri=${encodeURIComponent(
          REDIRECT_URI + "?logout=true"
        )}`;

      // Piccolo delay per permettere al cleanup di completarsi
      setTimeout(() => {
        window.location.href = logoutUrl;
      }, 100);
    } catch (error) {
      console.error("Errore durante logout:", error);

      // Anche se c'è un errore, forza il logout locale
      handleQuickLogout();
    }
  };

  // Gestione callback di autenticazione
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get("code");
    const state = urlParams.get("state");
    const error = urlParams.get("error");

    if (error) {
      setError(`Errore di autenticazione: ${error}`);
      setLoading(false);
      return;
    }

    if (code && !isAuthenticated) {
      // Verifica state per prevenire CSRF attacks
      const savedState = sessionStorage.getItem("auth_state");
      if (state !== savedState) {
        setError("Errore di sicurezza: state non valido");
        setLoading(false);
        return;
      }

      handleAuthCallback(code);
    }
  }, []);

  const handleAuthCallback = async (code) => {
    try {
      setLoading(true);
      setError("");

      // Recupera code_verifier dal sessionStorage
      const codeVerifier = sessionStorage.getItem("code_verifier");
      if (!codeVerifier) {
        throw new Error("Code verifier non trovato");
      }

      // Il FRONTEND scambia il code con i token direttamente con Microsoft
      const tokenData = {
        client_id: CLIENT_ID,
        code: code,
        grant_type: "authorization_code",
        redirect_uri: REDIRECT_URI,
        code_verifier: codeVerifier,
      };

      const tokenResponse = await fetch(
        `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams(tokenData),
        }
      );

      if (!tokenResponse.ok) {
        const errorData = await tokenResponse.json();
        throw new Error(errorData.error_description || "Errore token exchange");
      }

      const { access_token, refresh_token } = await tokenResponse.json();

      // Ottieni informazioni utente da Microsoft Graph
      const userResponse = await fetch("https://graph.microsoft.com/v1.0/me", {
        headers: {
          Authorization: `Bearer ${access_token}`,
        },
      });

      if (!userResponse.ok) {
        throw new Error("Errore nel recupero informazioni utente");
      }

      const userData = await userResponse.json();

      // Salva token e user data
      localStorage.setItem("access_token", access_token);
      if (refresh_token) {
        localStorage.setItem("refresh_token", refresh_token);
      }

      const user = {
        sub: userData.id,
        given_name: userData.givenName,
        family_name: userData.surname,
        email: userData.mail || userData.userPrincipalName,
        name: userData.displayName,
      };

      setUser(user);
      setIsAuthenticated(true);

      // Pulisci sessionStorage e URL
      sessionStorage.removeItem("code_verifier");
      sessionStorage.removeItem("auth_state");
      window.history.replaceState({}, document.title, window.location.pathname);
    } catch (error) {
      console.error("Errore callback:", error);
      setError("Errore durante l'autenticazione: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Caricamento...</p>
        </div>
      </div>
    );
  }

  if (isAuthenticated && user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100">
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-md mx-auto bg-white rounded-xl shadow-lg p-6">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <User className="w-8 h-8 text-green-600" />
              </div>
              <h1 className="text-2xl font-bold text-gray-800 mb-2">
                Benvenuto/a!
              </h1>
              <p className="text-gray-600">
                Ciao{" "}
                <strong>
                  {user.given_name} {user.family_name}
                </strong>
              </p>
              <p className="text-sm text-gray-500 mt-2">{user.email}</p>
            </div>

            <div className="space-y-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-semibold text-gray-800 mb-2">
                  Informazioni Account
                </h3>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="font-medium">Nome:</span> {user.given_name}
                  </div>
                  <div>
                    <span className="font-medium">Cognome:</span>{" "}
                    {user.family_name}
                  </div>
                  <div>
                    <span className="font-medium">Email:</span> {user.email}
                  </div>
                  <div>
                    <span className="font-medium">ID Utente:</span> {user.sub}
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 rounded-lg p-4">
                <h3 className="font-semibold text-gray-800 mb-3">
                  Test API Protette
                </h3>
                <button
                  onClick={callProtectedAPI}
                  disabled={loading}
                  className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Caricamento...
                    </>
                  ) : (
                    "Testa API Protetta"
                  )}
                </button>
                <p className="text-xs text-gray-600 mt-2">
                  Questo pulsante testa il refresh automatico dei token
                </p>
              </div>

              <button
                onClick={handleLogout}
                className="w-full bg-red-600 text-white py-3 px-4 rounded-lg hover:bg-red-700 transition-colors flex items-center justify-center gap-2"
              >
                <LogOut className="w-5 h-5" />
                Disconnetti
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
      <div className="max-w-md w-full mx-4">
        <div className="bg-white rounded-xl shadow-lg p-8">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Shield className="w-8 h-8 text-blue-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-800 mb-2">
              Accesso Aziendale
            </h1>
            <p className="text-gray-600">
              Effettua l'accesso con il tuo account Microsoft
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}

          <button
            onClick={handleLogin}
            className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 font-medium"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
            </svg>
            Accedi con Microsoft
          </button>

          <div className="mt-6 text-center">
            <p className="text-xs text-gray-500">
              Utilizzando questo servizio accetti i termini e condizioni
              aziendali
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
