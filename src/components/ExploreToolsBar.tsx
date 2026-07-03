import { History, MapPin, Users } from "lucide-react";

interface Props {
  className?: string;
}

const tools = [
  {
    event: "open-visual-timeline",
    label: "Linha do Tempo",
    icon: History,
    color: "38 92% 55%", // âmbar
  },
  {
    event: "open-biblical-maps",
    label: "Mapas",
    icon: MapPin,
    color: "142 71% 45%", // verde
  },
  {
    event: "open-bible-characters",
    label: "Personagens",
    icon: Users,
    color: "217 91% 60%", // azul
  },
];

const ExploreToolsBar = ({ className = "" }: Props) => {
  return (
    <div className={className}>
      <div className="grid grid-cols-3 gap-2">
        {tools.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.event}
              onClick={() => window.dispatchEvent(new CustomEvent(t.event))}
              className="group flex flex-col items-center justify-center gap-1.5 py-3 px-2 rounded-2xl bg-[hsl(var(--dark-card))] hover:bg-[hsl(var(--dark-card-hover))] active:scale-95 transition-all"
              style={{
                border: `1px solid hsl(${t.color} / 0.25)`,
                boxShadow: `0 4px 14px -8px hsl(${t.color} / 0.35)`,
              }}
              aria-label={t.label}
            >
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center"
                style={{
                  background: `linear-gradient(135deg, hsl(${t.color}) 0%, hsl(${t.color} / 0.65) 100%)`,
                }}
              >
                <Icon className="w-4 h-4 text-white" />
              </div>
              <span className="text-[11px] font-semibold text-[hsl(var(--dark-text))] leading-tight text-center">
                {t.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default ExploreToolsBar;