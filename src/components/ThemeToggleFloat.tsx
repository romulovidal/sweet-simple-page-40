import { Sun, Moon, Coffee } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";

// Alternador de tema como item da navegação inferior (mobile) — nunca flutuante,
// para não cobrir conteúdo nem outros botões. No desktop, o tema fica na sidebar.
const ThemeToggleFloat = () => {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className="flex flex-col items-center gap-0.5 px-3 py-1.5 text-[hsl(var(--dark-muted))] hover:text-[hsl(var(--dark-text))] transition-colors"
      aria-label="Alternar tema"
    >
      {theme === "dark" && <Sun className="w-5 h-5 text-[hsl(var(--streak-orange))]" />}
      {theme === "light" && <Coffee className="w-5 h-5 text-orange-700" />}
      {theme === "sepia" && <Moon className="w-5 h-5 text-[hsl(var(--dark-muted))]" />}
      <span className="text-[10px] font-medium">Tema</span>
    </button>
  );
};

export default ThemeToggleFloat;
