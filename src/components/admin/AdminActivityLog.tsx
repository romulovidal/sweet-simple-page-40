import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Clock, Shield, FileText, Bell, BookOpen, Users } from "lucide-react";

interface ActivityEntry {
  id: string;
  action: string;
  details: Record<string, unknown>;
  created_at: string;
  user_id: string | null;
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

  useEffect(() => {
    loadLog();
  }, []);

  const loadLog = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("admin_activity_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    setEntries(data || []);
    setLoading(false);
  };

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
    <div className="space-y-2">
      {entries.map((entry) => {
        const config = ACTION_LABELS[entry.action] || { label: entry.action, icon: Clock, color: "text-[hsl(var(--dark-muted))]" };
        const Icon = config.icon;
        return (
          <div key={entry.id} className="bg-[hsl(var(--dark-card))] rounded-xl p-3 flex items-center gap-3">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${config.color} bg-current/10`}>
              <Icon className={`w-4 h-4 ${config.color}`} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">{config.label}</p>
              <p className="text-[10px] text-[hsl(var(--dark-muted))]">
                {new Date(entry.created_at).toLocaleString("pt-BR")}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default AdminActivityLog;
