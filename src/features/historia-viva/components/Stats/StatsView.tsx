import { useEffect, useMemo, useState } from "react";
import { useSession, useQuizAttempts, fetchAllPlanProgress } from "../../hooks/useCloudSync";
import { useFavorites } from "../../hooks/useFavorites";
import { PERIODS } from "../../data/periods";
import { CHARACTERS } from "../../data/characters";
import { PLANS } from "../../data/plans";
import { QUIZZES } from "../../data/quizzes";
import { Trophy, Heart, Calendar, Sparkles, MapPin, BookOpen, Award } from "lucide-react";

const StatsView = () => {
  const userId = useSession();
  const { attempts } = useQuizAttempts(userId);
  const { favs, list } = useFavorites();
  const [planRows, setPlanRows] = useState<any[]>([]);

  useEffect(() => {
    if (!userId) { setPlanRows([]); return; }
    fetchAllPlanProgress(userId).then((rs) => setPlanRows(rs));
  }, [userId]);

  const favList = list();

  // Quiz stats
  const quizStats = useMemo(() => {
    const totalRuns = attempts.length;
    const avgPct = totalRuns ? Math.round(attempts.reduce((s, a) => s + (a.score / Math.max(1, a.total)) * 100, 0) / totalRuns) : 0;
    const perQuiz: Record<string, { best: number; runs: number }> = {};
    attempts.forEach((a) => {
      const pct = Math.round((a.score / Math.max(1, a.total)) * 100);
      const cur = perQuiz[a.quiz_id] ?? { best: 0, runs: 0 };
      perQuiz[a.quiz_id] = { best: Math.max(cur.best, pct), runs: cur.runs + 1 };
    });
    const bestQuiz = Object.entries(perQuiz).sort((a, b) => b[1].best - a[1].best)[0];
    return { totalRuns, avgPct, perQuiz, bestQuiz };
  }, [attempts]);

  // Period exposure via favorites
  const perPeriod = useMemo(() => {
    const m: Record<string, number> = {};
    favList.filter((f) => f.kind === "character").forEach((f) => {
      const c = CHARACTERS.find((c) => c.id === f.id);
      if (c) m[c.periodId] = (m[c.periodId] ?? 0) + 1;
    });
    return m;
  }, [favList]);
  const periodMax = Math.max(1, ...Object.values(perPeriod));

  // Plan progress
  const planStats = useMemo(() => {
    const per: Record<string, number> = {};
    planRows.forEach((r) => { per[r.plan_id] = (per[r.plan_id] ?? 0) + 1; });
    return per;
  }, [planRows]);

  const charsFav = favList.filter((f) => f.kind === "character").length;
  const placesFav = favList.filter((f) => f.kind === "place").length;
  const booksFav = favList.filter((f) => f.kind === "book").length;

  // Badges
  const badges = [
    { id: "b1", label: "Primeiro Quiz", icon: "🎯", done: quizStats.totalRuns >= 1 },
    { id: "b2", label: "10 Favoritos", icon: "❤️", done: favList.length >= 10 },
    { id: "b3", label: "3 Quizzes diferentes", icon: "🧠", done: Object.keys(quizStats.perQuiz).length >= 3 },
    { id: "b4", label: "7 dias de plano", icon: "📅", done: Object.values(planStats).some((v) => v >= 7) },
    { id: "b5", label: "Ouro em um quiz", icon: "🥇", done: attempts.some((a) => a.score / Math.max(1, a.total) >= 0.9) },
  ];

  return (
    <div className="p-4 space-y-4">
      {!userId && (
        <div className="rounded-xl bg-dark-card p-3 text-[12px] text-dark-muted border border-primary/20">
          Estatísticas ficam mais completas quando você entra com sua conta.
        </div>
      )}

      {/* Overview cards */}
      <div className="grid grid-cols-2 gap-2">
        <StatCard icon={<Heart className="w-4 h-4" />} label="Favoritos" value={favList.length} color="0 84% 60%" />
        <StatCard icon={<Trophy className="w-4 h-4" />} label="Tentativas quiz" value={quizStats.totalRuns} color="38 92% 55%" />
        <StatCard icon={<Sparkles className="w-4 h-4" />} label="Média quiz" value={`${quizStats.avgPct}%`} color="271 76% 53%" />
        <StatCard icon={<Calendar className="w-4 h-4" />} label="Dias plano" value={planRows.length} color="217 91% 60%" />
      </div>

      {/* Best quiz */}
      <section className="rounded-2xl bg-dark-card p-3">
        <h3 className="text-[11px] font-bold uppercase tracking-widest text-dark-muted mb-2">Melhor quiz</h3>
        {quizStats.bestQuiz ? (
          <div className="flex items-center gap-3">
            <span className="w-11 h-11 rounded-xl flex items-center justify-center text-2xl" style={{ background: "hsl(38 92% 55% / 0.2)" }}>
              {QUIZZES.find((q) => q.id === quizStats.bestQuiz![0])?.icon ?? "🏆"}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-dark-text truncate">{QUIZZES.find((q) => q.id === quizStats.bestQuiz![0])?.title}</p>
              <p className="text-[11px] text-dark-muted">{quizStats.bestQuiz[1].best}% em {quizStats.bestQuiz[1].runs} tentativa(s)</p>
            </div>
          </div>
        ) : (
          <p className="text-[12px] text-dark-muted">Faça seu primeiro quiz para ver o histórico aqui.</p>
        )}
      </section>

      {/* Períodos */}
      <section className="rounded-2xl bg-dark-card p-3">
        <h3 className="text-[11px] font-bold uppercase tracking-widest text-dark-muted mb-2">Períodos favoritados</h3>
        <div className="space-y-1.5">
          {PERIODS.map((p) => {
            const v = perPeriod[p.id] ?? 0;
            const w = (v / periodMax) * 100;
            return (
              <div key={p.id} className="flex items-center gap-2">
                <span className="text-[10px] w-24 truncate text-dark-text">{p.icon} {p.name}</span>
                <div className="flex-1 h-2 rounded-full bg-dark-card-hover overflow-hidden">
                  <div className="h-full transition-all" style={{ width: `${w}%`, background: `hsl(${p.color})` }} />
                </div>
                <span className="text-[10px] font-bold text-dark-muted w-6 text-right">{v}</span>
              </div>
            );
          })}
        </div>
      </section>

      {/* Últimas tentativas */}
      {attempts.length > 0 && (
        <section className="rounded-2xl bg-dark-card p-3">
          <h3 className="text-[11px] font-bold uppercase tracking-widest text-dark-muted mb-2">Últimas 10 tentativas</h3>
          <Sparkline values={attempts.slice(0, 10).reverse().map((a) => Math.round((a.score / Math.max(1, a.total)) * 100))} />
        </section>
      )}

      {/* Planos */}
      <section className="rounded-2xl bg-dark-card p-3">
        <h3 className="text-[11px] font-bold uppercase tracking-widest text-dark-muted mb-2">Planos em andamento</h3>
        {Object.keys(planStats).length === 0 ? (
          <p className="text-[12px] text-dark-muted">Nenhum dia registrado ainda.</p>
        ) : (
          <div className="space-y-2">
            {Object.entries(planStats).map(([pid, d]) => {
              const plan = PLANS.find((p) => p.id === pid);
              if (!plan) return null;
              const pct = Math.round((d / plan.days.length) * 100);
              const color = plan.color ?? "217 91% 60%";
              return (
                <div key={pid}>
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="font-bold text-dark-text truncate">{plan.icon} {plan.title}</span>
                    <span className="text-dark-muted">{d}/{plan.days.length} · {pct}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-dark-card-hover overflow-hidden">
                    <div className="h-full" style={{ width: `${pct}%`, background: `hsl(${color})` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Coleções */}
      <section className="grid grid-cols-3 gap-2">
        <MiniCard icon={<MapPin className="w-4 h-4" />} label="Lugares" value={placesFav} />
        <MiniCard icon={<BookOpen className="w-4 h-4" />} label="Livros" value={booksFav} />
        <MiniCard icon={<Sparkles className="w-4 h-4" />} label="Personagens" value={charsFav} />
      </section>

      {/* Badges */}
      <section className="rounded-2xl bg-dark-card p-3">
        <h3 className="text-[11px] font-bold uppercase tracking-widest text-dark-muted mb-2 flex items-center gap-1.5">
          <Award className="w-3.5 h-3.5" /> Conquistas
        </h3>
        <div className="grid grid-cols-5 gap-2">
          {badges.map((b) => (
            <div key={b.id} className="flex flex-col items-center text-center" style={{ opacity: b.done ? 1 : 0.35 }}>
              <span className="text-2xl">{b.icon}</span>
              <span className="text-[9px] text-dark-muted mt-0.5 leading-tight">{b.label}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

const StatCard = ({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: React.ReactNode; color: string }) => (
  <div className="rounded-2xl p-3" style={{ background: `linear-gradient(135deg, hsl(${color} / 0.22), hsl(var(--dark-card)) 65%)`, border: `1px solid hsl(${color} / 0.3)` }}>
    <div className="flex items-center gap-1.5 text-dark-muted mb-1">{icon}<span className="text-[10px] font-bold uppercase tracking-wider">{label}</span></div>
    <p className="text-2xl font-black text-dark-text">{value}</p>
  </div>
);

const MiniCard = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) => (
  <div className="rounded-xl bg-dark-card p-2.5 text-center">
    <div className="flex items-center justify-center text-dark-muted mb-1">{icon}</div>
    <p className="text-lg font-black text-dark-text leading-none">{value}</p>
    <p className="text-[10px] text-dark-muted mt-0.5">{label}</p>
  </div>
);

const Sparkline = ({ values }: { values: number[] }) => {
  const w = 280; const h = 60; const pad = 4;
  const max = 100; const min = 0;
  const step = values.length > 1 ? (w - pad * 2) / (values.length - 1) : 0;
  const pts = values.map((v, i) => `${pad + i * step},${h - pad - ((v - min) / (max - min)) * (h - pad * 2)}`);
  const d = "M " + pts.join(" L ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-14">
      <path d={d} fill="none" stroke="hsl(var(--primary))" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      {values.map((v, i) => (
        <circle key={i} cx={pad + i * step} cy={h - pad - ((v - min) / (max - min)) * (h - pad * 2)} r={3} fill="hsl(var(--primary))" />
      ))}
    </svg>
  );
};

export default StatsView;