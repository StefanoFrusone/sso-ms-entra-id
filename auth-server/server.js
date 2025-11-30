const express = require("express");
const cors = require("cors");
const axios = require("axios");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
  })
);
app.use(express.json());

// Middleware per validare token tramite Microsoft Graph
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "Token di accesso richiesto" });
  }

  try {
    // Verifica il token chiamando Microsoft Graph
    const response = await axios.get("https://graph.microsoft.com/v1.0/me", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    // Token valido, salva i dati utente nella request
    req.user = {
      sub: response.data.id,
      email: response.data.mail || response.data.userPrincipalName,
      name: response.data.displayName,
      given_name: response.data.givenName,
      family_name: response.data.surname,
    };

    next();
  } catch (err) {
    console.error("Errore verifica token:", err.response?.status, err.message);
    res.status(403).json({ error: "Token non valido o scaduto" });
  }
};

// Endpoint per validare il token
app.get("/api/auth/validate", authenticateToken, async (req, res) => {
  res.json({
    valid: true,
    user: req.user,
    message: "Token valido",
  });
});

// Endpoint protetto di esempio
app.get("/api/protected", authenticateToken, async (req, res) => {
  res.json({
    message: "Accesso autorizzato ai dati protetti",
    user: req.user,
    data: "Questi sono i tuoi dati aziendali protetti",
  });
});

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "OK", timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Server in ascolto sulla porta ${PORT}`);
  console.log("Endpoints disponibili:");
  console.log("- GET /api/auth/validate");
  console.log("- GET /api/protected");
  console.log("- GET /health");
});

module.exports = app;
