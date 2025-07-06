# Microsoft Entra ID Authentication - Full Stack

Sistema completo di autenticazione aziendale con Microsoft Entra ID, sviluppato con React (frontend) e Node.js (backend).

## 🏗️ Architettura

```
microsoft-entra-auth-fullstack/
├── package.json                    # Launcher e script principali
├── README.md                       # Questa documentazione
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

# Crea il package.json principale (copia il contenuto fornito)
# Installa concurrently
npm install

# Setup completo di entrambi i progetti
npm run setup
```

### 2. Configurazione Microsoft Entra ID

1. Vai su [portal.azure.com](https://portal.azure.com)
2. Registra una **Single-page application**
3. Ottieni `CLIENT_ID` e `TENANT_ID`
4. Configura redirect URI: `http://localhost:3000`

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

1. **Frontend React**:

   - Login con Authorization Code + PKCE
   - Gestione automatica dei token
   - Interfaccia utente moderna

2. **Backend Node.js**:

   - Validazione JWT sicura
   - API protette
   - Gestione refresh token

3. **Microsoft Entra ID**:
   - Autenticazione SSO aziendale
   - Token sicuri
   - Integrazione seamless

## 🔒 Sicurezza implementata

- ✅ **PKCE Flow**: Standard moderno per SPA
- ✅ **JWT Validation**: Verifica con chiavi pubbliche Microsoft
- ✅ **CSRF Protection**: State parameter validation
- ✅ **Token Management**: Refresh automatico
- ✅ **CORS**: Configurazione sicura

## 🛠️ Tecnologie utilizzate

### Frontend

- React 18 + Vite
- Tailwind CSS
- Lucide React (icone)
- Web Crypto API (PKCE)

### Backend

- Node.js + Express
- Axios (HTTP client)
- jsonwebtoken (JWT validation)
- CORS middleware

## 📁 Struttura dettagliata

```
microsoft-entra-auth-fullstack/
├── package.json                    # Script launcher principali
├── README.md                       # Documentazione principale
│
├── auth-frontend/                  # Frontend React
│   ├── package.json               # Dipendenze React + Vite
│   ├── vite.config.js             # Configurazione Vite
│   ├── tailwind.config.js         # Configurazione Tailwind
│   ├── index.html                 # Template HTML
│   ├── .env                       # Variabili ambiente frontend
│   └── src/
│       ├── main.jsx               # Entry point
│       ├── App.jsx                # Componente principale
│       └── index.css              # Stili globali
│
└── auth-server/                   # Backend Node.js
    ├── package.json               # Dipendenze Express + JWT
    ├── server.js                  # Server API principale
    ├── .env                       # Variabili ambiente backend
    └── .gitignore                 # File da ignorare
```

## 🚀 Deployment

### Sviluppo locale

```bash
npm run dev    # Frontend: :3000, Backend: :3001
```

### Produzione

```bash
# Build frontend
npm run build

# Deploy frontend (dist/) su CDN/hosting statico
# Deploy backend su server Node.js
npm run build:server
```

## 🐛 Troubleshooting

### Problemi comuni

- **CORS errors**: Verifica che il backend sia avviato su porta 3001
- **Token invalid**: Controlla CLIENT_ID e TENANT_ID in entrambi i .env
- **Redirect mismatch**: Verifica redirect URI in Azure e .env

### Log e debug

```bash
# Log backend
cd auth-server && npm run dev

# Log frontend
cd auth-frontend && npm run dev
```

## 📞 Supporto

- **Frontend issues**: Vedi `auth-frontend/README.md`
- **Backend issues**: Vedi `auth-server/README.md`
- **Azure config**: Documentazione Microsoft Entra ID

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

---

**Pronto per iniziare!** Esegui `npm run dev` e vai su http://localhost:3000 🚀
