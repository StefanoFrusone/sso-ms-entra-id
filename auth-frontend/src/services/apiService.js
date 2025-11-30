import { authService } from "./authService";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:3001";

/**
 * Servizio per chiamate API al backend
 * Gestisce automaticamente il refresh dei token
 */
class ApiService {
  /**
   * Wrapper per fetch con gestione automatica del refresh token
   */
  async apiCall(url, options = {}) {
    const token = localStorage.getItem("access_token");

    if (!token) {
      throw new Error("Nessun token disponibile");
    }

    // Primo tentativo con token corrente
    let response = await fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        Authorization: `Bearer ${token}`,
      },
    });

    // Se token scaduto (401/403), prova il refresh
    if (response.status === 401 || response.status === 403) {
      console.log("Token scaduto, tentativo refresh...");

      const refreshToken = localStorage.getItem("refresh_token");

      try {
        // Refresh del token
        await authService.refreshToken(refreshToken);

        // Riprova la chiamata con il nuovo token
        const newToken = localStorage.getItem("access_token");
        response = await fetch(url, {
          ...options,
          headers: {
            ...options.headers,
            Authorization: `Bearer ${newToken}`,
          },
        });
      } catch (refreshError) {
        // Refresh fallito, l'utente deve rifare login
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
        throw new Error("Sessione scaduta, effettua nuovamente il login");
      }
    }

    return response;
  }

  /**
   * Chiama l'endpoint protetto di esempio
   */
  async callProtectedEndpoint() {
    try {
      const response = await this.apiCall(`${API_BASE_URL}/api/protected`);

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ error: "Errore sconosciuto" }));
        throw new Error(errorData.error || `Errore ${response.status}`);
      }

      const data = await response.json();
      console.log("✅ Dati ricevuti:", data);
      return data;
    } catch (error) {
      console.error("❌ Errore API:", error);
      throw error;
    }
  }

  /**
   * Metodo generico per GET
   */
  async get(endpoint) {
    return this.apiCall(`${API_BASE_URL}${endpoint}`, {
      method: "GET",
    });
  }

  /**
   * Metodo generico per POST
   */
  async post(endpoint, data) {
    return this.apiCall(`${API_BASE_URL}${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });
  }

  /**
   * Metodo generico per PUT
   */
  async put(endpoint, data) {
    return this.apiCall(`${API_BASE_URL}${endpoint}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });
  }

  /**
   * Metodo generico per DELETE
   */
  async delete(endpoint) {
    return this.apiCall(`${API_BASE_URL}${endpoint}`, {
      method: "DELETE",
    });
  }
}

export const apiService = new ApiService();
