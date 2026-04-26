import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Clock, Shield, FileText, Bell, BookOpen, Users } from "lucide-react";

interface ActivityEntry {
  id: string;
  action: string;
  details: unknown;
  created_at: string;
  user_id?: string | null;
  title?: string;
  body?: string;
  sent_at?: string;
  total_sent?: number;
  total_failed?: number;
  type?: 'log' | 'push';
}

const ACTION_LABELS: Record<string, { label: string; icon: typeof Shield; color: string }> = {
  role_promoted: { label: "Promoveu admin", icon: Shield, color: "text-green-400" },
  role_removed: { label: "Removeu admin", icon: Shield, color: "text-destructive" },
  push_sent: { label: "Enviou push", icon: Bell, color: "text-amber-400" },
  post_created: { label: "Criou postagem", icon: FileText, color: "text-blue-400" },
  post_updated: { label: "Editou postagem", icon: FileText, color: "text-blue-400" },
  plan_created: { label: "Criou plano", icon: BookOpen, color: "text-purple-400" },
  plan_updated: { label: "Editou plano", icon: BookOpen, color: "text-purple-400" },
  verse_queued: { label: "Agendou versículo", icon: BookOpen, color: "text-primary" },
  user_deleted: { label: "Excluiu usuário", icon: Users, color: "text-destructive" },
};

const AdminActivityLog = () => {
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'system' | 'push'>('all');

  const loadLog = useCallback(async () => {
    setLoading(true);
    
    try {
      // Fetch both activity logs and push logs
      const [activityRes, pushRes] = await Promise.all([
        supabase
          .from("admin_activity_log")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(50),
        supabase
          .from("push_log")
          .select("*")
          .order("sent_at", { ascending: false })
          .limit(50)
      ]);

      const activityEntries: ActivityEntry[] = (activityRes.data || []).map(e => ({
        ...e,
        type: 'log' as const
      }));

      const pushEntries: ActivityEntry[] = (pushRes.data || []).map(e => ({
        id: e.id,
        action: 'push_sent',
        created_at: e.sent_at,
        details: e,
        user_id: e.sent_by,
        type: 'push' as const,
        // Spread push specific fields for easier access
        title: e.title,
        body: e.body,
        total_sent: e.total_sent,
        total_failed: e.total_failed
      }));

      // Combine and sort by date
      const combined = [...activityEntries, ...pushEntries].sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      setEntries(combined);
    } catch (error) {
      console.error("Error loading logs:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLog();
  }, [loadLog]);

  const filteredEntries = entries.filter(entry => {
    if (filter === 'all') return true;
    if (filter === 'system') return entry.type === 'log';
    if (filter === 'push') return entry.type === 'push';
    return true;
  });

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  }

  if (entries.length === 0) {
    return (
      <div className="text-center py-10">
        <Clock className="w-10 h-10 text-[hsl(var(--dark-muted))] mx-auto mb-3 opacity-40" />
        <p className="text-sm text-[hsl(var(--dark-muted))]">Nenhuma atividade registrada ainda</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter Tabs */}
      <div className="flex gap-2 p-1 bg-[hsl(var(--dark-card))] rounded-xl w-fit">
        {[
          { id: 'all', label: 'Tudo' },
          { id: 'push', label: 'Push' },
          { id: 'system', label: 'Sistema' },
        ].map((btn) => (
          <button
            key={btn.id}
            onClick={() => setFilter(btn.id as any)}
            className={`px-4 py-1.5 text-[11px] font-bold uppercase tracking-wider rounded-lg transition-all ${
              filter === btn.id 
                ? "bg-primary text-primary-foreground shadow-md" 
                : "text-[hsl(var(--dark-muted))] hover:text-[hsl(var(--dark-text))]"
            }`}
          >
            {btn.label}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {filteredEntries.map((entry) => {
          const isPush = entry.type === 'push';
          const config = ACTION_LABELS[entry.action] || { 
            label: entry.action, 
            icon: isPush ? Bell : Clock, 
            color: isPush ? "text-amber-400" : "text-[hsl(var(--dark-muted))]" 
          };
          const Icon = config.icon;
          
          return (
            <div key={`${entry.type}-${entry.id}`} className="bg-[hsl(var(--dark-card))] rounded-xl p-3 flex items-start gap-3 border border-white/5 hover:border-white/10 transition-colors">
              <div className={`w-8 h-8 shrink-0 rounded-lg flex items-center justify-center ${config.color} bg-current/10 mt-0.5`}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-bold truncate">{isPush ? entry.title : config.label}</p>
                  <p className="text-[9px] font-medium text-[hsl(var(--dark-muted))] whitespace-nowrap bg-white/5 px-2 py-0.5 rounded-full uppercase tracking-tighter">
                    {new Date(entry.created_at).toLocaleDateString("pt-BR", { day: '2-digit', month: '2-digit' })}
                  </p>
                </div>
                
                {isPush ? (
                  <div className="mt-1">
                    <p className="text-[11px] text-[hsl(var(--dark-muted))] line-clamp-1">{entry.body}</p>
                    <div className="flex items-center gap-3 mt-1.5">
                      <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-green-500/10 text-green-400 text-[10px] font-bold">
                        <Bell className="w-2.5 h-2.5" />
                        <span>{entry.total_sent || 0} RECEBIDOS</span>
                      </div>
                      {entry.total_failed ? (
                        <div className="text-[9px] font-medium text-destructive/80">
                          {entry.total_failed} falhas
                        </div>
                      ) : null}
                      <span className="text-[9px] font-medium text-[hsl(var(--dark-muted))] ml-auto italic">
                        {new Date(entry.created_at).toLocaleTimeString("pt-BR", { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                ) : (
                  <p className="text-[10px] text-[hsl(var(--dark-muted))] mt-0.5">
                    {new Date(entry.created_at).toLocaleTimeString("pt-BR", { hour: '2-digit', minute: '2-digit' })}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default AdminActivityLog;
