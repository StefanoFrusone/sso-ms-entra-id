// Configurazione Microsoft Entra ID
const CLIENT_ID = import.meta.env.VITE_CLIENT_ID || "your-client-id";
const TENANT_ID = import.meta.env.VITE_TENANT_ID || "your-tenant-id";
const REDIRECT_URI =
  import.meta.env.VITE_REDIRECT_URI || "http://localhost:3000";
const SCOPE = "openid profile email User.Read";

/**
 * Servizio di autenticazione con Microsoft Entra ID
 * Gestisce il flusso OAuth 2.0 + PKCE
 */
class AuthService {
  /**
   * Genera un code verifier random per PKCE
   */
  generateCodeVerifier() {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return btoa(String.fromCharCode.apply(null, Array.from(array)))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=/g, "");
  }

  /**
   * Genera il code challenge da un code verifier (SHA-256)
   */
  async generateCodeChallenge(verifier) {
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    const digest = await crypto.subtle.digest("SHA-256", data);
    return btoa(
      String.fromCharCode.apply(null, Array.from(new Uint8Array(digest)))
    )
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=/g, "");
  }

  /**
   * Genera uno state random per protezione CSRF
   */
  generateState() {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  }

  /**
   * Inizia il flusso di login OAuth con Microsoft
   */
  async initiateLogin() {
    try {
      // Genera parametri PKCE
      const codeVerifier = this.generateCodeVerifier();
      const codeChallenge = await this.generateCodeChallenge(codeVerifier);
      const state = this.generateState();

      // Salva in sessionStorage per il callback
      sessionStorage.setItem("code_verifier", codeVerifier);
      sessionStorage.setItem("auth_state", state);

      // Costruisci URL di autorizzazione
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

      // Redirect a Microsoft
      window.location.href = authUrl;
    } catch (error) {
      console.error("Errore durante la generazione PKCE:", error);
      throw new Error("Errore durante l'inizializzazione del login");
    }
  }

  /**
   * Gestisce il callback di autenticazione dopo il redirect da Microsoft
   */
  async handleAuthCallback(code) {
    try {
      // Recupera code_verifier
      const codeVerifier = sessionStorage.getItem("code_verifier");
      if (!codeVerifier) {
        throw new Error("Code verifier non trovato");
      }

      // Scambia il code con i token
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

      // Ottieni dati utente da Microsoft Graph
      const userResponse = await fetch("https://graph.microsoft.com/v1.0/me", {
        headers: {
          Authorization: `Bearer ${access_token}`,
        },
      });

      if (!userResponse.ok) {
        throw new Error("Errore nel recupero informazioni utente");
      }

      const userData = await userResponse.json();

      // Salva token
      localStorage.setItem("access_token", access_token);
      if (refresh_token) {
        localStorage.setItem("refresh_token", refresh_token);
      }

      // Crea oggetto user normalizzato
      const user = {
        sub: userData.id,
        given_name: userData.givenName,
        family_name: userData.surname,
        email: userData.mail || userData.userPrincipalName,
        name: userData.displayName,
      };

      // Pulisci sessionStorage
      sessionStorage.removeItem("code_verifier");
      sessionStorage.removeItem("auth_state");

      // Pulisci URL
      window.history.replaceState({}, document.title, window.location.pathname);

      return { user };
    } catch (error) {
      console.error("Errore callback:", error);
      throw error;
    }
  }

  /**
   * Valida un token chiamando Microsoft Graph
   */
  async validateToken(token) {
    const response = await fetch("https://graph.microsoft.com/v1.0/me", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error("Token non valido");
    }

    const userData = await response.json();
    return {
      sub: userData.id,
      given_name: userData.givenName,
      family_name: userData.surname,
      email: userData.mail || userData.userPrincipalName,
      name: userData.displayName,
    };
  }

  /**
   * Refresh dell'access token usando il refresh token
   */
  async refreshToken(refreshToken) {
    if (!refreshToken) {
      throw new Error("Refresh token non disponibile");
    }

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

    if (!response.ok) {
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
      throw new Error("Errore refresh token");
    }

    const { access_token, refresh_token: newRefreshToken } =
      await response.json();

    localStorage.setItem("access_token", access_token);
    if (newRefreshToken) {
      localStorage.setItem("refresh_token", newRefreshToken);
    }

    console.log("Token refreshato con successo");
    return access_token;
  }

  /**
   * Logout completo con Microsoft
   */
  async logout() {
    try {
      // Pulisci stato locale
      const token = localStorage.getItem("access_token");
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
      sessionStorage.removeItem("code_verifier");
      sessionStorage.removeItem("auth_state");

      // Opzionale: revoca token
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
        }
      }

      // Redirect a Microsoft per logout SSO
      const logoutUrl =
        `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/logout?` +
        `post_logout_redirect_uri=${encodeURIComponent(
          REDIRECT_URI + "?logout=true"
        )}`;

      setTimeout(() => {
        window.location.href = logoutUrl;
      }, 100);
    } catch (error) {
      console.error("Errore durante logout:", error);
      throw error;
    }
  }

  /**
   * Logout rapido (solo locale, senza Microsoft)
   */
  quickLogout() {
    localStorage.clear();
    sessionStorage.clear();
  }

  /**
   * Verifica se stiamo tornando da un logout
   */
  isReturningFromLogout() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.has("logout");
  }

  /**
   * Verifica state per protezione CSRF
   */
  verifyState(receivedState) {
    const savedState = sessionStorage.getItem("auth_state");
    return receivedState === savedState;
  }
}

export const authService = new AuthService();
