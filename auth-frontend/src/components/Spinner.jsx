import { Loader2 } from "lucide-react";
import PropTypes from "prop-types";

/**
 * Componente Spinner riutilizzabile con varianti personalizzabili
 *
 * @param {Object} props
 * @param {string} props.size - Dimensione: 'sm', 'md', 'lg', 'xl'
 * @param {string} props.variant - Variante colore: 'primary', 'secondary', 'success', 'danger', 'white'
 * @param {string} props.text - Testo da mostrare sotto lo spinner
 * @param {boolean} props.fullScreen - Se true, occupa tutto lo schermo
 * @param {string} props.className - Classi CSS aggiuntive
 */
const Spinner = ({
  size = "md",
  variant = "primary",
  text = "",
  fullScreen = false,
  className = "",
}) => {
  // Mappa dimensioni
  const sizeClasses = {
    sm: "w-4 h-4",
    md: "w-8 h-8",
    lg: "w-12 h-12",
    xl: "w-16 h-16",
  };

  // Mappa varianti colore
  const variantClasses = {
    primary: "text-blue-600",
    secondary: "text-gray-600",
    success: "text-green-600",
    danger: "text-red-600",
    white: "text-white",
  };

  const spinnerClasses = `${sizeClasses[size]} ${variantClasses[variant]} animate-spin ${className}`;

  // Contenuto dello spinner
  const spinnerContent = (
    <div className="text-center">
      <Loader2 className={spinnerClasses} />
      {text && (
        <p className={`mt-4 ${variantClasses[variant]} font-medium`}>{text}</p>
      )}
    </div>
  );

  // Se fullScreen, mostra come overlay
  if (fullScreen) {
    return (
      <div className="fixed inset-0 bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center z-50">
        {spinnerContent}
      </div>
    );
  }

  // Altrimenti, mostra inline
  return (
    <div className="flex items-center justify-center">{spinnerContent}</div>
  );
};

Spinner.propTypes = {
  size: PropTypes.oneOf(["sm", "md", "lg", "xl"]),
  variant: PropTypes.oneOf([
    "primary",
    "secondary",
    "success",
    "danger",
    "white",
  ]),
  text: PropTypes.string,
  fullScreen: PropTypes.bool,
  className: PropTypes.string,
};

export default Spinner;
