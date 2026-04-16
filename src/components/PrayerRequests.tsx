import { useState, useEffect, useCallback } from "react";
import { HandHeart, Plus, Loader2, Heart, Lock, Globe, Check, Pencil, X, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import CultoScheduleList from "@/components/CultoScheduleList";

interface PrayerRequest {
  id: string;
  user_id: string;
  content: string;
  is_public: boolean;
  is_answered: boolean;
  created_at: string;
  reaction_count?: number;
  user_reacted?: boolean;
  display_name?: string;
}

interface PrayerRequestsProps {
  enabled: boolean;
}

const PrayerRequests = ({ enabled }: PrayerRequestsProps) => {
  const { user } = useAuth();
  const [requests, setRequests] = useState<PrayerRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [newContent, setNewContent] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [tab, setTab] = useState<"public" | "mine">("public");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [editIsPublic, setEditIsPublic] = useState(true);
  const [editSaving, setEditSaving] = useState(false);

  const fetchRequests = useCallback(async () => {
    setLoading(true);

    let query;
    if (tab === "public") {
      query = supabase
        .from("prayer_requests")
        .select("*")
        .eq("is_public", true)
        .order("created_at", { ascending: false })
        .limit(50);
    } else if (user) {
      query = supabase
        .from("prayer_requests")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
    } else {
      setRequests([]);
      setLoading(false);
      return;
    }

    const { data } = await query;
    const reqs = (data || []) as PrayerRequest[];

    // Get reaction counts
    if (reqs.length > 0) {
      const ids = reqs.map(r => r.id);
      const { data: reactions } = await supabase
        .from("prayer_reactions")
        .select("request_id, user_id")
        .in("request_id", ids);

      const countMap: Record<string, number> = {};
      const userReactedMap: Record<string, boolean> = {};
      (reactions || []).forEach((r: any) => {
        countMap[r.request_id] = (countMap[r.request_id] || 0) + 1;
        if (user && r.user_id === user.id) userReactedMap[r.request_id] = true;
      });

      // Get display names
      const userIds = [...new Set(reqs.map(r => r.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, display_name")
        .in("user_id", userIds);

      const nameMap: Record<string, string> = {};
      (profiles || []).forEach((p: any) => {
        nameMap[p.user_id] = p.display_name || "Anônimo";
      });

      reqs.forEach(r => {
        r.reaction_count = countMap[r.id] || 0;
        r.user_reacted = userReactedMap[r.id] || false;
        r.display_name = nameMap[r.user_id] || "Anônimo";
      });
    }

    setRequests(reqs);
    setLoading(false);
  }, [tab, user]);

  useEffect(() => {
    if (enabled) fetchRequests();
  }, [enabled, fetchRequests]);

  const handleSubmit = async () => {
    if (!user || !newContent.trim()) return;
    setSaving(true);
    const { error } = await supabase.from("prayer_requests").insert({
      user_id: user.id,
      content: newContent.trim(),
      is_public: isPublic,
    });
    if (error) {
      toast.error("Erro ao enviar pedido");
    } else {
      toast.success("Pedido enviado! 🙏");
      setNewContent("");
      setShowForm(false);
      fetchRequests();
    }
    setSaving(false);
  };

  const handleReact = async (requestId: string, alreadyReacted: boolean) => {
    if (!user) { toast.error("Faça login para orar"); return; }
    if (alreadyReacted) {
      await supabase.from("prayer_reactions").delete().eq("request_id", requestId).eq("user_id", user.id);
    } else {
      await supabase.from("prayer_reactions").insert({ request_id: requestId, user_id: user.id });
    }
    fetchRequests();
  };

  const handleToggleAnswered = async (id: string, current: boolean) => {
    await supabase.from("prayer_requests").update({ is_answered: !current }).eq("id", id);
    toast.success(!current ? "Marcado como respondido! 🎉" : "Desmarcado");
    fetchRequests();
  };

  const startEdit = (req: PrayerRequest) => {
    setEditingId(req.id);
    setEditContent(req.content);
    setEditIsPublic(req.is_public);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditContent("");
  };

  const saveEdit = async (id: string) => {
    const trimmed = editContent.trim();
    if (!trimmed) {
      toast.error("O pedido não pode ficar vazio");
      return;
    }
    if (trimmed.length > 1000) {
      toast.error("Máximo de 1000 caracteres");
      return;
    }
    setEditSaving(true);
    const { error } = await supabase
      .from("prayer_requests")
      .update({ content: trimmed, is_public: editIsPublic })
      .eq("id", id);
    if (error) {
      toast.error("Erro ao salvar");
    } else {
      toast.success("Pedido atualizado ✏️");
      cancelEdit();
      fetchRequests();
    }
    setEditSaving(false);
  };

  const handleDeleteOwn = async (id: string) => {
    if (!confirm("Excluir este pedido de oração?")) return;
    const { error } = await supabase.from("prayer_requests").delete().eq("id", id);
    if (error) {
      toast.error("Erro ao excluir");
    } else {
      toast.success("Pedido excluído");
      fetchRequests();
    }
  };

  if (!enabled) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <HandHeart className="w-5 h-5 text-pink-400" />
          <h2 className="text-lg font-bold">Pedidos de Oração</h2>
        </div>
        {user && (
          <Button size="sm" onClick={() => setShowForm(!showForm)}>
            <Plus className="w-4 h-4 mr-1" /> Novo
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {(["public", "mine"] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-colors ${
              tab === t ? "bg-primary text-primary-foreground" : "bg-[hsl(var(--dark-card))] text-[hsl(var(--dark-muted))]"
            }`}
          >
            {t === "public" ? "Comunidade" : "Meus Pedidos"}
          </button>
        ))}
      </div>

      {/* Horários de culto (apenas na aba Comunidade) */}
      {tab === "public" && <CultoScheduleList />}

      {/* New request form */}
      {showForm && user && (
        <div className="bg-[hsl(var(--dark-card))] rounded-xl p-4 space-y-3">
          <Textarea
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            placeholder="Compartilhe seu pedido de oração..."
            className="bg-[hsl(var(--dark-bg))] border-none min-h-[80px] text-sm"
            maxLength={1000}
          />
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsPublic(!isPublic)}
              className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full ${
                isPublic ? "bg-green-400/20 text-green-400" : "bg-yellow-400/20 text-yellow-400"
              }`}
            >
              {isPublic ? <Globe className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
              {isPublic ? "Público" : "Privado"}
            </button>
            <div className="flex-1" />
            <Button onClick={handleSubmit} disabled={saving || !newContent.trim()} size="sm">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Enviar 🙏"}
            </Button>
          </div>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : requests.length > 0 ? (
        <div className="space-y-2">
          {requests.map(req => {
            const isOwn = !!user && req.user_id === user.id;
            const isEditing = editingId === req.id;
            return (
            <div key={req.id} className={`bg-[hsl(var(--dark-card))] rounded-xl p-4 ${req.is_answered && !isEditing ? "opacity-60" : ""}`}>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-pink-400/15 flex items-center justify-center flex-shrink-0">
                  <HandHeart className="w-4 h-4 text-pink-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-xs font-semibold">{req.display_name}</p>
                    {!req.is_public && !isEditing && <Lock className="w-3 h-3 text-yellow-400" />}
                    {req.is_answered && !isEditing && <Check className="w-3 h-3 text-green-400" />}
                  </div>

                  {isEditing ? (
                    <div className="space-y-2">
                      <Textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        className="bg-[hsl(var(--dark-bg))] border-none min-h-[80px] text-sm"
                        maxLength={1000}
                      />
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          onClick={() => setEditIsPublic(!editIsPublic)}
                          className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full ${
                            editIsPublic ? "bg-green-400/20 text-green-400" : "bg-yellow-400/20 text-yellow-400"
                          }`}
                        >
                          {editIsPublic ? <Globe className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                          {editIsPublic ? "Público" : "Privado"}
                        </button>
                        <span className="text-[10px] text-[hsl(var(--dark-muted))] ml-auto">
                          {editContent.length}/1000
                        </span>
                        <Button onClick={cancelEdit} size="sm" variant="outline" disabled={editSaving}>
                          <X className="w-3 h-3 mr-1" /> Cancelar
                        </Button>
                        <Button onClick={() => saveEdit(req.id)} size="sm" disabled={editSaving || !editContent.trim()}>
                          {editSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : (<><Check className="w-3 h-3 mr-1" /> Salvar</>)}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm whitespace-pre-wrap">{req.content}</p>
                  )}

                  {!isEditing && (
                    <div className="flex items-center gap-3 mt-2 flex-wrap">
                      <button
                        onClick={() => handleReact(req.id, !!req.user_reacted)}
                        className={`flex items-center gap-1 text-xs ${
                          req.user_reacted ? "text-red-400" : "text-[hsl(var(--dark-muted))]"
                        }`}
                      >
                        <Heart className={`w-3.5 h-3.5 ${req.user_reacted ? "fill-red-400" : ""}`} />
                        {(req.reaction_count || 0) > 0 && req.reaction_count} Orei
                      </button>
                      <p className="text-[10px] text-[hsl(var(--dark-muted))]">
                        {new Date(req.created_at).toLocaleDateString("pt-BR")}
                      </p>
                      {isOwn && (
                        <div className="flex items-center gap-2 ml-auto">
                          <button
                            onClick={() => startEdit(req)}
                            className="text-[10px] text-primary flex items-center gap-1"
                          >
                            <Pencil className="w-3 h-3" /> Editar
                          </button>
                          <button
                            onClick={() => handleToggleAnswered(req.id, req.is_answered)}
                            className="text-[10px] text-primary"
                          >
                            {req.is_answered ? "Desmarcar" : "Respondido ✓"}
                          </button>
                          <button
                            onClick={() => handleDeleteOwn(req.id)}
                            className="text-[10px] text-destructive flex items-center gap-1"
                          >
                            <Trash2 className="w-3 h-3" /> Excluir
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-10">
          <HandHeart className="w-10 h-10 text-[hsl(var(--dark-muted))] mx-auto mb-3 opacity-40" />
          <p className="text-sm text-[hsl(var(--dark-muted))]">
            {tab === "mine" ? "Você ainda não tem pedidos" : "Nenhum pedido de oração"}
          </p>
        </div>
      )}

      {!user && (
        <div className="bg-primary/10 rounded-xl p-4 text-center">
          <p className="text-sm text-primary">Faça login para enviar pedidos de oração</p>
        </div>
      )}
    </div>
  );
};

export default PrayerRequests;
