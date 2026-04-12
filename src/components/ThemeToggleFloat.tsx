import { Sun, Moon } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";

const ThemeToggleFloat = () => {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className="fixed top-3 right-3 z-50 w-9 h-9 rounded-full bg-[hsl(var(--dark-card))] flex items-center justify-center shadow-lg transition-colors"
      aria-label="Alternar tema"
    >
      {theme === "dark" ? (
        <Sun className="w-4 h-4 text-[hsl(var(--streak-orange))]" />
      ) : (
        <Moon className="w-4 h-4 text-[hsl(var(--dark-muted))]" />
      )}
    </button>
  );
};

export default ThemeToggleFloat;
