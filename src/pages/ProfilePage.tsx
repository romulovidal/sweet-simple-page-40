import { Settings, BookmarkCheck, Heart, Clock, ChevronRight, Flame } from "lucide-react";

const menuItems = [
  { icon: BookmarkCheck, label: "Versículos salvos", count: 12 },
  { icon: Heart, label: "Favoritos", count: 8 },
  { icon: Clock, label: "Histórico de leitura", count: null },
  { icon: Settings, label: "Configurações", count: null },
];

const ProfilePage = () => {
  return (
    <div className="pb-20 min-h-screen">
      <header className="px-5 pt-12 pb-6">
        <h1 className="text-2xl font-bold">Você</h1>
      </header>

      {/* Profile card */}
      <div className="px-5 mb-6">
        <div className="bg-[hsl(var(--dark-card))] rounded-2xl p-5 flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center text-2xl">
            🙏
          </div>
          <div>
            <p className="font-bold text-lg">Leitor da Palavra</p>
            <p className="text-sm text-[hsl(var(--dark-muted))]">Membro desde 2026</p>
          </div>
        </div>
      </div>

      {/* Streak card */}
      <div className="px-5 mb-6">
        <div className="bg-gradient-to-r from-[hsl(25,95%,50%)] to-[hsl(35,95%,55%)] rounded-2xl p-5 text-white">
          <div className="flex items-center gap-2 mb-2">
            <Flame className="w-6 h-6" />
            <span className="text-2xl font-bold">3 dias</span>
          </div>
          <p className="text-sm opacity-90">Sua ofensiva de leitura</p>
          <div className="flex gap-1 mt-3">
            {["S", "T", "Q", "Q", "S", "S", "D"].map((day, i) => (
              <div
                key={i}
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold ${
                  i < 3 ? "bg-white/30" : "bg-white/10"
                }`}
              >
                {day}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Menu */}
      <div className="px-5 space-y-1">
        {menuItems.map(({ icon: Icon, label, count }) => (
          <button
            key={label}
            className="w-full flex items-center gap-4 py-4 px-4 rounded-xl active:bg-[hsl(var(--dark-card))] transition-colors text-left"
          >
            <Icon className="w-5 h-5 text-[hsl(var(--dark-muted))]" />
            <span className="flex-1 text-sm font-medium">{label}</span>
            {count !== null && (
              <span className="text-xs text-[hsl(var(--dark-muted))]">{count}</span>
            )}
            <ChevronRight className="w-4 h-4 text-[hsl(var(--dark-muted))]" />
          </button>
        ))}
      </div>
    </div>
  );
};

export default ProfilePage;
