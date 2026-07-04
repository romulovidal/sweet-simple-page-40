import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { HandHeart, Loader2, Trash2, Check, Lock, Globe, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AdminPrayerRequest {
  id: string;
  user_id: string;
  content: string;
  is_public: boolean;
  is_answered: boolean;
  created_at: string;
  display_name?: string;
  reaction_count?: number;
}

const AdminPrayerRequests = () => {
  const [requests, setRequests] = useState<AdminPrayerRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "public" | "private" | "answered" | "pending">("all");
  const [busyId, setBusyId] = useState<string | null>(null);

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("prayer_requests")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);

    if (error) {
      toast.error("Erro ao carregar pedidos");
      setLoading(false);
      return;
    }

    const reqs = (data || []) as AdminPrayerRequest[];

    if (reqs.length > 0) {
      const userIds = [...new Set(reqs.map((r) => r.user_id))];
      const ids = reqs.map((r) => r.id);
      const [{ data: profiles }, { data: reactions }] = await Promise.all([
        supabase.from("profiles").select("user_id, display_name").in("user_id", userIds),
        supabase.from("prayer_reactions").select("request_id").in("request_id", ids),
      ]);

      const nameMap: Record<string, string> = {};
      (profiles || []).forEach((p: any) => {
        nameMap[p.user_id] = p.display_name || "Anônimo";
      });

      const countMap: Record<string, number> = {};
      (reactions || []).forEach((r: any) => {
        countMap[r.request_id] = (countMap[r.request_id] || 0) + 1;
      });

      reqs.forEach((r) => {
        r.display_name = nameMap[r.user_id] || "Anônimo";
        r.reaction_count = countMap[r.id] || 0;
      });
    }

    setRequests(reqs);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const filtered = requests.filter((r) => {
    if (filter === "public") return r.is_public;
    if (filter === "private") return !r.is_public;
    if (filter === "answered") return r.is_answered;
    if (filter === "pending") return !r.is_answered;
    return true;
  });

  const handleToggleAnswered = async (req: AdminPrayerRequest) => {
    setBusyId(req.id);
    const { error } = await supabase
      .from("prayer_requests")
      .update({ is_answered: !req.is_answered })
      .eq("id", req.id);
    if (error) {
      toast.error("Erro ao atualizar");
    } else {
      toast.success(!req.is_answered ? "Marcado como atendido 🎉" : "Desmarcado");
      setRequests((prev) =>
        prev.map((r) => (r.id === req.id ? { ...r, is_answered: !req.is_answered } : r))
      );
    }
    setBusyId(null);
  };

  const handleDelete = async (req: AdminPrayerRequest) => {
    if (!confirm(`Excluir o pedido de ${req.display_name}?\n\n"${req.content.slice(0, 80)}${req.content.length > 80 ? "..." : ""}"`)) {
      return;
    }
    setBusyId(req.id);
    const { error } = await supabase.from("prayer_requests").delete().eq("id", req.id);
    if (error) {
      toast.error("Erro ao excluir");
    } else {
      toast.success("Pedido excluído");
      setRequests((prev) => prev.filter((r) => r.id !== req.id));
    }
    setBusyId(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <HandHeart className="w-5 h-5 text-pink-400" />
        <h2 className="text-lg font-bold">Pedidos de Oração</h2>
        <span className="text-xs text-[hsl(var(--dark-muted))] ml-auto">
          {filtered.length} de {requests.length}
        </span>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2">
        {([
          { id: "all", label: "Todos" },
          { id: "pending", label: "Pendentes" },
          { id: "answered", label: "Atendidos" },
          { id: "public", label: "Públicos" },
          { id: "private", label: "Privados" },
        ] as const).map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
              filter === f.id
                ? "bg-primary text-primary-foreground"
                : "bg-[hsl(var(--dark-card))] text-[hsl(var(--dark-muted))]"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-10">
          <HandHeart className="w-10 h-10 text-[hsl(var(--dark-muted))] mx-auto mb-3 opacity-40" />
          <p className="text-sm text-[hsl(var(--dark-muted))]">Nenhum pedido com esse filtro</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((req) => (
            <div
              key={req.id}
              className={`bg-[hsl(var(--dark-card))] rounded-xl p-4 ${req.is_answered ? "opacity-70" : ""}`}
            >
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-pink-400/15 flex items-center justify-center flex-shrink-0">
                  <HandHeart className="w-4 h-4 text-pink-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <p className="text-xs font-semibold">{req.display_name}</p>
                    {req.is_public ? (
                      <span className="flex items-center gap-1 text-[10px] text-green-400 bg-green-400/10 px-1.5 py-0.5 rounded-full">
                        <Globe className="w-2.5 h-2.5" /> Público
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-[10px] text-yellow-400 bg-yellow-400/10 px-1.5 py-0.5 rounded-full">
                        <Lock className="w-2.5 h-2.5" /> Privado
                      </span>
                    )}
                    {req.is_answered && (
                      <span className="flex items-center gap-1 text-[10px] text-green-400 bg-green-400/10 px-1.5 py-0.5 rounded-full">
                        <Check className="w-2.5 h-2.5" /> Atendido
                      </span>
                    )}
                  </div>
                  <p className="text-sm whitespace-pre-wrap break-words">{req.content}</p>
                  <div className="flex items-center gap-3 mt-2 flex-wrap">
                    <p className="text-[10px] text-[hsl(var(--dark-muted))]">
                      {new Date(req.created_at).toLocaleString("pt-BR", { timeZone: "America/Fortaleza" })}
                    </p>
                    {(req.reaction_count || 0) > 0 && (
                      <span className="flex items-center gap-1 text-[10px] text-red-400">
                        <Heart className="w-3 h-3 fill-red-400" /> {req.reaction_count}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-3 pt-3 border-t border-[hsl(var(--dark-bg))]">
                <Button
                  size="sm"
                  variant={req.is_answered ? "outline" : "default"}
                  onClick={() => handleToggleAnswered(req)}
                  disabled={busyId === req.id}
                  className="text-xs h-8"
                >
                  {busyId === req.id ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <>
                      <Check className="w-3 h-3 mr-1" />
                      {req.is_answered ? "Desmarcar" : "Marcar atendido"}
                    </>
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => handleDelete(req)}
                  disabled={busyId === req.id}
                  className="text-xs h-8 ml-auto"
                >
                  <Trash2 className="w-3 h-3 mr-1" /> Excluir
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminPrayerRequests;
