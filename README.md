# Microsoft Entra ID Authentication - Full Stack

Sistema completo di autenticazione aziendale con Microsoft Entra ID, sviluppato con React (frontend) e Node.js (backend).

## 🏗️ Architettura

```
microsoft-entra-auth-fullstack/
├── package.json                    # Launcher e script principali
├── README.md                       # Questa documentazione
├── GUIDE.md                        # Guida completa al flusso OAuth
├── auth-frontend/                  # Frontend React + Vite
│   ├── src/App.jsx                # Componente principale
│   ├── package.json               # Dipendenze frontend
│   └── README.md                  # Documentazione frontend
└── auth-server/                   # Backend Node.js + Express
    ├── server.js                  # Server API
    ├── package.json              # Dipendenze backend
    └── README.md                 # Documentazione backend
```

## 🚀 Quick Start

### 1. Setup iniziale completo

```bash
# Clona/crea la directory principale
mkdir microsoft-entra-auth-fullstack
cd microsoft-entra-auth-fullstack

# Installa concurrently
npm install

# Setup completo di entrambi i progetti
npm run setup
```

### 2. Configurazione Microsoft Entra ID

1. Vai su [portal.azure.com](https://portal.azure.com)
2. Vai su **Microsoft Entra ID** → **App registrations** → **New registration**
3. Configura:
   - **Name**: "My SSO App"
   - **Supported account types**: "Single tenant"
   - **Redirect URI**: "http://localhost:3000" (tipo: **Single-page application**)
4. Dopo la creazione, vai su **Authentication**:
   - ✅ Authorization code flow with PKCE: **Enabled**
   - ❌ Implicit grant flows: **Disabled** (deprecato)
5. Vai su **API permissions**:
   - Clicca **"Add a permission"** → **Microsoft Graph** → **Delegated permissions**
   - Aggiungi:
     - ✅ `openid` - Autenticazione base OpenID Connect
     - ✅ `profile` - Informazioni profilo utente (nome, cognome)
     - ✅ `email` - Indirizzo email utente
     - ✅ `User.Read` - Lettura profilo utente autenticato
   - Clicca **"Grant admin consent for [Your Organization]"** ⚠️ **IMPORTANTE**
6. Copia dalla pagina **Overview**:
   - **Application (client) ID** → `CLIENT_ID`
   - **Directory (tenant) ID** → `TENANT_ID`

#### Configurazione API Permissions

**Permissions Base (Obbligatorie):**
- ✅ `openid` - Autenticazione base OpenID Connect
- ✅ `profile` - Informazioni profilo utente (nome, cognome)
- ✅ `email` - Indirizzo email utente
- ✅ `User.Read` - Lettura profilo utente autenticato

**Permissions Avanzate (Opzionali):**
- ✅ `User.ReadBasic.All` - Lettura info base di altri utenti (per lookup)
- ✅ `Directory.Read.All` - Lettura struttura organizzativa
- ✅ `Group.Read.All` - Lettura gruppi utente (per autorizzazioni)

**⚠️ IMPORTANTE**: Clicca sempre "Grant admin consent" per far funzionare le permissions.

#### Scopi delle Permissions

```javascript
// openid, profile, email → Informazioni base utente
{
  "sub": "12345-67890",           // ID utente unico
  "name": "Mario Rossi",          // Nome completo
  "given_name": "Mario",          // Nome
  "family_name": "Rossi",         // Cognome  
  "email": "mario@azienda.com"    // Email
}

// User.Read → Accesso Microsoft Graph /me endpoint
const userData = await fetch('https://graph.microsoft.com/v1.0/me');

// User.ReadBasic.All → Lookup altri utenti per assegnazioni
const user = await fetch('https://graph.microsoft.com/v1.0/users/other-user-id');

// Group.Read.All → Gruppi per autorizzazioni automatiche
const groups = await fetch('https://graph.microsoft.com/v1.0/me/memberOf');
```

### 3. Configurazione variabili d'ambiente

**auth-frontend/.env:**
```env
VITE_CLIENT_ID=your-client-id
VITE_TENANT_ID=your-tenant-id
VITE_REDIRECT_URI=http://localhost:3000
VITE_API_BASE_URL=http://localhost:3001
```

**auth-server/.env:**
```env
CLIENT_ID=your-client-id
TENANT_ID=your-tenant-id
PORT=3001
REDIRECT_URI=http://localhost:3000
FRONTEND_URL=http://localhost:3000
NODE_ENV=development
```

### 4. Avvio dell'applicazione

```bash
# Avvia frontend + backend simultaneamente
npm run dev

# Frontend: http://localhost:3000
# Backend: http://localhost:3001
```

## 📋 Script disponibili

### Sviluppo
- `npm run dev` - Avvia frontend + backend in modalità sviluppo
- `npm run server` - Avvia solo il backend
- `npm run client` - Avvia solo il frontend

### Setup e installazione
- `npm run install:all` - Installa dipendenze di tutti i progetti
- `npm run setup` - Pulizia completa + installazione dipendenze
- `npm run clean` - Rimuove tutte le node_modules

### Build e produzione
- `npm run build` - Build del frontend per produzione
- `npm run build:server` - Avvia il server in modalità produzione

### Testing
- `npm run test` - Esegue i test di entrambi i progetti

## 🎯 Flusso di autenticazione

### Architettura del Sistema

Il sistema implementa **OAuth 2.0 Authorization Code Flow con PKCE** (Proof Key for Code Exchange):

```
┌─────────────┐         ┌──────────────────┐         ┌─────────────┐
│  Frontend   │ ◄─────► │  Microsoft       │ ◄─────► │   Backend   │
│  (React)    │         │  Entra ID        │         │  (Express)  │
└─────────────┘         └──────────────────┘         └─────────────┘
```

### Flusso Completo

1. **Frontend React (Client)**: 
   - Gestisce il flusso OAuth 2.0 + PKCE completo
   - Genera Code Verifier e Code Challenge
   - Effettua token exchange direttamente con Microsoft
   - Gestione automatica refresh token
   - Invia token nelle chiamate API

2. **Microsoft Entra ID (Authorization Server)**:
   - Autentica l'utente (credenziali aziendali + MFA)
   - Rilascia authorization code
   - Fornisce access_token e refresh_token
   - Espone Microsoft Graph API per dati utente
   - Gestisce il logout SSO completo

3. **Backend Node.js (Resource Server)**:
   - Valida token tramite **Microsoft Graph API** (approccio semplificato)
   - Protegge le API aziendali
   - Implementa logica di autorizzazione custom
   - Gestisce permessi e ruoli specifici dell'app

### Validazione Token Backend

Il backend implementa un approccio **semplificato e sicuro** per validare i token:

**Invece di validare JWT localmente con chiavi pubbliche**, il backend:
1. Riceve l'access token dal frontend
2. Chiama **Microsoft Graph API** (`https://graph.microsoft.com/v1.0/me`) con il token
3. Se Microsoft risponde con 200 OK → token valido ✅
4. Se Microsoft risponde con 401/403 → token invalido ❌

**Vantaggi di questo approccio**:
- ✅ Più semplice da implementare
- ✅ Meno dipendenze (no jsonwebtoken, no jwks-rsa)
- ✅ Sempre aggiornato (Microsoft gestisce le chiavi)
- ✅ Standard per app SPA con PKCE
- ✅ Nessuna gestione di key rotation

```javascript
// Backend: middleware authenticateToken semplificato
const authenticateToken = async (req, res, next) => {
  const token = req.headers["authorization"]?.split(" ")[1];
  
  if (!token) {
    return res.status(401).json({ error: "Token richiesto" });
  }

  try {
    // Valida token chiamando Microsoft Graph
    const response = await axios.get("https://graph.microsoft.com/v1.0/me", {
      headers: { Authorization: `Bearer ${token}` }
    });

    // Token valido → salva dati utente
    req.user = {
      sub: response.data.id,
      email: response.data.mail || response.data.userPrincipalName,
      name: response.data.displayName,
      // ... altri campi
    };
    
    next();
  } catch (err) {
    res.status(403).json({ error: "Token non valido" });
  }
};
```

## 🔒 Sicurezza implementata

### 1. PKCE (Proof Key for Code Exchange)
- **Problema risolto**: Intercettazione dell'authorization code
- **Come funziona**: Il client genera un Code Verifier random, calcola il Code Challenge (hash SHA-256), invia solo il challenge a Microsoft, che lo verifica al momento dello scambio code→token
- **Vantaggio**: Nessun Client Secret necessario nel frontend

### 2. State Parameter (CSRF Protection)
- **Problema risolto**: Cross-Site Request Forgery attacks
- **Come funziona**: Genera stringa random, salvata in sessionStorage, inviata nell'URL di autorizzazione, verificata al callback
- **Vantaggio**: Previene attacchi di confused deputy

### 3. Token Validation via Microsoft Graph
- **Approccio**: Delega la validazione a Microsoft chiamando l'API Graph
- **Vantaggi**: Sempre aggiornato, nessuna gestione chiavi, più semplice
- **Sicurezza**: Microsoft verifica firma, expiration, audience automaticamente

### 4. Refresh Token Automatico
- **Durata access token**: 1 ora
- **Durata refresh token**: ~90 giorni
- **Gestione**: Automatica e trasparente per l'utente
- **Sicurezza**: Refresh token rotation supportato

### 5. Token Storage
| Storage | Contenuto | Durata | Sicurezza |
|---------|-----------|--------|-----------|
| `localStorage` | access_token, refresh_token | Persistente | Same-origin only |
| `sessionStorage` | code_verifier, state | Sessione tab | Same-origin only |
| `React state` | user, isAuthenticated | Runtime | In-memory |

### 6. HTTPS Requirement
⚠️ **IMPORTANTE**: In produzione usa **SEMPRE HTTPS** per:
- Prevenire man-in-the-middle attacks
- Proteggere token in transito
- Requisito OAuth 2.0 RFC

## 🛠️ Tecnologie utilizzate

### Frontend
- **React 18** - Framework UI
- **Vite** - Build tool veloce
- **Tailwind CSS** - Styling utility-first
- **Lucide React** - Icone moderne
- **Web Crypto API** - Generazione PKCE

### Backend
- **Node.js + Express** - Server API
- **Axios** - HTTP client per Microsoft Graph
- **CORS** - Gestione Cross-Origin requests
- **dotenv** - Gestione variabili ambiente

### Nota sulle Dipendenze Backend
Il backend **NON richiede** librerie JWT come:
- ❌ `jsonwebtoken` - Non necessario (validazione via Graph API)
- ❌ `jwks-rsa` - Non necessario (nessuna gestione chiavi)

Questo semplifica notevolmente la gestione delle dipendenze e della sicurezza.

## 📁 Struttura dettagliata

```
microsoft-entra-auth-fullstack/
├── package.json                    # Script launcher principali
├── README.md                       # Documentazione principale (questo file)
├── GUIDE.md                        # Guida dettagliata al flusso OAuth 2.0
│
├── auth-frontend/                  # Frontend React
│   ├── package.json               # Dipendenze React + Vite
│   ├── vite.config.js             # Configurazione Vite
│   ├── tailwind.config.js         # Configurazione Tailwind
│   ├── index.html                 # Template HTML
│   ├── .env                       # Variabili ambiente frontend
│   └── src/
│       ├── main.jsx               # Entry point
│       ├── App.jsx                # Componente principale con OAuth flow
│       └── index.css              # Stili globali Tailwind
│
└── auth-server/                   # Backend Node.js
    ├── package.json               # Dipendenze Express + Axios
    ├── server.js                  # Server API principale
    ├── .env                       # Variabili ambiente backend
    └── .gitignore                 # File da ignorare (node_modules, .env)
```

## 🚀 Deployment

### Sviluppo locale
```bash
npm run dev    # Frontend: :3000, Backend: :3001
```

### Produzione

**Frontend (Build statico)**:
```bash
cd auth-frontend
npm run build
# Deploy la cartella dist/ su:
# - Vercel, Netlify, AWS S3 + CloudFront
# - Azure Static Web Apps
# - GitHub Pages
```

**Backend (Server Node.js)**:
```bash
cd auth-server
npm start
# Deploy su:
# - Heroku, Railway, Render
# - Azure App Service
# - AWS EC2, ECS, Lambda
```

**Configurazione produzione**:
1. Cambia `REDIRECT_URI` nell'Azure portal e .env
2. Configura HTTPS per entrambi frontend e backend
3. Usa variabili ambiente del provider (non .env)
4. Configura CORS con origine specifica (non `*`)
5. Abilita rate limiting sul backend

## 🐛 Troubleshooting

### Problemi comuni di autenticazione

#### ❌ "AADSTS70011: Invalid scope"
**Causa**: Le API permissions non sono configurate correttamente in Azure
**Soluzione**: 
- Verifica di aver aggiunto tutte le permissions (openid, profile, email, User.Read)
- Verifica che siano "Delegated permissions" (non "Application permissions")

#### ❌ "AADSTS65001: User or administrator has not consented"
**Causa**: Admin consent non dato
**Soluzione**: 
- Nel portale Azure → API permissions → "Grant admin consent for [Organization]"
- Riprova il login

#### ❌ "AADSTS9002327: Tokens issued for SPA client-type"
**Causa**: Platform type errato in Azure
**Soluzione**: 
- Azure portal → Authentication → Platform type deve essere **"Single-page application"**
- NON "Web" o "Mobile and desktop"

#### ❌ "invalid_grant: Code verifier not found"
**Causa**: sessionStorage pulito o flusso PKCE interrotto
**Soluzione**:
- Non ricaricare la pagina durante il login
- Usa sempre lo stesso browser tab
- Verifica che sessionStorage non sia disabilitato

#### ❌ "State non valido" (CSRF error)
**Causa**: State parameter non corrisponde
**Soluzione**:
- Non modificare l'URL manualmente durante il callback
- Verifica che sessionStorage funzioni
- Controlla i cookie third-party se il problema persiste

### Problemi di configurazione

#### ❌ CORS errors nel backend
**Causa**: Backend non configurato per accettare richieste dal frontend
**Soluzione**:
```javascript
// server.js
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
```

#### ❌ Token validation failed con 403
**Causa**: Token scaduto o invalido, Microsoft Graph non raggiungibile
**Soluzione**:
- Verifica che il token non sia scaduto (usa jwt.io per decodificare)
- Controlla che CLIENT_ID e TENANT_ID siano corretti in entrambi i .env
- Verifica connessione internet del backend (deve raggiungere graph.microsoft.com)
- Controlla i log del backend per errori specifici

#### ❌ "Redirect URI mismatch"
**Causa**: Redirect URI non corrisponde tra Azure e .env
**Soluzione**:
- Azure portal → Authentication → Redirect URIs deve contenere esattamente `http://localhost:3000`
- Verifica `VITE_REDIRECT_URI` nel frontend .env
- In produzione, cambia con l'URL reale (es: `https://myapp.com`)

### Problemi di permissions

#### ❌ "Insufficient privileges to complete the operation"
**Causa**: L'utente non ha i permessi necessari
**Soluzione**:
- Contatta l'amministratore Azure AD
- Verifica che le permissions siano di tipo "Delegated" (non "Application")
- Verifica che admin consent sia stato dato

#### ❌ "Token audience validation failed"
**Causa**: CLIENT_ID non corrisponde tra frontend e backend
**Soluzione**:
- Verifica che CLIENT_ID sia identico in `auth-frontend/.env` e `auth-server/.env`
- Copia il valore da Azure portal → Overview → Application (client) ID

### Log e debug

**Backend logging**:
```bash
cd auth-server
npm run dev
# Guarda console per:
# - "Token valido per utente: xxx"
# - "Errore verifica token: xxx"
```

**Frontend logging**:
```bash
cd auth-frontend
npm run dev
# Apri DevTools → Console per:
# - "Token refreshato con successo"
# - "Dati ricevuti: xxx"
```

**Verifica token JWT** (debug):
1. Copia l'access token da localStorage (DevTools → Application → Local Storage)
2. Vai su [jwt.io](https://jwt.io)
3. Incolla il token per vedere header e payload
4. Verifica:
   - `aud` (audience) = il tuo CLIENT_ID
   - `iss` (issuer) = `https://login.microsoftonline.com/{TENANT_ID}/v2.0`
   - `exp` (expiration) > now
   - `scp` (scope) contiene "User.Read"

### Checklist configurazione Azure

Verifica che tutto sia configurato correttamente:

- ✅ App Registration creata come **"Single-page application"**
- ✅ Redirect URI: `http://localhost:3000` (esatto, senza trailing slash)
- ✅ Logout URL: `http://localhost:3000?logout=true`
- ✅ **Platform**: Single-page application (NON Web)
- ✅ **Authorization code flow with PKCE**: Enabled
- ✅ **Implicit grant flows**: Disabled (deprecato)
- ✅ API Permissions: openid, profile, email, User.Read
- ✅ API Permissions: Status = **"Granted for [Organization]"** (verde)
- ✅ CLIENT_ID copiato correttamente (36 caratteri con trattini)
- ✅ TENANT_ID copiato correttamente (36 caratteri con trattini)

## 📞 Supporto

- **Frontend issues**: Vedi `auth-frontend/README.md`
- **Backend issues**: Vedi `auth-server/README.md`
- **Flusso OAuth completo**: Vedi `GUIDE.md`
- **Azure configuration**: [Documentazione Microsoft Entra ID](https://learn.microsoft.com/en-us/entra/identity-platform/)

## 🔄 Aggiornamenti

```bash
# Aggiorna tutte le dipendenze
npm run clean
npm run install:all

# Aggiorna solo frontend
cd auth-frontend && npm update

# Aggiorna solo backend
cd auth-server && npm update
```

## 📝 Note importanti

### Sicurezza
- ⚠️ **MAI** committare file `.env` in Git
- ⚠️ In produzione usa **SEMPRE HTTPS**
- ⚠️ Configura CORS con origini specifiche (non `*`)
- ⚠️ Abilita rate limiting sul backend in produzione
- ⚠️ Considera l'uso di `httpOnly` cookies invece di localStorage per token (più sicuro contro XSS)

### Best Practices
- ✅ Usa variabili ambiente diverse per dev/staging/prod
- ✅ Implementa logging appropriato (non loggare token!)
- ✅ Monitora le chiamate API per individuare refresh token failures
- ✅ Implementa retry logic con exponential backoff
- ✅ Testa il flusso con utenti reali prima del deploy

### Limitazioni
- Access token validità: **1 ora** (non modificabile)
- Refresh token validità: **~90 giorni** (configurabile in Azure)
- Rate limits Microsoft Graph: **~2000 richieste/minuto** per app
- Token size: ~1-2 KB (considera bandwidth in app mobile)

---

**Pronto per iniziare!** Esegui `npm run dev` e vai su http://localhost:3000 🚀

**Prossimi passi**:
1. Leggi `GUIDE.md` per comprendere il flusso OAuth completo
2. Personalizza l'UI in `auth-frontend/src/App.jsx`
3. Aggiungi endpoint API custom in `auth-server/server.js`
4. Implementa logica di autorizzazione basata su ruoli/gruppi
5. Deploy in produzione seguendo le best practices