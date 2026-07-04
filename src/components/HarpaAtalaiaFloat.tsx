import { useLocation, useNavigate } from "react-router-dom";
import harpaIcon from "@/assets/harpa-atalaia-icon.png";

const HarpaAtalaiaFloat = () => {
  const location = useLocation();
  const navigate = useNavigate();

  // Só na Home, espelhando o "Pergunte à Bíblia" que fica na direita
  if (location.pathname !== "/") return null;

  return (
    <button
      onClick={() => navigate("/harpa")}
      className="fixed bottom-24 left-5 lg:bottom-8 lg:left-8 lg:w-14 lg:h-14 z-50 w-12 h-12 rounded-full bg-[hsl(var(--dark-card))] border border-amber-500/30 shadow-lg shadow-amber-500/10 active:scale-95 transition-all animate-fade-in flex items-center justify-center overflow-hidden"
      aria-label="Harpa Cristã Atalaia"
    >
      <img
        src={harpaIcon}
        alt=""
        aria-hidden="true"
        loading="lazy"
        width={40}
        height={40}
        className="w-8 h-8 lg:w-10 lg:h-10 object-contain"
      />
    </button>
  );
};

export default HarpaAtalaiaFloat;