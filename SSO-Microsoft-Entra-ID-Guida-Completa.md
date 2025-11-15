# Guida Completa: SSO con Microsoft Entra ID (OAuth 2.0 + PKCE)

## Indice
- [Introduzione](#introduzione)
- [Architettura Generale](#architettura-generale)
- [Flusso End-to-End](#flusso-end-to-end)
  - [Fase 1: Avvio Applicazione](#-fase-1-avvio-applicazione)
  - [Fase 2: Login dell'Utente](#-fase-2-login-dellutente)
  - [Fase 3: Autenticazione su Microsoft](#-fase-3-autenticazione-su-microsoft)
  - [Fase 4: Callback da Microsoft](#-fase-4-callback-da-microsoft)
  - [Fase 5: Scambio Code → Token](#-fase-5-scambio-code--token)
  - [Fase 6: Recupero Dati Utente](#-fase-6-recupero-dati-utente)
  - [Fase 7: Utente Autenticato](#-fase-7-utente-autenticato)
  - [Fase 8: Chiamata API Protette](#-fase-8-chiamata-api-protette)
  - [Fase 9: Refresh Token](#-fase-9-refresh-token-se-scaduto)
  - [Fase 10: Logout](#-fase-10-logout)
- [Componenti di Sicurezza](#componenti-di-sicurezza)
- [Configurazione](#configurazione)
- [Diagramma di Sequenza](#diagramma-di-sequenza)

---

## Introduzione

Questo documento descrive nel dettaglio il funzionamento di un sistema di **Single Sign-On (SSO)** implementato con **Microsoft Entra ID** (precedentemente Azure Active Directory) utilizzando il protocollo **OAuth 2.0** con estensione **PKCE** (Proof Key for Code Exchange).

### Caratteristiche Principali

- ✅ **OAuth 2.0 Authorization Code Flow** con PKCE
- ✅ **Nessun Client Secret** nel frontend (sicurezza migliorata)
- ✅ **Refresh Token** automatico per sessioni prolungate
- ✅ **JWT Validation** lato backend
- ✅ **Protezione CSRF** con State parameter
- ✅ **Single Logout** con Microsoft

---

## Architettura Generale

Il sistema è composto da tre attori principali:

```
┌─────────────┐         ┌──────────────────┐         ┌─────────────┐
│  Frontend   │ ◄─────► │  Microsoft       │ ◄─────► │   Backend   │
│  (React)    │         │  Entra ID        │         │  (Express)  │
└─────────────┘         └──────────────────┘         └─────────────┘
```

### Responsabilità

**Frontend (React)**:
- Gestisce il flusso OAuth 2.0 + PKCE
- Genera e verifica parametri di sicurezza
- Effettua token exchange con Microsoft
- Salva token in localStorage
- Gestisce refresh automatico dei token
- Invia token nelle chiamate API

**Microsoft Entra ID**:
- Autentica l'utente (credenziali aziendali)
- Rilascia authorization code
- Fornisce access_token e refresh_token
- Espone Microsoft Graph API per dati utente
- Gestisce il logout SSO

**Backend (Node.js/Express)**:
- Valida i JWT token ricevuti dal frontend
- Verifica firme con chiavi pubbliche Microsoft
- Protegge le API aziendali
- Implementa logica di autorizzazione custom

---

## Flusso End-to-End

---

## 🚀 FASE 1: AVVIO APPLICAZIONE

### Step 1.1: Caricamento iniziale della pagina

Quando l'applicazione React viene caricata per la prima volta, viene eseguito un `useEffect` che controlla lo stato di autenticazione:

```javascript
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
    window.history.replaceState({}, document.title, window.location.pathname);
    setLoading(false);
    return;
  }

  checkAuthStatus();
}, []);
```

**Cosa controlla**:
1. **Parametro `?logout=true`**: indica ritorno da logout Microsoft
2. **Parametro `?code=xxx`**: indica ritorno da autenticazione Microsoft
3. **Nessun parametro**: controlla se esiste un token salvato

### Step 1.2: Verifica token esistente

La funzione `checkAuthStatus()` cerca un token salvato in precedenza:

```javascript
const checkAuthStatus = async () => {
  try {
    const token = localStorage.getItem("access_token");

    if (!token) {
      setLoading(false);
      return; // Nessun token → mostra schermata login
    }

    // Verifica token direttamente con Microsoft Graph
    const response = await fetch("https://graph.microsoft.com/v1.0/me", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (response.ok) {
      // Token valido → carica dati utente
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
      // Token non valido → prova refresh
      const refreshToken = localStorage.getItem("refresh_token");
      if (refreshToken) {
        await refreshAccessToken(refreshToken);
      } else {
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
```

**Possibili scenari**:
- ❌ **Nessun token**: mostra schermata di login
- ✅ **Token valido**: mostra dashboard utente
- 🔄 **Token scaduto**: prova refresh token
- ❌ **Refresh fallito**: mostra schermata di login

---

## 🔐 FASE 2: LOGIN DELL'UTENTE

### Step 2.1: Click su "Accedi con Microsoft"

L'utente vede la schermata di login e clicca sul pulsante:

```javascript
<button onClick={handleLogin}>
  Accedi con Microsoft
</button>
```

### Step 2.2: Generazione parametri PKCE

**PKCE** (Proof Key for Code Exchange) è un'estensione di sicurezza per OAuth 2.0 che protegge da attacchi di intercettazione.

#### Generazione Code Verifier

```javascript
const generateCodeVerifier = () => {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode.apply(null, Array.from(array)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
};
```

**Esempio output**:
```
kAj9dP3mR8sT4vW7xY2zB5cE6fG1hI0jK3lM4nO5pQ6rS7tU8vW9xY0zA1bC2
```

Questa è una stringa random di 43 caratteri, codificata in Base64 URL-safe (senza `+`, `/`, `=`).

#### Generazione Code Challenge

```javascript
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
```

**Esempio output**:
```
E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM
```

Questo è l'hash SHA-256 del Code Verifier.

**Perché PKCE è sicuro?**
- Microsoft riceverà solo il **Code Challenge** (hash)
- Il **Code Verifier** (originale) rimane nel client
- Quando torneremo con il code, dovremo fornire il verifier
- Microsoft ricalcolerà l'hash e lo confronterà
- Se qualcuno intercetta il code, non può usarlo senza il verifier

### Step 2.3: Generazione State (protezione CSRF)

```javascript
const generateState = () => {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
};
```

**Esempio output**:
```
k7m3p9q2r5t8w1x4y7z0a3b6c9d2e5f8
```

**Perché serve lo State?**
- Protegge da attacchi **CSRF** (Cross-Site Request Forgery)
- Quando Microsoft ci rimanderà indietro, verificheremo che lo state sia identico
- Se qualcuno prova a falsificare la risposta, lo state non corrisponderà

### Step 2.4: Salvataggio in sessionStorage

```javascript
sessionStorage.setItem("code_verifier", codeVerifier);
sessionStorage.setItem("auth_state", state);
```

**Nota importante**: usa `sessionStorage` (non `localStorage`) perché:
- Questi dati servono solo per questo flusso di login
- Vengono cancellati quando si chiude il tab
- Non persistono tra le sessioni

### Step 2.5: Costruzione URL di autorizzazione Microsoft

```javascript
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
```

**Esempio URL completo**:
```
https://login.microsoftonline.com/abc123-tenant-id/oauth2/v2.0/authorize?
  client_id=xyz789-client-id&
  response_type=code&
  redirect_uri=http://localhost:3000&
  scope=openid%20profile%20email%20User.Read&
  response_mode=query&
  code_challenge=E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM&
  code_challenge_method=S256&
  state=k7m3p9q2r5t8w1x4y7z0a3b6c9d2e5f8
```

**Parametri spiegati**:

| Parametro | Valore | Descrizione |
|-----------|--------|-------------|
| `client_id` | ID della tua app | Registrato in Entra ID |
| `response_type` | `code` | Richiede un authorization code |
| `redirect_uri` | `http://localhost:3000` | Dove Microsoft ti rimanderà |
| `scope` | `openid profile email User.Read` | Permessi richiesti |
| `response_mode` | `query` | Parametri nell'URL query string |
| `code_challenge` | Hash SHA-256 | Per PKCE |
| `code_challenge_method` | `S256` | Metodo hash (SHA-256) |
| `state` | Stringa random | Protezione CSRF |

### Step 2.6: Redirect a Microsoft

```javascript
window.location.href = authUrl;
```

**L'utente esce dalla tua applicazione** e viene portato sulla pagina di login di Microsoft.

---

## 🌐 FASE 3: AUTENTICAZIONE SU MICROSOFT

### Step 3.1: Pagina login Microsoft

L'utente vede la schermata di login aziendale Microsoft:

```
┌────────────────────────────────────┐
│  Microsoft                          │
│                                     │
│  Accedi al tuo account              │
│                                     │
│  Email: [mario.rossi@azienda.com ]  │
│                                     │
│  Password: [********************]   │
│                                     │
│  [Accedi]                           │
└────────────────────────────────────┘
```

**Cosa inserisce**:
1. Email aziendale (es: `mario.rossi@tuaazienda.com`)
2. Password aziendale
3. Eventualmente 2FA/MFA se configurato (SMS, app Authenticator, etc.)

### Step 3.2: Consenso permessi (solo prima volta)

Se è la prima volta che l'utente usa questa applicazione, Microsoft chiede il consenso:

```
┌────────────────────────────────────────────┐
│  App "XYZ" richiede l'autorizzazione per:  │
│                                             │
│  ✓ Visualizzare il tuo profilo di base     │
│  ✓ Leggere il tuo indirizzo email          │
│  ✓ Accedere ai tuoi dati utente            │
│                                             │
│  [Accetta]  [Rifiuta]                      │
└────────────────────────────────────────────┘
```

**Scope richiesti**:
- `openid`: identità base
- `profile`: nome, cognome
- `email`: indirizzo email
- `User.Read`: lettura profilo Microsoft Graph

### Step 3.3: Microsoft genera il code

Dopo login riuscito e consenso dato, Microsoft:

1. **Salva il Code Challenge** associato a questa richiesta
2. **Genera un authorization code** temporaneo (es: `0.AXcA...lungo_codice`)
   - Validità: ~10 minuti
   - Usa una volta sola (one-time use)
3. **Prepara il redirect** verso il tuo `redirect_uri`

### Step 3.4: Verifica lato Microsoft

Internamente, Microsoft:
- ✅ Verifica che `client_id` sia registrato
- ✅ Verifica che `redirect_uri` sia autorizzato
- ✅ Verifica che `code_challenge_method` sia supportato
- ✅ Salva il `code_challenge` per la validazione futura
- ✅ Associa il code all'utente autenticato

---

## 🔄 FASE 4: CALLBACK DA MICROSOFT

### Step 4.1: Redirect alla tua applicazione

Microsoft redirige l'utente al tuo `redirect_uri` con i parametri:

```
http://localhost:3000/?code=0.AXcA...lungo_codice&state=k7m3p9q2r5t8w1x4y7z0a3b6c9d2e5f8
```

**Parametri nell'URL**:
- `code`: authorization code temporaneo
- `state`: lo stesso state che hai inviato prima

**Cosa succede**:
- La tua app React si ricarica
- L'URL contiene i parametri `code` e `state`
- Il componente React rileva questi parametri

### Step 4.2: Intercettazione parametri

```javascript
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
```

**Controlli di sicurezza**:
1. ❌ Se c'è un `error`: mostra messaggio errore
2. ✅ Se c'è un `code`: procedi con il callback
3. 🔒 **Verifica State**: deve corrispondere a quello salvato

### Step 4.3: Verifica State (protezione CSRF)

```javascript
const savedState = sessionStorage.getItem("auth_state");
if (state !== savedState) {
  setError("Errore di sicurezza: state non valido");
  setLoading(false);
  return;
}
```

**Scenario di attacco prevenuto**:
```
1. Attaccante genera un code con il suo account
2. Attaccante manda vittima su: tuoapp.com/?code=CODE_ATTACCANTE
3. Senza verifica state: vittima userebbe l'account dell'attaccante
4. Con verifica state: state non corrisponde → richiesta bloccata ✅
```

### Step 4.4: Recupero Code Verifier

```javascript
const codeVerifier = sessionStorage.getItem("code_verifier");
if (!codeVerifier) {
  throw new Error("Code verifier non trovato");
}
```

Recupera la stringa random generata all'inizio del flusso.

**Cosa succede se manca**:
- Se `code_verifier` non esiste → errore
- Possibili cause: sessionStorage pulito, tab diverso, timeout

---

## 🎫 FASE 5: SCAMBIO CODE → TOKEN

### Step 5.1: Chiamata a Microsoft Token Endpoint

Il frontend chiama direttamente Microsoft per scambiare il code con i token:

```javascript
const handleAuthCallback = async (code) => {
  try {
    setLoading(true);
    setError("");

    const codeVerifier = sessionStorage.getItem("code_verifier");
    if (!codeVerifier) {
      throw new Error("Code verifier non trovato");
    }

    // Scambio code con token
    const tokenData = {
      client_id: CLIENT_ID,
      code: code,
      grant_type: "authorization_code",
      redirect_uri: REDIRECT_URI,
      code_verifier: codeVerifier,  // ⭐ Chiave PKCE
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
    // ... continua
  }
};
```

**Parametri inviati**:

| Parametro | Valore | Descrizione |
|-----------|--------|-------------|
| `client_id` | ID app | Identifica la tua app |
| `code` | Authorization code | Ricevuto da Microsoft |
| `grant_type` | `authorization_code` | Tipo di flusso OAuth |
| `redirect_uri` | `http://localhost:3000` | Deve corrispondere |
| `code_verifier` | Stringa originale | Per PKCE ⭐ |

### Step 5.2: Validazione PKCE lato Microsoft

**Cosa fa Microsoft internamente**:

```javascript
// 1. Recupera il code_challenge salvato in precedenza
const savedChallenge = database.get(code).code_challenge;

// 2. Calcola l'hash del code_verifier ricevuto
const calculatedChallenge = SHA256(code_verifier);

// 3. Confronta
if (calculatedChallenge === savedChallenge) {
  // ✅ PKCE valido → rilascia token
  return {
    access_token: "...",
    refresh_token: "...",
    expires_in: 3599
  };
} else {
  // ❌ PKCE non valido → errore
  return { error: "invalid_grant" };
}
```

**Perché è sicuro**:
- Solo chi ha il `code_verifier` originale può ottenere i token
- Anche se qualcuno intercetta il `code`, non può usarlo
- Il `code_challenge` da solo non può essere invertito (è un hash)

### Step 5.3: Risposta Microsoft con token

Microsoft risponde con un JSON:

```json
{
  "token_type": "Bearer",
  "scope": "openid profile email User.Read",
  "expires_in": 3599,
  "access_token": "eyJ0eXAiOiJKV1QiLCJub25jZSI6IjRlNGE4...",
  "refresh_token": "0.AXcAY4h3bL-rIEWGhq3Vg2AeFH...",
  "id_token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiIsIng1dCI6..."
}
```

**Token ricevuti**:

| Token | Durata | Scopo |
|-------|--------|-------|
| `access_token` | 1 ora | Chiamare Microsoft Graph API |
| `refresh_token` | ~90 giorni | Ottenere nuovi access token |
| `id_token` | N/A | Contiene info identità utente |

### Step 5.4: Struttura del JWT Access Token

L'access token è un JWT (JSON Web Token) con tre parti:

```
eyJ0eXAiOi...  .  eyJhdWQiOi...  .  SflKxwRJ...
   HEADER          PAYLOAD          SIGNATURE
```

**Decodificato**:

**Header**:
```json
{
  "typ": "JWT",
  "alg": "RS256",
  "kid": "RkI5MjI5OUY..."
}
```

**Payload**:
```json
{
  "aud": "xyz789-client-id",
  "iss": "https://login.microsoftonline.com/abc123-tenant-id/v2.0",
  "iat": 1700000000,
  "exp": 1700003600,
  "sub": "AAAAAAAAAAAAAAAAAAAAAEWjd...",
  "name": "Mario Rossi",
  "preferred_username": "mario.rossi@tuaazienda.com",
  "oid": "abc123-user-id",
  "tid": "abc123-tenant-id",
  "scp": "openid profile email User.Read"
}
```

**Signature**: firma crittografica per verificare l'autenticità

---

## 👤 FASE 6: RECUPERO DATI UTENTE

### Step 6.1: Chiamata Microsoft Graph API

Dopo aver ricevuto l'access token, il frontend chiama Microsoft Graph per ottenere i dati dell'utente:

```javascript
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
```

### Step 6.2: Risposta con dati utente

Microsoft Graph risponde con un JSON completo:

```json
{
  "id": "abc123-user-id-4567-8901-def234567890",
  "displayName": "Mario Rossi",
  "givenName": "Mario",
  "surname": "Rossi",
  "userPrincipalName": "mario.rossi@tuaazienda.com",
  "mail": "mario.rossi@tuaazienda.com",
  "jobTitle": "Senior Developer",
  "officeLocation": "Milano - Sede Centrale",
  "mobilePhone": "+39 333 1234567",
  "businessPhones": ["+39 02 12345678"],
  "preferredLanguage": "it-IT"
}
```

**Campi disponibili** (dipendono dagli scope richiesti):
- `id`: ID univoco utente
- `displayName`: nome completo
- `givenName`: nome
- `surname`: cognome
- `mail` / `userPrincipalName`: email
- `jobTitle`: ruolo lavorativo
- `officeLocation`: sede
- E molti altri...

### Step 6.3: Normalizzazione e salvataggio dati

```javascript
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

// Aggiorna stato React
setUser(user);
setIsAuthenticated(true);
```

**Perché normalizzare?**
- Crea una struttura dati consistente
- Gestisce campi opzionali (es: `mail` potrebbe non esistere)
- Facilita l'uso nel resto dell'applicazione

### Step 6.4: Pulizia URL e sessionStorage

```javascript
// Pulisci sessionStorage (non servono più)
sessionStorage.removeItem("code_verifier");
sessionStorage.removeItem("auth_state");

// Rimuovi parametri dall'URL per pulizia
window.history.replaceState({}, document.title, window.location.pathname);
```

**Prima**:
```
http://localhost:3000/?code=0.AXcA...&state=k7m3p9q2r5t8w1x4y7z0a3b6c9d2e5f8
```

**Dopo**:
```
http://localhost:3000/
```

---

## ✅ FASE 7: UTENTE AUTENTICATO

### Step 7.1: Rendering interfaccia utente

Con `isAuthenticated === true` e `user` popolato, React renderizza la dashboard:

```jsx
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
              Ciao <strong>{user.given_name} {user.family_name}</strong>
            </p>
            <p className="text-sm text-gray-500 mt-2">{user.email}</p>
          </div>
          {/* ... resto della UI */}
        </div>
      </div>
    </div>
  );
}
```

**L'utente vede**:
```
┌──────────────────────────────────────┐
│  👤  Benvenuto/a!                    │
│                                      │
│  Ciao Mario Rossi                    │
│  mario.rossi@tuaazienda.com          │
│                                      │
│  ┌────────────────────────────────┐ │
│  │ Informazioni Account           │ │
│  │ Nome: Mario                    │ │
│  │ Cognome: Rossi                 │ │
│  │ Email: mario.rossi@...         │ │
│  │ ID Utente: abc123-...          │ │
│  └────────────────────────────────┘ │
│                                      │
│  [Testa API Protetta]                │
│  [Disconnetti]                       │
└──────────────────────────────────────┘
```

### Step 7.2: Stato applicazione

A questo punto, lo stato dell'applicazione è:

**localStorage**:
```javascript
{
  "access_token": "eyJ0eXAiOiJKV1QiLCJub...",
  "refresh_token": "0.AXcAY4h3bL-rIEWG..."
}
```

**React State**:
```javascript
{
  isAuthenticated: true,
  user: {
    sub: "abc123-user-id",
    given_name: "Mario",
    family_name: "Rossi",
    email: "mario.rossi@tuaazienda.com",
    name: "Mario Rossi"
  },
  loading: false,
  error: ""
}
```

**sessionStorage**: vuoto (parametri PKCE già rimossi)

---

## 🔒 FASE 8: CHIAMATA API PROTETTE

### Step 8.1: Click su "Testa API Protetta"

L'utente clicca sul pulsante per testare una chiamata a un'API protetta:

```javascript
const callProtectedAPI = async () => {
  try {
    setLoading(true);

    const response = await apiCall(`${API_BASE_URL}/api/protected`);

    if (response.ok) {
      const data = await response.json();
      console.log("Dati ricevuti:", data);
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
```

### Step 8.2: Funzione apiCall con retry automatico

Questa funzione wrapper gestisce automaticamente il refresh del token:

```javascript
const apiCall = async (url, options = {}) => {
  const token = localStorage.getItem("access_token");

  if (!token) {
    throw new Error("Nessun token disponibile");
  }

  // ⭐ PRIMO TENTATIVO con token corrente
  let response = await fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${token}`,
    },
  });

  // ⭐ Se token scaduto (401/403), prova il refresh
  if (response.status === 401 || response.status === 403) {
    console.log("Token scaduto, tentativo refresh...");

    const refreshSuccess = await refreshAccessToken(
      localStorage.getItem("refresh_token")
    );

    if (refreshSuccess) {
      // ⭐ SECONDO TENTATIVO con nuovo token
      const newToken = localStorage.getItem("access_token");
      response = await fetch(url, {
        ...options,
        headers: {
          ...options.headers,
          Authorization: `Bearer ${newToken}`,
        },
      });
    } else {
      // Refresh fallito → redirect al login
      handleLogout();
      throw new Error("Sessione scaduta, effettua nuovamente il login");
    }
  }

  return response;
};
```

**Flusso**:
```
1. Prova chiamata con token corrente
   ↓
2a. Se 200 OK → successo ✅
2b. Se 401/403 → token scaduto
   ↓
3. Esegui refresh token
   ↓
4a. Refresh OK → riprova chiamata ✅
4b. Refresh fallito → logout ❌
```

### Step 8.3: Richiesta HTTP al backend

La chiamata HTTP inviata al backend:

```http
GET /api/protected HTTP/1.1
Host: localhost:3001
Authorization: Bearer eyJ0eXAiOiJKV1QiLCJub25jZSI6IjRlNGE4...
Content-Type: application/json
```

### Step 8.4: Backend riceve la richiesta

Il backend Express riceve la richiesta:

```javascript
app.get("/api/protected", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.sub; // ID utente da Microsoft

    // Qui puoi implementare logica di autorizzazione
    // Ad esempio: controllare ruoli/permessi nel database
    
    res.json({
      message: "Accesso autorizzato ai dati protetti",
      user: req.user,
      data: "Questi sono i tuoi dati aziendali protetti",
    });
  } catch (error) {
    console.error("Errore endpoint protetto:", error);
    res.status(500).json({ error: "Errore interno del server" });
  }
});
```

### Step 8.5: Middleware authenticateToken

Prima di eseguire l'endpoint, passa attraverso il middleware di autenticazione:

```javascript
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "Token di accesso richiesto" });
  }

  try {
    // Verifica del token Microsoft direttamente
    const decoded = await verifyMicrosoftToken(token);
    req.user = decoded;
    next(); // ✅ Token valido → procedi all'endpoint
  } catch (err) {
    console.error("Errore verifica token:", err);
    res.status(403).json({ error: "Token non valido" });
  }
};
```

### Step 8.6: Verifica JWT con chiavi pubbliche Microsoft

La funzione `verifyMicrosoftToken` esegue la validazione crittografica:

```javascript
const verifyMicrosoftToken = async (token) => {
  try {
    // 1️⃣ Ottieni le chiavi pubbliche di Microsoft
    const keysResponse = await axios.get(
      `https://login.microsoftonline.com/${config.tenantId}/discovery/v2.0/keys`
    );

    // 2️⃣ Decodifica l'header del token per ottenere il kid (Key ID)
    const decoded = jwt.decode(token, { complete: true });
    if (!decoded) {
      throw new Error("Token non valido");
    }

    const { kid } = decoded.header;
    
    // 3️⃣ Trova la chiave pubblica corrispondente
    const key = keysResponse.data.keys.find((k) => k.kid === kid);
    if (!key) {
      throw new Error("Chiave di verifica non trovata");
    }

    // 4️⃣ Costruisci la chiave pubblica in formato PEM
    const publicKey = `-----BEGIN CERTIFICATE-----\n${key.x5c[0]}\n-----END CERTIFICATE-----`;

    // 5️⃣ Verifica la firma JWT
    const payload = jwt.verify(token, publicKey, {
      algorithms: ["RS256"],
      audience: config.clientId,
      issuer: `https://login.microsoftonline.com/${config.tenantId}/v2.0`,
    });

    return payload; // ✅ Token valido
  } catch (error) {
    throw new Error("Token non valido: " + error.message);
  }
};
```

**Cosa viene verificato**:

| Check | Descrizione | Errore se fallisce |
|-------|-------------|-------------------|
| **Signature** | Firma crittografica valida | Token manipolato |
| **Algorithm** | Deve essere RS256 | Algoritmo non supportato |
| **Audience** | Deve corrispondere al CLIENT_ID | Token per altra app |
| **Issuer** | Deve essere Microsoft Entra | Token non emesso da Microsoft |
| **Expiration** | Token non scaduto | Token scaduto |
| **Not Before** | Token già valido | Token non ancora attivo |

### Step 8.7: Risposta API

Se tutto è valido, il backend risponde:

```json
{
  "message": "Accesso autorizzato ai dati protetti",
  "user": {
    "aud": "xyz789-client-id",
    "iss": "https://login.microsoftonline.com/abc123-tenant-id/v2.0",
    "sub": "abc123-user-id",
    "name": "Mario Rossi",
    "preferred_username": "mario.rossi@tuaazienda.com"
  },
  "data": "Questi sono i tuoi dati aziendali protetti"
}
```

Il frontend riceve la risposta e la gestisce:

```javascript
const data = await response.json();
console.log("Dati ricevuti:", data);
// Mostra i dati all'utente
```

---

## 🔄 FASE 9: REFRESH TOKEN (se scaduto)

### Step 9.1: Token scaduto dopo ~1 ora

L'access token di Microsoft ha una durata di **1 ora** (3600 secondi). Dopo questo tempo, diventa invalido.

**Scenario**: l'utente è rimasto sulla dashboard per 65 minuti, poi clicca "Testa API Protetta".

```javascript
// Prima chiamata API
const response = await fetch(`${API_BASE_URL}/api/protected`, {
  headers: {
    Authorization: `Bearer ${expired_token}`,
  },
});

console.log(response.status); // 401 Unauthorized
```

Il backend risponde con **401** perché il token è scaduto.

### Step 9.2: Trigger refresh automatico

La funzione `apiCall` rileva il 401 e attiva automaticamente il refresh:

```javascript
if (response.status === 401 || response.status === 403) {
  console.log("Token scaduto, tentativo refresh...");

  const refreshSuccess = await refreshAccessToken(
    localStorage.getItem("refresh_token")
  );

  if (refreshSuccess) {
    // Riprova la chiamata con il nuovo token
    const newToken = localStorage.getItem("access_token");
    response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${newToken}`,
      },
    });
  }
}
```

### Step 9.3: Chiamata refresh token endpoint

La funzione `refreshAccessToken` chiama Microsoft:

```javascript
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
      const { access_token, refresh_token: newRefreshToken } = await response.json();
      
      // ⭐ Aggiorna token in localStorage
      localStorage.setItem("access_token", access_token);
      if (newRefreshToken) {
        localStorage.setItem("refresh_token", newRefreshToken);
      }

      console.log("Token refreshato con successo");
      return true; // ✅ Refresh riuscito
    } else {
      console.error("Errore refresh token:", await response.text());
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
      return false; // ❌ Refresh fallito
    }
  } catch (error) {
    console.error("Errore refresh token:", error);
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    return false;
  }
};
```

**Parametri inviati**:

| Parametro | Valore | Descrizione |
|-----------|--------|-------------|
| `client_id` | ID app | Identifica la tua app |
| `grant_type` | `refresh_token` | Tipo di richiesta |
| `refresh_token` | Token esistente | Refresh token salvato |
| `scope` | `openid profile email User.Read` | Scope richiesti |

### Step 9.4: Risposta Microsoft

Se il refresh token è ancora valido, Microsoft risponde:

```json
{
  "token_type": "Bearer",
  "scope": "openid profile email User.Read",
  "expires_in": 3599,
  "access_token": "eyJ0eXAiOiJKV1QiLCJub25jZSI6...",  // ⭐ NUOVO
  "refresh_token": "0.AXcAY4h3bL-rIEWG..."  // Potrebbe essere nuovo
}
```

**Note importanti**:
- Il **nuovo access_token** è valido per altre 1 ora
- Microsoft **può** fornire un nuovo refresh_token (rotation)
- Se non fornisce un nuovo refresh_token, riusa il vecchio

### Step 9.5: Retry chiamata API

Dopo aver aggiornato il token, `apiCall` riprova la chiamata:

```javascript
if (refreshSuccess) {
  // ⭐ SECONDO TENTATIVO con nuovo token
  const newToken = localStorage.getItem("access_token");
  response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${newToken}`,
    },
  });
}
```

Questa volta il backend valida il nuovo token → **200 OK** ✅

**Esperienza utente**: tutto questo avviene in modo **trasparente**, l'utente non si accorge di nulla!

### Step 9.6: Refresh token scaduto

Se anche il refresh token è scaduto (~90 giorni), Microsoft risponde:

```json
{
  "error": "invalid_grant",
  "error_description": "AADSTS70000: The refresh token has expired..."
}
```

In questo caso:
```javascript
return false; // ❌ Refresh fallito

// apiCall gestisce il fallimento
if (!refreshSuccess) {
  handleLogout(); // Logout forzato
  throw new Error("Sessione scaduta, effettua nuovamente il login");
}
```

L'utente viene riportato alla schermata di login.

---

## 🚪 FASE 10: LOGOUT

### Step 10.1: Click su "Disconnetti"

L'utente clicca sul pulsante di logout:

```javascript
<button onClick={handleLogout}>
  <LogOut className="w-5 h-5" />
  Disconnetti
</button>
```

### Step 10.2: Pulizia locale immediata

Il logout inizia pulendo lo stato locale:

```javascript
const handleLogout = async () => {
  try {
    // 1️⃣ Pulisci stato React immediatamente
    setIsAuthenticated(false);
    setUser(null);
    setError("");

    // 2️⃣ Salva token prima di rimuoverlo (per revoca)
    const token = localStorage.getItem("access_token");
    
    // 3️⃣ Rimuovi token dal localStorage
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");

    // 4️⃣ Pulisci sessionStorage
    sessionStorage.removeItem("code_verifier");
    sessionStorage.removeItem("auth_state");

    // ... continua con logout Microsoft
  } catch (error) {
    console.error("Errore durante logout:", error);
    handleQuickLogout(); // Fallback: logout locale
  }
};
```

### Step 10.3: Revoca token (opzionale)

Prima del logout Microsoft, si può tentare di revocare il token:

```javascript
// Opzionale: Revoca il token lato Microsoft
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
```

**Nota**: questo step è opzionale perché il logout Microsoft successivo invalida comunque la sessione.

### Step 10.4: Logout completo da Microsoft SSO

Per un logout completo che termina anche la sessione SSO aziendale:

```javascript
// Logout completo da Microsoft (redirect)
const logoutUrl =
  `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/logout?` +
  `post_logout_redirect_uri=${encodeURIComponent(REDIRECT_URI + "?logout=true")}`;

// Piccolo delay per permettere al cleanup di completarsi
setTimeout(() => {
  window.location.href = logoutUrl;
}, 100);
```

**Cosa succede**:
1. L'utente viene portato su Microsoft
2. Microsoft termina la sessione SSO (logout da tutti i servizi)
3. Microsoft redirige a `http://localhost:3000/?logout=true`

### Step 10.5: Callback dopo logout

L'app si ricarica con `?logout=true`:

```javascript
useEffect(() => {
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.has("logout")) {
    // ⭐ Pulizia completa dopo logout Microsoft
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
}, []);
```

### Step 10.6: Logout rapido (alternativa)

C'è anche una funzione per logout locale senza passare da Microsoft:

```javascript
const handleQuickLogout = () => {
  setIsAuthenticated(false);
  setUser(null);
  setError("");
  localStorage.clear();
  sessionStorage.clear();
  // Resta sulla stessa pagina, mostra login
};
```

**Quando usarla**:
- Sviluppo/testing (più veloce)
- Non serve logout SSO completo
- Come fallback se il logout Microsoft fallisce

---

## Componenti di Sicurezza

### 1. PKCE (Proof Key for Code Exchange)

**Problema risolto**: intercettazione dell'authorization code

**Come funziona**:
```
Client                    Microsoft
  |                          |
  |-- code_challenge ------->|  (hash pubblico)
  |                          |
  |<----- code --------------|  (temporaneo)
  |                          |
  |-- code + verifier ------>|  (stringa originale)
  |                          |
  |  Microsoft calcola hash  |
  |  e confronta con         |
  |  code_challenge          |
  |                          |
  |<----- tokens ------------|  ✅ Solo se match
```

**Benefici**:
- ✅ Nessun client secret nel frontend
- ✅ Sicuro anche su reti non affidabili
- ✅ Previene authorization code injection

### 2. State Parameter (CSRF Protection)

**Problema risolto**: attacchi CSRF (Cross-Site Request Forgery)

**Come funziona**:
```
1. Client genera: state = "k7m3p9q2r5t8"
2. Salva in sessionStorage
3. Invia a Microsoft nell'URL di autorizzazione
4. Microsoft lo include nel redirect
5. Client verifica: state ricevuto === state salvato
```

**Scenario di attacco prevenuto**:
```
❌ Senza state:
   Attaccante: crea link con code del suo account
   Vittima: clicca link
   Vittima: usa account dell'attaccante (confused deputy)

✅ Con state:
   Attaccante: crea link con code del suo account
   Vittima: clicca link
   App: state non corrisponde → richiesta bloccata
```

### 3. JWT Signature Verification

**Problema risolto**: token falsificati

**Come funziona**:
```
Token JWT:
  HEADER.PAYLOAD.SIGNATURE

Verifica:
1. Scarica chiavi pubbliche Microsoft
2. Trova chiave con kid corretto
3. Verifica firma crittografica
4. Controlla claims (aud, iss, exp)
```

**Cosa viene validato**:
- ✅ **Signature**: token non modificato
- ✅ **Audience**: token per questa app
- ✅ **Issuer**: emesso da Microsoft
- ✅ **Expiration**: non scaduto
- ✅ **Algorithm**: RS256 (sicuro)

### 4. Token Storage

**Best practices implementate**:

| Storage | Uso | Durata | Accessibile da |
|---------|-----|--------|----------------|
| `localStorage` | access_token, refresh_token | Persistente | Solo stesso origin |
| `sessionStorage` | code_verifier, state | Sessione tab | Solo stesso origin |
| Memory (React state) | user, isAuthenticated | Runtime | Solo componente |

**Vulnerabilità mitigate**:
- ✅ **XSS**: usa `httpOnly` cookie se possibile (alternativa)
- ✅ **CSRF**: State parameter
- ✅ **Token replay**: Short-lived access tokens (1h)
- ✅ **Token theft**: Refresh token rotation

### 5. HTTPS Requirement

**Importante**: In produzione, **DEVE** essere usato HTTPS per:
- Prevenire man-in-the-middle attacks
- Proteggere token in transito
- Requisito OAuth 2.0 RFC

---

## Configurazione

### Variabili d'Ambiente Frontend (.env)

```bash
# Microsoft Entra ID Configuration
VITE_CLIENT_ID=abc123-4567-8901-def2-34567890abcd
VITE_TENANT_ID=xyz789-tenant-id-1234-5678-901234567890
VITE_REDIRECT_URI=http://localhost:3000

# Backend API
VITE_API_BASE_URL=http://localhost:3001
```

### Variabili d'Ambiente Backend (.env)

```bash
# Microsoft Entra ID Configuration
CLIENT_ID=abc123-4567-8901-def2-34567890abcd
TENANT_ID=xyz789-tenant-id-1234-5678-901234567890
REDIRECT_URI=http://localhost:3000

# Server Configuration
PORT=3001
NODE_ENV=development
```

### Registrazione App in Microsoft Entra ID

1. **Vai al portale Azure**: https://portal.azure.com
2. **Microsoft Entra ID** → **App registrations** → **New registration**
3. **Configura**:
   - Nome: "My SSO App"
   - Supported account types: "Single tenant"
   - Redirect URI: "http://localhost:3000" (tipo: SPA)
4. **Authentication**:
   - ✅ Access tokens
   - ✅ ID tokens
   - Enable PKCE
5. **API permissions**:
   - Microsoft Graph → Delegated permissions:
     - ✅ `openid`
     - ✅ `profile`
     - ✅ `email`
     - ✅ `User.Read`
6. **Copia**:
   - Application (client) ID → `CLIENT_ID`
   - Directory (tenant) ID → `TENANT_ID`

---

## Diagramma di Sequenza

```
┌────────┐         ┌──────────┐         ┌───────────┐         ┌─────────┐
│Frontend│         │Microsoft │         │   Graph   │         │ Backend │
│ React  │         │Entra ID  │         │    API    │         │ Express │
└───┬────┘         └────┬─────┘         └─────┬─────┘         └────┬────┘
    │                   │                     │                    │
    │ 1. handleLogin    │                     │                    │
    ├──────────────────>│                     │                    │
    │ (code_challenge)  │                     │                    │
    │                   │                     │                    │
    │ 2. Login Page     │                     │                    │
    │<──────────────────┤                     │                    │
    │                   │                     │                    │
    │ 3. Credenziali    │                     │                    │
    ├──────────────────>│                     │                    │
    │                   │                     │                    │
    │ 4. Redirect + code│                     │                    │
    │<──────────────────┤                     │                    │
    │                   │                     │                    │
    │ 5. Token Request  │                     │                    │
    ├──────────────────>│                     │                    │
    │ (code + verifier) │                     │                    │
    │                   │                     │                    │
    │ 6. Tokens         │                     │                    │
    │<──────────────────┤                     │                    │
    │                   │                     │                    │
    │ 7. Get User Info  │                     │                    │
    ├───────────────────┼────────────────────>│                    │
    │ (access_token)    │                     │                    │
    │                   │                     │                    │
    │ 8. User Data      │                     │                    │
    │<──────────────────┼─────────────────────┤                    │
    │                   │                     │                    │
    │ 9. API Call       │                     │                    │
    ├───────────────────┼─────────────────────┼───────────────────>│
    │ (access_token)    │                     │                    │
    │                   │                     │                    │
    │                   │                     │ 10. Verify Token   │
    │                   │<────────────────────┼────────────────────┤
    │                   │ (public keys)       │                    │
    │                   │                     │                    │
    │                   │ 11. Keys            │                    │
    │                   │─────────────────────>│                    │
    │                   │                     │                    │
    │                   │                     │ 12. Signature OK   │
    │                   │                     │                    │
    │ 13. Protected Data│                     │                    │
    │<──────────────────┼─────────────────────┼────────────────────┤
    │                   │                     │                    │
    │ (dopo 1 ora)      │                     │                    │
    │                   │                     │                    │
    │ 14. API Call      │                     │                    │
    ├───────────────────┼─────────────────────┼───────────────────>│
    │ (expired token)   │                     │                    │
    │                   │                     │                    │
    │ 15. 401 Unauthorized                    │                    │
    │<──────────────────┼─────────────────────┼────────────────────┤
    │                   │                     │                    │
    │ 16. Refresh Request                     │                    │
    ├──────────────────>│                     │                    │
    │ (refresh_token)   │                     │                    │
    │                   │                     │                    │
    │ 17. New Tokens    │                     │                    │
    │<──────────────────┤                     │                    │
    │                   │                     │                    │
    │ 18. Retry API Call│                     │                    │
    ├───────────────────┼─────────────────────┼───────────────────>│
    │ (new access_token)│                     │                    │
    │                   │                     │                    │
    │ 19. Success       │                     │                    │
    │<──────────────────┼─────────────────────┼────────────────────┤
    │                   │                     │                    │
    │ 20. handleLogout  │                     │                    │
    ├──────────────────>│                     │                    │
    │                   │                     │                    │
    │ 21. Logout Page   │                     │                    │
    │<──────────────────┤                     │                    │
    │                   │                     │                    │
    │ 22. Redirect      │                     │                    │
    │<──────────────────┤                     │                    │
    │ (?logout=true)    │                     │                    │
    │                   │                     │                    │
```

---

## Riepilogo Completo

### Flusso Semplificato

```
1. 🚀 AVVIO
   → Controlla token esistente
   → Se valido: mostra dashboard
   → Se no: mostra login

2. 🔐 LOGIN
   → Genera PKCE (verifier + challenge)
   → Genera state
   → Redirect a Microsoft

3. 🌐 MICROSOFT
   → Utente inserisce credenziali
   → Microsoft valida
   → Genera authorization code
   → Redirect all'app

4. 🔄 CALLBACK
   → Verifica state (CSRF)
   → Scambia code con token (PKCE)
   → Ottieni access_token + refresh_token
   → Chiama Graph API per dati utente
   → Salva tutto in localStorage

5. ✅ AUTENTICATO
   → Mostra dashboard
   → Utente può usare l'app

6. 🔒 API CALL
   → Invia access_token nell'header
   → Backend valida JWT
   → Se valido: risponde con dati
   → Se 401: refresh automatico

7. 🔄 REFRESH
   → Usa refresh_token
   → Ottieni nuovo access_token
   → Riprova chiamata API

8. 🚪 LOGOUT
   → Pulisci localStorage
   → Logout da Microsoft
   → Termina sessione SSO
   → Redirect alla home
```

### Vantaggi di questa Architettura

✅ **Sicurezza**:
- PKCE: nessun client secret necessario
- State: protezione CSRF
- JWT Verification: token crittograficamente sicuri
- Refresh automatico: sessioni prolungate senza rischi

✅ **User Experience**:
- Single Sign-On: un solo login per tutti i servizi aziendali
- Refresh trasparente: nessun logout improvviso
- Sessioni persistenti: fino a 90 giorni

✅ **Scalabilità**:
- Backend stateless: non gestisce sessioni
- Validazione JWT: rapida e distribuibile
- Token-based: funziona con microservizi

✅ **Compliance**:
- OAuth 2.0 standard
- Best practices Microsoft
- GDPR-friendly (dati minimali)

---

## Troubleshooting Comune

### Errore: "Code verifier non trovato"

**Causa**: sessionStorage pulito o tab diverso

**Soluzione**: 
- Usa sempre lo stesso tab per il login
- Non ricaricare la pagina durante il flusso
- Controlla che sessionStorage non sia disabilitato

### Errore: "State non valido"

**Causa**: possibile attacco CSRF o state non salvato

**Soluzione**:
- Verifica che sessionStorage funzioni
- Non modificare l'URL manualmente
- Controlla i cookie third-party se problema persiste

### Errore: "Token non valido"

**Causa**: token scaduto o firma non verificabile

**Soluzione**:
- Verifica che TENANT_ID e CLIENT_ID siano corretti
- Controlla che l'orologio di sistema sia sincronizzato
- Verifica che il token non sia stato manipolato

### Errore: "Refresh token expired"

**Causa**: refresh token scaduto dopo ~90 giorni

**Soluzione**:
- Normale: utente deve effettuare nuovo login
- Considera: implementa "remember me" con notifiche

---

## Conclusioni

Questo sistema implementa un **robusto flusso SSO** con Microsoft Entra ID utilizzando le best practices OAuth 2.0:

- 🔐 **PKCE** per sicurezza senza client secret
- 🛡️ **State** per protezione CSRF
- 🔑 **JWT Verification** per validazione token
- 🔄 **Refresh automatico** per UX fluida
- 🚪 **Single Logout** per privacy

L'architettura separa chiaramente le responsabilità tra frontend (gestisce OAuth flow), Microsoft (autentica), e backend (autorizza), risultando in un sistema sicuro, scalabile e conforme agli standard.

---