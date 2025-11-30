import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  checkAuthStatus,
  login,
  handleCallback,
  logout,
  quickLogout,
} from "./store/authSlice";
import { callProtectedAPI } from "./store/apiSlice";
import { authService } from "./services/authService";
import Spinner from "./components/Spinner";
import LoginPage from "./components/LoginPage";
import DashboardPage from "./components/DashboardPage";

const App = () => {
  const dispatch = useDispatch();

  // Selettori Redux
  const { isAuthenticated, user, loading, error } = useSelector(
    (state) => state.auth
  );
  const apiResponse = useSelector((state) => state.api);

  // Verifica autenticazione all'avvio
  useEffect(() => {
    // Controlla se stiamo tornando da un logout
    if (authService.isReturningFromLogout()) {
      // Pulizia completa dopo logout Microsoft
      dispatch(quickLogout());
      window.history.replaceState({}, document.title, window.location.pathname);
      return;
    }

    // Controlla se c'è un authorization code nell'URL
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get("code");
    const state = urlParams.get("state");
    const error = urlParams.get("error");

    if (error) {
      console.error("Errore di autenticazione:", error);
      return;
    }

    if (code && !isAuthenticated) {
      // Verifica state per protezione CSRF
      if (!authService.verifyState(state)) {
        console.error("State non valido - possibile attacco CSRF");
        return;
      }

      // Gestisci il callback OAuth
      dispatch(handleCallback(code));
    } else {
      // Verifica stato di autenticazione esistente
      dispatch(checkAuthStatus());
    }
  }, [dispatch, isAuthenticated]);

  // Handler per il login
  const handleLogin = () => {
    dispatch(login());
  };

  // Handler per il logout
  const handleLogout = () => {
    dispatch(logout());
  };

  // Handler per testare le API
  const handleTestAPI = () => {
    dispatch(callProtectedAPI());
  };

  // Mostra spinner durante il caricamento iniziale
  if (loading && !isAuthenticated && !error) {
    return <Spinner size="lg" text="Caricamento..." fullScreen />;
  }

  // Mostra dashboard se autenticato
  if (isAuthenticated && user) {
    return (
      <DashboardPage
        user={user}
        onLogout={handleLogout}
        onTestAPI={handleTestAPI}
        apiResponse={apiResponse}
      />
    );
  }

  // Mostra pagina di login
  return <LoginPage onLogin={handleLogin} error={error} loading={loading} />;
};

export default App;
