import { User, LogOut, Loader2, CheckCircle, XCircle } from "lucide-react";
import PropTypes from "prop-types";

/**
 * Componente DashboardPage - Schermata principale dopo il login
 *
 * @param {Object} props
 * @param {Object} props.user - Dati utente autenticato
 * @param {Function} props.onLogout - Callback per il logout
 * @param {Function} props.onTestAPI - Callback per testare le API protette
 * @param {Object} props.apiResponse - Stato della risposta API
 * @param {boolean} props.apiResponse.loading - Caricamento in corso
 * @param {Object} props.apiResponse.data - Dati ricevuti dall'API
 * @param {string} props.apiResponse.error - Errore dalla chiamata API
 * @param {string} props.apiResponse.lastCall - Timestamp ultima chiamata
 */
const DashboardPage = ({ user, onLogout, onTestAPI, apiResponse }) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-md mx-auto bg-white rounded-xl shadow-lg p-6">
          {/* Header utente */}
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <User className="w-8 h-8 text-green-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-800 mb-2">
              Benvenuto/a!
            </h1>
            <p className="text-gray-600">
              Ciao{" "}
              <strong>
                {user.given_name} {user.family_name}
              </strong>
            </p>
            <p className="text-sm text-gray-500 mt-2">{user.email}</p>
          </div>

          <div className="space-y-4">
            {/* Card informazioni account */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="font-semibold text-gray-800 mb-2">
                Informazioni Account
              </h3>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="font-medium">Nome:</span> {user.given_name}
                </div>
                <div>
                  <span className="font-medium">Cognome:</span>{" "}
                  {user.family_name}
                </div>
                <div>
                  <span className="font-medium">Email:</span> {user.email}
                </div>
                <div>
                  <span className="font-medium">ID Utente:</span>{" "}
                  <span className="text-xs break-all">{user.sub}</span>
                </div>
              </div>
            </div>

            {/* Card test API */}
            <div className="bg-blue-50 rounded-lg p-4">
              <h3 className="font-semibold text-gray-800 mb-3">
                Test API Protette
              </h3>

              <button
                onClick={onTestAPI}
                disabled={apiResponse.loading}
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {apiResponse.loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Caricamento...
                  </>
                ) : (
                  "Testa API Protetta"
                )}
              </button>

              {/* Risposta API - Successo */}
              {apiResponse.data && (
                <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-start gap-2">
                    <div className="flex-shrink-0">
                      <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-green-800 mb-1">
                        {apiResponse.data.message}
                      </p>
                      <p className="text-xs text-green-700 mb-2">
                        {apiResponse.data.data}
                      </p>
                      <div className="text-xs text-green-600 space-y-1">
                        <p>Utente: {apiResponse.data.user?.name}</p>
                        <p>Chiamata effettuata: {apiResponse.lastCall}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Risposta API - Errore */}
              {apiResponse.error && (
                <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-start gap-2">
                    <div className="flex-shrink-0">
                      <XCircle className="w-5 h-5 text-red-600 mt-0.5" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-red-800 mb-1">
                        Errore nella chiamata API
                      </p>
                      <p className="text-xs text-red-700 mb-2">
                        {apiResponse.error}
                      </p>
                      <p className="text-xs text-red-600">
                        Tentativo: {apiResponse.lastCall}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <p className="text-xs text-gray-600 mt-3">
                Questo pulsante testa il refresh automatico dei token e la
                chiamata alle API protette del backend
              </p>
            </div>

            {/* Pulsante logout */}
            <button
              onClick={onLogout}
              className="w-full bg-red-600 text-white py-3 px-4 rounded-lg hover:bg-red-700 transition-colors flex items-center justify-center gap-2"
            >
              <LogOut className="w-5 h-5" />
              Disconnetti
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

DashboardPage.propTypes = {
  user: PropTypes.shape({
    sub: PropTypes.string.isRequired,
    given_name: PropTypes.string.isRequired,
    family_name: PropTypes.string.isRequired,
    email: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
  }).isRequired,
  onLogout: PropTypes.func.isRequired,
  onTestAPI: PropTypes.func.isRequired,
  apiResponse: PropTypes.shape({
    loading: PropTypes.bool.isRequired,
    data: PropTypes.object,
    error: PropTypes.string,
    lastCall: PropTypes.string,
  }).isRequired,
};

export default DashboardPage;
