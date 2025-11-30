import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { apiService } from "../services/apiService";
import { authService } from "../services/authService";

// Stato iniziale
const initialState = {
  loading: false,
  data: null,
  error: null,
  lastCall: null,
};

// Thunk async per chiamare API protette
export const callProtectedAPI = createAsyncThunk(
  "api/callProtectedAPI",
  async (_, { rejectWithValue, dispatch }) => {
    try {
      const data = await apiService.callProtectedEndpoint();
      return data;
    } catch (error) {
      // Se l'errore è 401/403, potrebbe essere necessario fare logout
      if (error.message.includes("Sessione scaduta")) {
        // Il refresh ha fallito, forza logout
        dispatch({ type: "auth/quickLogout" });
      }
      return rejectWithValue(error.message || "Errore nella chiamata API");
    }
  }
);

// Slice Redux
const apiSlice = createSlice({
  name: "api",
  initialState,
  reducers: {
    // Reset dello stato API
    resetApiState: (state) => {
      state.loading = false;
      state.data = null;
      state.error = null;
      state.lastCall = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(callProtectedAPI.pending, (state) => {
        state.loading = true;
        state.data = null;
        state.error = null;
        state.lastCall = null;
      })
      .addCase(callProtectedAPI.fulfilled, (state, action) => {
        state.loading = false;
        state.data = action.payload;
        state.error = null;
        state.lastCall = new Date().toLocaleTimeString();
      })
      .addCase(callProtectedAPI.rejected, (state, action) => {
        state.loading = false;
        state.data = null;
        state.error = action.payload;
        state.lastCall = new Date().toLocaleTimeString();
      });
  },
});

export const { resetApiState } = apiSlice.actions;
export default apiSlice.reducer;
