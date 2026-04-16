import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Users, BookOpen, FileText, Bell, TrendingUp, Flame, Loader2 } from "lucide-react";

interface DashboardStats {
  totalUsers: number;
  newUsersThisWeek: number;
  activePlans: number;
  totalPlans: number;
  activePosts: number;
  totalPosts: number;
  pushSubscriptions: number;
  avgStreak: number;
  topVerses: { reference: string; count: number }[];
}

const AdminDashboard = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    setLoading(true);
    const [usersRes, plansRes, postsRes, pushRes, streaksRes, versesRes] = await Promise.all([
      supabase.from("profiles").select("created_at"),
      supabase.from("admin_plans").select("is_active"),
      supabase.from("admin_posts").select("is_active"),
      supabase.from("push_subscriptions").select("id", { count: "exact", head: true }),
      supabase.from("user_streaks").select("current_streak"),
      supabase.from("user_saved_verses").select("reference"),
    ]);

    const users = usersRes.data || [];
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const newUsersThisWeek = users.filter(u => new Date(u.created_at) >= oneWeekAgo).length;

    const plans = plansRes.data || [];
    const posts = postsRes.data || [];
    const streaks = streaksRes.data || [];
    const avgStreak = streaks.length > 0
      ? Math.round(streaks.reduce((sum, s) => sum + s.current_streak, 0) / streaks.length)
      : 0;

    // Top verses
    const verseCounts: Record<string, number> = {};
    (versesRes.data || []).forEach(v => {
      verseCounts[v.reference] = (verseCounts[v.reference] || 0) + 1;
    });
    const topVerses = Object.entries(verseCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([reference, count]) => ({ reference, count }));

    setStats({
      totalUsers: users.length,
      newUsersThisWeek,
      activePlans: plans.filter(p => p.is_active).length,
      totalPlans: plans.length,
      activePosts: posts.filter(p => p.is_active).length,
      totalPosts: posts.length,
      pushSubscriptions: pushRes.count || 0,
      avgStreak,
      topVerses,
    });
    setLoading(false);
  };

  if (loading || !stats) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  const cards = [
    { icon: Users, label: "Usuários", value: stats.totalUsers, sub: `+${stats.newUsersThisWeek} esta semana`, color: "text-blue-400" },
    { icon: BookOpen, label: "Planos", value: `${stats.activePlans}/${stats.totalPlans}`, sub: "ativos", color: "text-green-400" },
    { icon: FileText, label: "Postagens", value: `${stats.activePosts}/${stats.totalPosts}`, sub: "ativas", color: "text-purple-400" },
    { icon: Bell, label: "Push Inscritos", value: stats.pushSubscriptions, sub: "dispositivos", color: "text-amber-400" },
    { icon: Flame, label: "Streak Médio", value: `${stats.avgStreak}d`, sub: "dias consecutivos", color: "text-orange-400" },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {cards.map((card) => (
          <div key={card.label} className="bg-muted rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <card.icon className={`w-4 h-4 ${card.color}`} />
              <span className="text-xs text-muted-foreground">{card.label}</span>
            </div>
            <p className="text-2xl font-bold">{card.value}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{card.sub}</p>
          </div>
        ))}
      </div>

      {stats.topVerses.length > 0 && (
        <div className="bg-muted rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold">Versículos Mais Salvos</span>
          </div>
          <div className="space-y-2">
            {stats.topVerses.map((v, i) => (
              <div key={v.reference} className="flex items-center gap-3">
                <span className="text-xs font-bold text-primary w-5">{i + 1}.</span>
                <span className="text-sm flex-1 truncate">{v.reference}</span>
                <span className="text-xs text-muted-foreground">{v.count}x</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
