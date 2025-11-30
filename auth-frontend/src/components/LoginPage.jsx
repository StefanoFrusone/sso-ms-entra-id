import { Shield } from "lucide-react";
import PropTypes from "prop-types";

/**
 * Componente LoginPage - Schermata di login con Microsoft
 *
 * @param {Object} props
 * @param {Function} props.onLogin - Callback chiamata quando l'utente clicca su "Accedi"
 * @param {string} props.error - Messaggio di errore da mostrare
 * @param {boolean} props.loading - Stato di caricamento
 */
const LoginPage = ({ onLogin, error = "", loading = false }) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
      <div className="max-w-md w-full mx-4">
        <div className="bg-white rounded-xl shadow-lg p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Shield className="w-8 h-8 text-blue-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-800 mb-2">
              Accesso Aziendale
            </h1>
            <p className="text-gray-600">
              Effettua l'accesso con il tuo account Microsoft
            </p>
          </div>

          {/* Messaggio di errore */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}

          {/* Pulsante di login */}
          <button
            onClick={onLogin}
            disabled={loading}
            className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
            </svg>
            {loading ? "Caricamento..." : "Accedi con Microsoft"}
          </button>

          {/* Footer */}
          <div className="mt-6 text-center">
            <p className="text-xs text-gray-500">
              Utilizzando questo servizio accetti i termini e condizioni
              aziendali
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

LoginPage.propTypes = {
  onLogin: PropTypes.func.isRequired,
  error: PropTypes.string,
  loading: PropTypes.bool,
};

export default LoginPage;
