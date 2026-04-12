import { Home, BookOpen, CalendarDays, Compass, User } from "lucide-react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";

const tabs = [
  { to: "/", icon: Home, label: "Início" },
  { to: "/biblia", icon: BookOpen, label: "Bíblia" },
  { to: "/planos", icon: CalendarDays, label: "Planos" },
  { to: "/descubra", icon: Compass, label: "Descubra" },
  { to: "/perfil", icon: User, label: "Você" },
];

const BottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const handleTabClick = (to: string, e: React.MouseEvent) => {
    const isCurrentRoute = to === "/" ? location.pathname === "/" : location.pathname.startsWith(to) && to !== "/";
    if (isCurrentRoute) {
      e.preventDefault();
      if (to === "/biblia") {
        // Bible: just scroll to top, keep state (last read position)
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        // Other tabs: full reset to root
        navigate(to, { replace: true, state: { reset: Date.now() } });
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    }
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-[hsl(var(--dark-card))] border-t border-[hsl(var(--dark-card-hover))] safe-area-bottom">
      <div className="flex items-center justify-around max-w-lg mx-auto h-16">
        {tabs.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            onClick={(e) => handleTabClick(to, e)}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 px-3 py-1.5 transition-colors ${
                isActive ? "text-[hsl(var(--dark-text))]" : "text-[hsl(var(--dark-muted))]"
              }`
            }
          >
            <Icon className="w-5 h-5" />
            <span className="text-[10px] font-medium">{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
};

export default BottomNav;
