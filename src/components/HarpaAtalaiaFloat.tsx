import { useLocation, useNavigate } from "react-router-dom";
import harpaIcon from "@/assets/harpa-atalaia-icon-v2.png";

const HarpaAtalaiaFloat = () => {
  const location = useLocation();
  const navigate = useNavigate();

  // Só na Home, espelhando o "Pergunte à Bíblia" que fica na direita
  if (location.pathname !== "/") return null;

  return (
    <button
      onClick={() => navigate("/harpa")}
      className="group fixed bottom-24 left-5 lg:bottom-8 lg:left-8 z-50 w-14 h-14 lg:w-16 lg:h-16 rounded-full active:scale-95 transition-all animate-fade-in"
      aria-label="Harpa Cristã Atalaia"
    >
      {/* halo pulsante */}
      <span className="absolute inset-0 rounded-full bg-amber-400/20 blur-xl group-hover:bg-amber-400/30 transition-colors" aria-hidden="true" />
      {/* anel dourado gradiente */}
      <span
        className="absolute inset-0 rounded-full p-[1.5px]"
        style={{ background: "linear-gradient(135deg, #fde68a, #f59e0b 40%, #b45309 80%, #fde68a)" }}
        aria-hidden="true"
      >
        <span className="block w-full h-full rounded-full bg-[hsl(var(--dark-card))]" />
      </span>
      {/* ícone */}
      <span className="relative flex items-center justify-center w-full h-full">
        <img
          src={harpaIcon}
          alt=""
          aria-hidden="true"
          loading="lazy"
          width={48}
          height={48}
          className="w-9 h-9 lg:w-11 lg:h-11 object-contain drop-shadow-[0_0_6px_rgba(251,191,36,0.55)]"
        />
      </span>
    </button>
  );
};

export default HarpaAtalaiaFloat;