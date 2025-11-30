import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { authService } from "../services/authService";

// Stato iniziale
const initialState = {
  isAuthenticated: false,
  user: null,
  loading: false,
  error: null,
};

// Thunk async per verificare lo stato di autenticazione
export const checkAuthStatus = createAsyncThunk(
  "auth/checkAuthStatus",
  async (_, { rejectWithValue }) => {
    try {
      const token = localStorage.getItem("access_token");
      if (!token) {
        return { isAuthenticated: false, user: null };
      }

      const user = await authService.validateToken(token);
      return { isAuthenticated: true, user };
    } catch (error) {
      // Token non valido, prova il refresh
      const refreshToken = localStorage.getItem("refresh_token");
      if (refreshToken) {
        try {
          await authService.refreshToken(refreshToken);
          const newToken = localStorage.getItem("access_token");
          const user = await authService.validateToken(newToken);
          return { isAuthenticated: true, user };
        } catch (refreshError) {
          localStorage.removeItem("access_token");
          localStorage.removeItem("refresh_token");
          return rejectWithValue("Sessione scaduta");
        }
      }

      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
      return rejectWithValue("Token non valido");
    }
  }
);

// Thunk async per il login
export const login = createAsyncThunk(
  "auth/login",
  async (_, { rejectWithValue }) => {
    try {
      await authService.initiateLogin();
      // Il redirect a Microsoft avverrà, quindi questo non ritornerà mai
      return null;
    } catch (error) {
      return rejectWithValue(error.message || "Errore durante il login");
    }
  }
);

// Thunk async per gestire il callback OAuth
export const handleCallback = createAsyncThunk(
  "auth/handleCallback",
  async (code, { rejectWithValue }) => {
    try {
      const { user } = await authService.handleAuthCallback(code);
      return { user };
    } catch (error) {
      return rejectWithValue(
        error.message || "Errore durante l'autenticazione"
      );
    }
  }
);

// Thunk async per il logout
export const logout = createAsyncThunk(
  "auth/logout",
  async (_, { rejectWithValue }) => {
    try {
      await authService.logout();
      // Il redirect a Microsoft avverrà
      return null;
    } catch (error) {
      // Anche se il logout Microsoft fallisce, pulisci locale
      authService.quickLogout();
      return rejectWithValue(error.message || "Errore durante il logout");
    }
  }
);

// Slice Redux
const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    // Azione per pulire l'errore
    clearError: (state) => {
      state.error = null;
    },
    // Azione per logout rapido (solo locale)
    quickLogout: (state) => {
      state.isAuthenticated = false;
      state.user = null;
      state.error = null;
      authService.quickLogout();
    },
  },
  extraReducers: (builder) => {
    builder
      // checkAuthStatus
      .addCase(checkAuthStatus.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(checkAuthStatus.fulfilled, (state, action) => {
        state.loading = false;
        state.isAuthenticated = action.payload.isAuthenticated;
        state.user = action.payload.user;
        state.error = null;
      })
      .addCase(checkAuthStatus.rejected, (state, action) => {
        state.loading = false;
        state.isAuthenticated = false;
        state.user = null;
        state.error = action.payload;
      })

      // login
      .addCase(login.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(login.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // handleCallback
      .addCase(handleCallback.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(handleCallback.fulfilled, (state, action) => {
        state.loading = false;
        state.isAuthenticated = true;
        state.user = action.payload.user;
        state.error = null;
      })
      .addCase(handleCallback.rejected, (state, action) => {
        state.loading = false;
        state.isAuthenticated = false;
        state.user = null;
        state.error = action.payload;
      })

      // logout
      .addCase(logout.pending, (state) => {
        state.loading = true;
      })
      .addCase(logout.fulfilled, (state) => {
        state.loading = false;
        state.isAuthenticated = false;
        state.user = null;
        state.error = null;
      })
      .addCase(logout.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
        // Forza logout locale anche se Microsoft fallisce
        state.isAuthenticated = false;
        state.user = null;
      });
  },
});

export const { clearError, quickLogout } = authSlice.actions;
export default authSlice.reducer;
