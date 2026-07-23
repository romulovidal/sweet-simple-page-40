import { useEffect, useState } from "react";
import { atisDb } from "./atisDb";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Trash2, Loader2, Bot, Search, Bell, BellOff, CheckSquare, Square, X } from "lucide-react";

type Group = {
  id: string;
  name: string;
  wa_group_id: string | null;
  respond_mode: "mention_only" | "always" | "off";
  active: boolean;
  welcome_message: string | null;
  forward_notifications: boolean;
};

type WAGroup = { wa_group_id: string; name: string; size: number | null };

const modes: Record<string, string> = { mention_only: "Só quando mencionado", always: "Sempre", off: "Desligado" };

const AtisGroups = () => {
  const [items, setItems] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: "", wa_group_id: "" });
  const [discoverOpen, setDiscoverOpen] = useState(false);
  const [discovering, setDiscovering] = useState(false);
  const [waGroups, setWaGroups] = useState<WAGroup[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [forwardOnImport, setForwardOnImport] = useState(true);
  const [importing, setImporting] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await atisDb.from("atis_groups").select("*").order("name");
    setItems((data ?? []) as Group[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const add = async () => {
    if (!form.name.trim()) return toast.error("Nome obrigatório");
    const { error } = await atisDb.from("atis_groups").insert({ name: form.name.trim(), wa_group_id: form.wa_group_id.trim() || null });
    if (error) toast.error(error.message);
    else { toast.success("Grupo cadastrado"); setForm({ name: "", wa_group_id: "" }); load(); }
  };

  const update = async (id: string, patch: Partial<Group>) => {
    const { error } = await atisDb.from("atis_groups").update(patch).eq("id", id);
    if (error) toast.error(error.message); else load();
  };

  const remove = async (id: string) => {
    if (!confirm("Remover grupo?")) return;
    await atisDb.from("atis_groups").delete().eq("id", id);
    load();
  };

  const openDiscover = async () => {
    setDiscoverOpen(true);
    setDiscovering(true);
    setWaGroups([]);
    setSelected({});
    try {
      const { data, error } = await supabase.functions.invoke("atis-instance", { body: { action: "listGroups" } });
      if (error) throw error;
      if (!data?.ok || !Array.isArray(data.groups)) {
        toast.error("Não foi possível listar os grupos. O número está conectado?");
        return;
      }
      const linked = new Set(items.map((g) => g.wa_group_id).filter(Boolean) as string[]);
      const list: WAGroup[] = data.groups.filter((g: WAGroup) => !linked.has(g.wa_group_id));
      setWaGroups(list);
      if (list.length === 0) toast.info("Todos os grupos já estão cadastrados.");
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao buscar grupos");
    } finally {
      setDiscovering(false);
    }
  };

  const toggleSelect = (id: string) => setSelected((s) => ({ ...s, [id]: !s[id] }));
  const selectAll = () => setSelected(Object.fromEntries(waGroups.map((g) => [g.wa_group_id, true])));
  const clearAll = () => setSelected({});

  const importSelected = async () => {
    const chosen = waGroups.filter((g) => selected[g.wa_group_id]);
    if (!chosen.length) return toast.error("Selecione ao menos um grupo");
    setImporting(true);
    try {
      const { data, error } = await supabase.functions.invoke("atis-instance", {
        body: {
          action: "importGroups",
          groups: chosen.map((g) => ({
            wa_group_id: g.wa_group_id,
            name: g.name,
            forward_notifications: forwardOnImport,
            respond_mode: "mention_only",
          })),
        },
      });
      if (error) throw error;
      toast.success(`${data?.imported ?? chosen.length} grupo(s) importado(s)`);
      setDiscoverOpen(false);
      load();
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao importar");
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-gradient-to-br from-primary/15 to-primary/5 p-4 space-y-3 ring-1 ring-primary/20">
        <div className="flex items-start gap-3">
          <span className="w-10 h-10 rounded-xl bg-primary/20 grid place-items-center shrink-0">
            <Bell className="w-5 h-5 text-primary" />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold">Grupos do WhatsApp</p>
            <p className="text-xs text-[hsl(var(--dark-muted))] leading-relaxed mt-0.5">
              Busque automaticamente os grupos em que o número do Atis participa e ative o encaminhamento das notificações do app para cada grupo.
            </p>
          </div>
        </div>
        <button
          onClick={openDiscover}
          className="w-full h-11 rounded-xl bg-primary text-primary-foreground font-semibold text-sm flex items-center justify-center gap-2"
        >
          <Search className="w-4 h-4" /> Buscar grupos do WhatsApp
        </button>
      </div>

      <div className="rounded-2xl bg-[hsl(var(--dark-card))] p-4 space-y-3">
        <p className="text-sm font-bold flex items-center gap-2"><Plus className="w-4 h-4" /> Cadastro manual</p>
        <div className="grid md:grid-cols-2 gap-2">
          <input className="input" placeholder="Nome do grupo" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          <input className="input" placeholder="ID do grupo (opcional, ex: 12345@g.us)" value={form.wa_group_id} onChange={e => setForm({ ...form, wa_group_id: e.target.value })} />
        </div>
        <button onClick={add} className="w-full h-11 rounded-xl bg-[hsl(var(--dark-bg))] border border-[hsl(var(--dark-card-hover))] font-semibold text-sm">Adicionar manualmente</button>
      </div>

      <div className="rounded-2xl bg-[hsl(var(--dark-card))] p-4">
        {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : items.length === 0 ? (
          <p className="text-center text-sm text-[hsl(var(--dark-muted))] py-6">Nenhum grupo cadastrado</p>
        ) : (
          <ul className="divide-y divide-[hsl(var(--dark-card-hover))]">
            {items.map(g => (
              <li key={g.id} className="py-3 space-y-2">
                <div className="flex items-center gap-3">
                  <span className="w-9 h-9 rounded-full bg-[hsl(var(--dark-card-hover))] grid place-items-center shrink-0"><Bot className="w-4 h-4" /></span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{g.name}</p>
                    <p className="text-[10px] text-[hsl(var(--dark-muted))] truncate font-mono">{g.wa_group_id || "sem ID vinculado"}</p>
                  </div>
                  <button onClick={() => remove(g.id)} className="p-1.5 text-destructive hover:bg-destructive/10 rounded-lg shrink-0"><Trash2 className="w-4 h-4" /></button>
                </div>
                <div className="flex items-center gap-2 flex-wrap pl-12">
                  <select value={g.respond_mode} onChange={e => update(g.id, { respond_mode: e.target.value as Group["respond_mode"] })}
                    className="text-xs bg-[hsl(var(--dark-bg))] border border-[hsl(var(--dark-card-hover))] rounded-lg px-2 py-1.5">
                    {Object.entries(modes).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                  <button
                    onClick={() => update(g.id, { forward_notifications: !g.forward_notifications })}
                    disabled={!g.wa_group_id}
                    className={`text-xs px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 font-semibold transition-colors ${
                      g.forward_notifications
                        ? "bg-primary/15 text-primary ring-1 ring-primary/30"
                        : "bg-[hsl(var(--dark-bg))] text-[hsl(var(--dark-muted))] ring-1 ring-[hsl(var(--dark-card-hover))]"
                    } ${!g.wa_group_id ? "opacity-40 cursor-not-allowed" : ""}`}
                    title={g.wa_group_id ? "" : "Vincule um ID de grupo primeiro"}
                  >
                    {g.forward_notifications ? <Bell className="w-3 h-3" /> : <BellOff className="w-3 h-3" />}
                    {g.forward_notifications ? "Recebe notificações" : "Não recebe"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {discoverOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm grid place-items-center p-4">
          <div className="w-full max-w-lg max-h-[85vh] flex flex-col bg-[hsl(var(--dark-bg))] rounded-2xl ring-1 ring-[hsl(var(--dark-card-hover))] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-[hsl(var(--dark-card-hover))]">
              <div className="flex items-center gap-2">
                <Search className="w-4 h-4 text-primary" />
                <p className="font-bold text-sm">Grupos do WhatsApp</p>
              </div>
              <button onClick={() => setDiscoverOpen(false)} className="p-1 hover:bg-[hsl(var(--dark-card))] rounded-lg"><X className="w-4 h-4" /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {discovering ? (
                <div className="py-12 flex flex-col items-center gap-2 text-[hsl(var(--dark-muted))]">
                  <Loader2 className="w-6 h-6 animate-spin" />
                  <p className="text-xs">Consultando o WhatsApp…</p>
                </div>
              ) : waGroups.length === 0 ? (
                <p className="py-12 text-center text-sm text-[hsl(var(--dark-muted))]">
                  Nenhum grupo novo encontrado. Certifique-se de que o número do Atis está conectado e faz parte de grupos.
                </p>
              ) : (
                <>
                  <div className="flex items-center gap-2 pb-1">
                    <button onClick={selectAll} className="text-[11px] font-semibold text-primary hover:underline">Selecionar todos</button>
                    <span className="text-[hsl(var(--dark-muted))]">·</span>
                    <button onClick={clearAll} className="text-[11px] text-[hsl(var(--dark-muted))] hover:underline">Limpar</button>
                    <span className="ml-auto text-[10px] text-[hsl(var(--dark-muted))]">{waGroups.length} grupo(s)</span>
                  </div>
                  {waGroups.map((g) => {
                    const on = !!selected[g.wa_group_id];
                    return (
                      <button
                        key={g.wa_group_id}
                        onClick={() => toggleSelect(g.wa_group_id)}
                        className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-colors ${
                          on ? "bg-primary/10 ring-1 ring-primary/40" : "bg-[hsl(var(--dark-card))] hover:bg-[hsl(var(--dark-card-hover))]"
                        }`}
                      >
                        {on ? <CheckSquare className="w-4 h-4 text-primary shrink-0" /> : <Square className="w-4 h-4 text-[hsl(var(--dark-muted))] shrink-0" />}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate">{g.name}</p>
                          <p className="text-[10px] text-[hsl(var(--dark-muted))] truncate font-mono">
                            {g.wa_group_id}{g.size ? ` · ${g.size} membros` : ""}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </>
              )}
            </div>

            <div className="p-4 border-t border-[hsl(var(--dark-card-hover))] space-y-3">
              <label className="flex items-start gap-2 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={forwardOnImport}
                  onChange={(e) => setForwardOnImport(e.target.checked)}
                  className="mt-0.5 accent-[hsl(var(--primary))]"
                />
                <span>
                  <span className="font-semibold">Encaminhar notificações do app</span> para os grupos selecionados.
                  Sempre que uma notificação for enviada aos usuários, o conteúdo também será postado nestes grupos.
                </span>
              </label>
              <button
                onClick={importSelected}
                disabled={importing || discovering || waGroups.length === 0}
                className="w-full h-11 rounded-xl bg-primary text-primary-foreground font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Importar selecionados
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`.input{width:100%;height:42px;padding:0 12px;border-radius:12px;background:hsl(var(--dark-bg));color:hsl(var(--dark-text));border:1px solid hsl(var(--dark-card-hover));font-size:14px}`}</style>
    </div>
  );
};

export default AtisGroups;