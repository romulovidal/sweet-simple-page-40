import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Search, MessageCircle, Save, Trash2, UserCheck, UserX } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

type Profile = {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  whatsapp: string | null;
  whatsapp_opt_in: boolean;
};

const AtisIndividuals = () => {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "opted" | "with_number">("opted");
  const [editing, setEditing] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("user_id, display_name, avatar_url, whatsapp, whatsapp_opt_in")
      .order("display_name", { ascending: true });
    setLoading(false);
    if (error) return toast.error("Erro ao carregar perfis");
    setProfiles((data as any) || []);
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return profiles.filter((p) => {
      if (filter === "opted" && !p.whatsapp_opt_in) return false;
      if (filter === "with_number" && !p.whatsapp) return false;
      if (!term) return true;
      return (
        (p.display_name || "").toLowerCase().includes(term) ||
        (p.whatsapp || "").includes(term)
      );
    });
  }, [profiles, q, filter]);

  const stats = useMemo(() => {
    const opted = profiles.filter((p) => p.whatsapp_opt_in && p.whatsapp).length;
    const withNumber = profiles.filter((p) => p.whatsapp).length;
    return { total: profiles.length, opted, withNumber };
  }, [profiles]);

  const updateProfile = async (userId: string, patch: Partial<Profile>) => {
    setSavingId(userId);
    const { error } = await supabase.from("profiles").update(patch).eq("user_id", userId);
    setSavingId(null);
    if (error) return toast.error("Não foi possível salvar");
    setProfiles((prev) => prev.map((p) => (p.user_id === userId ? { ...p, ...patch } as Profile : p)));
    toast.success("Atualizado");
  };

  const toggleOptIn = (p: Profile) => {
    if (!p.whatsapp && !p.whatsapp_opt_in) {
      toast.error("Cadastre o WhatsApp antes de ativar.");
      return;
    }
    updateProfile(p.user_id, { whatsapp_opt_in: !p.whatsapp_opt_in });
  };

  const saveNumber = (p: Profile) => {
    const raw = (editing[p.user_id] ?? p.whatsapp ?? "").replace(/\D/g, "");
    if (raw && raw.length < 10) {
      toast.error("Número inválido (mín. 10 dígitos com DDD).");
      return;
    }
    updateProfile(p.user_id, {
      whatsapp: raw || null,
      whatsapp_opt_in: raw ? p.whatsapp_opt_in : false,
    });
    setEditing((prev) => { const n = { ...prev }; delete n[p.user_id]; return n; });
  };

  const removeNumber = (p: Profile) => {
    if (!window.confirm(`Remover WhatsApp de ${p.display_name || "usuário"}?`)) return;
    updateProfile(p.user_id, { whatsapp: null, whatsapp_opt_in: false });
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold">Notificações Individuais</h2>
        <p className="text-sm text-[hsl(var(--dark-muted))] mt-1">
          Gerencie quem recebe mensagens do Atis diretamente no WhatsApp pessoal.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="bg-[hsl(var(--dark-card))] rounded-xl p-3 text-center">
          <p className="text-2xl font-bold">{stats.opted}</p>
          <p className="text-[10px] uppercase tracking-wider text-[hsl(var(--dark-muted))] mt-1">Recebem</p>
        </div>
        <div className="bg-[hsl(var(--dark-card))] rounded-xl p-3 text-center">
          <p className="text-2xl font-bold">{stats.withNumber}</p>
          <p className="text-[10px] uppercase tracking-wider text-[hsl(var(--dark-muted))] mt-1">Com número</p>
        </div>
        <div className="bg-[hsl(var(--dark-card))] rounded-xl p-3 text-center">
          <p className="text-2xl font-bold">{stats.total}</p>
          <p className="text-[10px] uppercase tracking-wider text-[hsl(var(--dark-muted))] mt-1">Perfis</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[hsl(var(--dark-muted))]" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nome ou número…"
            className="pl-9 bg-[hsl(var(--dark-card))] border-none"
          />
        </div>
        <div className="flex gap-1 bg-[hsl(var(--dark-card))] rounded-xl p-1">
          {(["opted", "with_number", "all"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                filter === f ? "bg-primary text-primary-foreground" : "text-[hsl(var(--dark-muted))]"
              }`}
            >
              {f === "opted" ? "Ativos" : f === "with_number" ? "Com nº" : "Todos"}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-[hsl(var(--dark-card))] rounded-xl p-8 text-center">
          <MessageCircle className="w-8 h-8 mx-auto text-[hsl(var(--dark-muted))] mb-2" />
          <p className="text-sm text-[hsl(var(--dark-muted))]">
            Nenhum perfil {filter === "opted" ? "ativo" : filter === "with_number" ? "com número" : ""} encontrado.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((p) => {
            const isEditing = editing[p.user_id] !== undefined;
            const value = editing[p.user_id] ?? p.whatsapp ?? "";
            return (
              <div key={p.user_id} className="bg-[hsl(var(--dark-card))] rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  {p.avatar_url ? (
                    <img src={p.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover shrink-0" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center shrink-0 text-sm">
                      {(p.display_name || "?").slice(0, 1).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold truncate">{p.display_name || "Sem nome"}</p>
                    <div className="flex items-center gap-1.5 text-xs text-[hsl(var(--dark-muted))] mt-0.5">
                      {p.whatsapp_opt_in ? (
                        <><UserCheck className="w-3 h-3 text-green-500" /> Recebe notificações</>
                      ) : (
                        <><UserX className="w-3 h-3" /> Desativado</>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Input
                    value={value}
                    onChange={(e) => setEditing((prev) => ({ ...prev, [p.user_id]: e.target.value }))}
                    placeholder="85999999999"
                    className="bg-[hsl(var(--dark-bg))] border-none w-40 text-sm"
                    inputMode="tel"
                  />
                  {isEditing && (
                    <Button size="sm" variant="secondary" onClick={() => saveNumber(p)} disabled={savingId === p.user_id}>
                      {savingId === p.user_id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                    </Button>
                  )}
                  <Switch
                    checked={p.whatsapp_opt_in}
                    onCheckedChange={() => toggleOptIn(p)}
                    disabled={savingId === p.user_id}
                  />
                  {p.whatsapp && (
                    <button
                      onClick={() => removeNumber(p)}
                      className="text-[hsl(var(--dark-muted))] hover:text-destructive p-1"
                      title="Remover número"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AtisIndividuals;