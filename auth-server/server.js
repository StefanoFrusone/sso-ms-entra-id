// server.js
const express = require("express");
const cors = require("cors");
const axios = require("axios");
const jwt = require("jsonwebtoken");
const { v4: uuidv4 } = require("uuid");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Configurazione Microsoft Entra ID
const config = {
  clientId: process.env.CLIENT_ID,
  // clientSecret non necessario per PKCE flow
  tenantId: process.env.TENANT_ID,
  redirectUri: process.env.REDIRECT_URI || "http://localhost:3000",
  authority: `https://login.microsoftonline.com/${process.env.TENANT_ID}`,
  scope: "openid profile email",
  tokenEndpoint: `https://login.microsoftonline.com/${process.env.TENANT_ID}/oauth2/v2.0/token`,
  userInfoEndpoint: "https://graph.microsoft.com/v1.0/me",
};

// Store in memoria per i refresh token (in produzione utilizzare Redis o DB)
const refreshTokenStore = new Map();

// Middleware per validare JWT token (ricevuti dal frontend)
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
    next();
  } catch (err) {
    console.error("Errore verifica token:", err);
    res.status(403).json({ error: "Token non valido" });
  }
};

// Funzione per verificare il token Microsoft
const verifyMicrosoftToken = async (token) => {
  try {
    // Ottieni le chiavi pubbliche di Microsoft
    const keysResponse = await axios.get(
      `https://login.microsoftonline.com/${config.tenantId}/discovery/v2.0/keys`
    );

    // Decodifica l'header del token per ottenere il kid
    const decoded = jwt.decode(token, { complete: true });
    if (!decoded) {
      throw new Error("Token non valido");
    }

    const { kid } = decoded.header;
    const key = keysResponse.data.keys.find((k) => k.kid === kid);

    if (!key) {
      throw new Error("Chiave di verifica non trovata");
    }

    // Costruisci la chiave pubblica
    const publicKey = `-----BEGIN CERTIFICATE-----\n${key.x5c[0]}\n-----END CERTIFICATE-----`;

    // Verifica il token
    const payload = jwt.verify(token, publicKey, {
      algorithms: ["RS256"],
      audience: config.clientId,
      issuer: `https://login.microsoftonline.com/${config.tenantId}/v2.0`,
    });

    return payload;
  } catch (error) {
    throw new Error("Token non valido: " + error.message);
  }
};

// Endpoint per validare il token (opzionale - il frontend può chiamare direttamente Microsoft Graph)
app.get("/api/auth/validate", authenticateToken, async (req, res) => {
  try {
    // Se arriviamo qui, il token è valido
    // Potresti aggiungere qui la logica per i permessi della tua applicazione
    // consultando il tuo database utenti/ruoli

    res.json({
      valid: true,
      user: req.user,
      message: "Token valido",
    });
  } catch (error) {
    console.error("Errore validazione:", error);
    res.status(401).json({ error: "Token non valido o scaduto" });
  }
});

// Endpoint protetto di esempio per le tue API aziendali
app.get("/api/protected", authenticateToken, async (req, res) => {
  try {
    // Qui puoi implementare la logica di autorizzazione specifica della tua app
    // Ad esempio: controllare ruoli/permessi nel database

    const userId = req.user.sub; // ID utente da Microsoft

    // Esempio: controlla permessi nel tuo database
    // const userPermissions = await getUserPermissions(userId);
    // if (!userPermissions.includes('read_data')) {
    //   return res.status(403).json({ error: 'Permessi insufficienti' });
    // }

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

// Cleanup periodico dei refresh token scaduti
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of refreshTokenStore.entries()) {
    if (now > value.expiresAt) {
      refreshTokenStore.delete(key);
    }
  }
}, 60 * 60 * 1000); // Ogni ora

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "OK", timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Server in ascolto sulla porta ${PORT}`);
  console.log("Endpoints disponibili:");
  console.log("- POST /api/auth/callback");
  console.log("- GET /api/auth/validate");
  console.log("- POST /api/auth/refresh");
  console.log("- POST /api/auth/logout");
  console.log("- GET /api/protected");
  console.log("- GET /health");
});

module.exports = app;
