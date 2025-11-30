import { configureStore } from "@reduxjs/toolkit";
import authReducer from "./authSlice";
import apiReducer from "./apiSlice";

export const store = configureStore({
  reducer: {
    auth: authReducer,
    api: apiReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // Ignora queste action types nella serialization check
        ignoredActions: ["auth/login/pending", "auth/logout/pending"],
      },
    }),
});

export default store;
