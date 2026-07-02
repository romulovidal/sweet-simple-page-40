import { LayoutDashboard, Book, Library, Rocket, UserRound, BookOpen } from "lucide-react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { Sun, Moon, Coffee } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";

const tabs = [
  { to: "/", icon: LayoutDashboard, label: "Início", tour: "nav-home" },
  { to: "/biblia", icon: Book, label: "Bíblia", tour: "nav-bible" },
  { to: "/planos", icon: Library, label: "Planos", tour: "nav-plans" },
  { to: "/descubra", icon: Rocket, label: "Explore", tour: "nav-discover" },
  { to: "/perfil", icon: UserRound, label: "Perfil", tour: "nav-profile" },
];

const DesktopSidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();

  const handleClick = (to: string, e: React.MouseEvent) => {
    const isCurrent = to === "/" ? location.pathname === "/" : location.pathname.startsWith(to) && to !== "/";
    if (isCurrent) {
      e.preventDefault();
      if (to === "/biblia") {
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        navigate(to, { replace: true, state: { reset: Date.now() } });
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    }
  };

  return (
    <aside className="fixed left-0 top-0 bottom-0 w-64 z-40 bg-[hsl(var(--dark-card))] border-r border-[hsl(var(--dark-card-hover))] flex flex-col">
      {/* Brand */}
      <div className="px-6 pt-8 pb-6 flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
          <BookOpen className="w-5 h-5 text-amber-950" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold leading-tight">Bíblia do</p>
          <p className="text-sm font-bold leading-tight bg-gradient-to-r from-amber-300 to-amber-500 bg-clip-text text-transparent">Atalaia</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 flex flex-col gap-1">
        {tabs.map(({ to, icon: Icon, label, tour }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            data-tour={tour}
            onClick={(e) => handleClick(to, e)}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
                isActive
                  ? "bg-[hsl(var(--dark-card-hover))] text-[hsl(var(--dark-text))] shadow-sm"
                  : "text-[hsl(var(--dark-muted))] hover:bg-[hsl(var(--dark-card-hover))]/60 hover:text-[hsl(var(--dark-text))]"
              }`
            }
          >
            <Icon className="w-5 h-5 shrink-0" />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Theme toggle */}
      <div className="p-3 border-t border-[hsl(var(--dark-card-hover))]">
        <button
          onClick={toggleTheme}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold text-[hsl(var(--dark-muted))] hover:bg-[hsl(var(--dark-card-hover))]/60 hover:text-[hsl(var(--dark-text))] transition-all"
          aria-label="Alternar tema"
        >
          {theme === "dark" && <Sun className="w-5 h-5 text-[hsl(var(--streak-orange))]" />}
          {theme === "light" && <Coffee className="w-5 h-5 text-orange-700" />}
          {theme === "sepia" && <Moon className="w-5 h-5 text-[hsl(var(--dark-muted))]" />}
          <span className="capitalize">{theme === "dark" ? "Escuro" : theme === "light" ? "Claro" : "Sépia"}</span>
        </button>
      </div>
    </aside>
  );
};

export default DesktopSidebar;