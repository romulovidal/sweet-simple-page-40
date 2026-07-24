import { useEffect, useState } from "react";
import { atisDb } from "./atisDb";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Trash2, Loader2, Bot, Search, Bell, BellOff, X, Users, ChevronDown, RefreshCw, Check, SlidersHorizontal, BookOpen, Sparkles, CalendarClock, Megaphone, FileText } from "lucide-react";

type Group = {
  id: string;
  name: string;
  wa_group_id: string | null;
  respond_mode: "mention_only" | "always" | "off";
  active: boolean;
  welcome_message: string | null;
  forward_notifications: boolean;
  notification_types: string[] | null;
};

type WAGroup = { wa_group_id: string; name: string; size: number | null };

const modes: Record<string, string> = { mention_only: "Só quando mencionado", always: "Sempre", off: "Desligado" };

const NOTIF_TYPES: { key: string; label: string; hint: string; icon: any }[] = [
  { key: "daily-verse", label: "Versículo do dia", hint: "Push diário do versículo", icon: BookOpen },
  { key: "motivational", label: "Motivacional", hint: "Mensagens motivacionais", icon: Sparkles },
  { key: "culto-reminder", label: "Lembrete de culto", hint: "Antes de cada culto", icon: CalendarClock },
  { key: "post", label: "Novo post", hint: "Devocional/estudo publicado", icon: FileText },
  { key: "general", label: "Avisos gerais", hint: "Pushes manuais do admin", icon: Megaphone },
];
const ALL_TYPES = NOTIF_TYPES.map((t) => t.key);

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
  const [query, setQuery] = useState("");
  const [manualOpen, setManualOpen] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

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

  const toggleType = async (g: Group, key: string) => {
    const current = Array.isArray(g.notification_types) && g.notification_types.length
      ? g.notification_types
      : ALL_TYPES;
    const next = current.includes(key) ? current.filter((k) => k !== key) : [...current, key];
    await update(g.id, { notification_types: next });
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
      <div className="rounded-2xl overflow-hidden ring-1 ring-primary/25 bg-gradient-to-br from-primary/20 via-primary/5 to-transparent">
        <div className="p-4 flex items-start gap-3">
          <span className="w-11 h-11 rounded-2xl bg-primary/20 grid place-items-center shrink-0 ring-1 ring-primary/30">
            <Users className="w-5 h-5 text-primary" />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold">Grupos do WhatsApp</p>
            <p className="text-[11px] text-[hsl(var(--dark-muted))] leading-relaxed mt-0.5">
              Importe os grupos em que o número do Atis participa e ative o encaminhamento das notificações do app.
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-2xl font-black leading-none tabular-nums">{items.length}</p>
            <p className="text-[10px] text-[hsl(var(--dark-muted))] uppercase font-semibold">cadastrados</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-1.5 p-3 pt-0">
          <button
            onClick={openDiscover}
            className="h-11 rounded-xl bg-primary text-primary-foreground font-semibold text-sm flex items-center justify-center gap-2 hover:opacity-90"
          >
            <Search className="w-4 h-4" /> Buscar do WhatsApp
          </button>
          <button
            onClick={() => setManualOpen((v) => !v)}
            className="h-11 rounded-xl bg-[hsl(var(--dark-card))] hover:bg-[hsl(var(--dark-card-hover))] font-semibold text-sm flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" /> Manual
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${manualOpen ? "rotate-180" : ""}`} />
          </button>
        </div>
      </div>

      {manualOpen && (
        <div className="rounded-2xl bg-[hsl(var(--dark-card))] p-4 space-y-2 animate-in fade-in slide-in-from-top-2">
          <p className="text-xs font-bold text-[hsl(var(--dark-muted))] uppercase">Cadastro manual</p>
          <input className="input" placeholder="Nome do grupo" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          <input className="input" placeholder="ID do grupo (opcional, ex: 12345@g.us)" value={form.wa_group_id} onChange={e => setForm({ ...form, wa_group_id: e.target.value })} />
          <button onClick={add} className="w-full h-10 rounded-xl bg-[hsl(var(--dark-bg))] border border-[hsl(var(--dark-card-hover))] font-semibold text-sm">Adicionar</button>
        </div>
      )}

      <div className="rounded-2xl bg-[hsl(var(--dark-card))] p-3">
        {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto my-4" /> : items.length === 0 ? (
          <div className="py-10 text-center">
            <Users className="w-8 h-8 mx-auto text-[hsl(var(--dark-muted))] opacity-40 mb-2" />
            <p className="text-sm text-[hsl(var(--dark-muted))]">Nenhum grupo cadastrado ainda</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {items.map(g => {
              const initials = g.name.split(" ").slice(0, 2).map(s => s[0]?.toUpperCase() ?? "").join("");
              return (
                <li key={g.id} className="rounded-xl bg-[hsl(var(--dark-bg))] p-3 space-y-2.5">
                  <div className="flex items-center gap-3">
                    <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/40 to-primary/10 text-primary font-black text-sm grid place-items-center shrink-0 ring-1 ring-primary/20">
                      {initials || <Bot className="w-4 h-4" />}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold truncate">{g.name}</p>
                      <p className="text-[10px] text-[hsl(var(--dark-muted))] truncate font-mono">{g.wa_group_id || "sem ID vinculado"}</p>
                    </div>
                    <button onClick={() => remove(g.id)} className="p-1.5 text-destructive hover:bg-destructive/10 rounded-lg shrink-0"><Trash2 className="w-4 h-4" /></button>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <div className="inline-flex rounded-lg bg-[hsl(var(--dark-card))] p-0.5 text-[10px] font-semibold">
                      {(Object.keys(modes) as Group["respond_mode"][]).map((k) => (
                        <button
                          key={k}
                          onClick={() => update(g.id, { respond_mode: k })}
                          className={`px-2 py-1 rounded-md transition-colors ${
                            g.respond_mode === k ? "bg-primary text-primary-foreground" : "text-[hsl(var(--dark-muted))] hover:text-[hsl(var(--dark-text))]"
                          }`}
                        >
                          {modes[k]}
                        </button>
                      ))}
                    </div>
                    <button
                      onClick={() => update(g.id, { forward_notifications: !g.forward_notifications })}
                      disabled={!g.wa_group_id}
                      className={`ml-auto text-[10px] px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 font-semibold transition-colors ${
                        g.forward_notifications
                          ? "bg-primary/15 text-primary ring-1 ring-primary/30"
                          : "bg-[hsl(var(--dark-card))] text-[hsl(var(--dark-muted))] ring-1 ring-[hsl(var(--dark-card-hover))]"
                      } ${!g.wa_group_id ? "opacity-40 cursor-not-allowed" : ""}`}
                      title={g.wa_group_id ? "" : "Vincule um ID de grupo primeiro"}
                    >
                      {g.forward_notifications ? <Bell className="w-3 h-3" /> : <BellOff className="w-3 h-3" />}
                      {g.forward_notifications ? "Notifica" : "Silenciado"}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {discoverOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm grid place-items-center p-4">
          {(() => {
            const filtered = waGroups.filter((g) => g.name.toLowerCase().includes(query.toLowerCase()));
            const selCount = Object.values(selected).filter(Boolean).length;
            return (
              <div className="w-full max-w-lg max-h-[88vh] flex flex-col bg-[hsl(var(--dark-bg))] rounded-3xl ring-1 ring-[hsl(var(--dark-card-hover))] overflow-hidden shadow-2xl">
                <div className="p-4 pb-3 border-b border-[hsl(var(--dark-card-hover))] bg-gradient-to-b from-primary/10 to-transparent">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                      <span className="w-9 h-9 rounded-xl bg-primary/20 grid place-items-center ring-1 ring-primary/30">
                        <Users className="w-4 h-4 text-primary" />
                      </span>
                      <div>
                        <p className="font-bold text-sm leading-tight">Grupos do WhatsApp</p>
                        <p className="text-[10px] text-[hsl(var(--dark-muted))]">
                          {discovering ? "Consultando…" : `${waGroups.length} disponíveis · ${selCount} selecionados`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={openDiscover} disabled={discovering} className="p-2 hover:bg-[hsl(var(--dark-card))] rounded-lg disabled:opacity-40" title="Atualizar">
                        <RefreshCw className={`w-4 h-4 ${discovering ? "animate-spin" : ""}`} />
                      </button>
                      <button onClick={() => setDiscoverOpen(false)} className="p-2 hover:bg-[hsl(var(--dark-card))] rounded-lg"><X className="w-4 h-4" /></button>
                    </div>
                  </div>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[hsl(var(--dark-muted))]" />
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Filtrar grupos…"
                      className="w-full h-10 pl-9 pr-3 rounded-xl bg-[hsl(var(--dark-card))] text-sm placeholder:text-[hsl(var(--dark-muted))] border border-transparent focus:border-primary/40 outline-none"
                    />
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-3">
                  {discovering ? (
                    <div className="py-16 flex flex-col items-center gap-2 text-[hsl(var(--dark-muted))]">
                      <Loader2 className="w-6 h-6 animate-spin" />
                      <p className="text-xs">Consultando o WhatsApp…</p>
                    </div>
                  ) : filtered.length === 0 ? (
                    <div className="py-16 text-center">
                      <Users className="w-10 h-10 mx-auto text-[hsl(var(--dark-muted))] opacity-30 mb-2" />
                      <p className="text-sm text-[hsl(var(--dark-muted))]">
                        {waGroups.length === 0 ? "Nenhum grupo novo encontrado." : "Nenhum resultado para esse filtro."}
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 pb-2 px-1">
                        <button onClick={selectAll} className="text-[11px] font-semibold text-primary hover:underline">Selecionar todos</button>
                        <span className="text-[hsl(var(--dark-muted))]">·</span>
                        <button onClick={clearAll} className="text-[11px] text-[hsl(var(--dark-muted))] hover:underline">Limpar</button>
                      </div>
                      <ul className="space-y-1.5">
                        {filtered.map((g) => {
                          const on = !!selected[g.wa_group_id];
                          const initials = g.name.split(" ").slice(0, 2).map(s => s[0]?.toUpperCase() ?? "").join("");
                          return (
                            <li key={g.wa_group_id}>
                              <button
                                onClick={() => toggleSelect(g.wa_group_id)}
                                className={`w-full flex items-center gap-3 p-2.5 rounded-xl text-left transition-all ${
                                  on ? "bg-primary/15 ring-1 ring-primary/50" : "bg-[hsl(var(--dark-card))] hover:bg-[hsl(var(--dark-card-hover))] ring-1 ring-transparent"
                                }`}
                              >
                                <span className={`w-10 h-10 rounded-xl grid place-items-center shrink-0 font-black text-sm ${
                                  on ? "bg-primary text-primary-foreground" : "bg-gradient-to-br from-primary/30 to-primary/5 text-primary ring-1 ring-primary/20"
                                }`}>
                                  {on ? <Check className="w-5 h-5" strokeWidth={3} /> : (initials || <Bot className="w-4 h-4" />)}
                                </span>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-semibold truncate">{g.name}</p>
                                  <p className="text-[10px] text-[hsl(var(--dark-muted))] truncate">
                                    {g.size ? `${g.size} membros · ` : ""}<span className="font-mono">{g.wa_group_id}</span>
                                  </p>
                                </div>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    </>
                  )}
                </div>

                <div className="p-4 border-t border-[hsl(var(--dark-card-hover))] space-y-3 bg-[hsl(var(--dark-card))]/40">
                  <button
                    type="button"
                    onClick={() => setForwardOnImport((v) => !v)}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-colors ${
                      forwardOnImport ? "bg-primary/10 ring-1 ring-primary/30" : "bg-[hsl(var(--dark-bg))] ring-1 ring-[hsl(var(--dark-card-hover))]"
                    }`}
                  >
                    <span className={`w-9 h-9 rounded-lg grid place-items-center shrink-0 ${forwardOnImport ? "bg-primary text-primary-foreground" : "bg-[hsl(var(--dark-card))] text-[hsl(var(--dark-muted))]"}`}>
                      {forwardOnImport ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold">Encaminhar notificações do app</p>
                      <p className="text-[10px] text-[hsl(var(--dark-muted))] leading-snug">
                        Todo push enviado aos usuários também será postado nesses grupos.
                      </p>
                    </div>
                  </button>
                  <button
                    onClick={importSelected}
                    disabled={importing || discovering || selCount === 0}
                    className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-40"
                  >
                    {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    Importar {selCount > 0 ? `(${selCount})` : "selecionados"}
                  </button>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      <style>{`.input{width:100%;height:42px;padding:0 12px;border-radius:12px;background:hsl(var(--dark-bg));color:hsl(var(--dark-text));border:1px solid hsl(var(--dark-card-hover));font-size:14px}`}</style>
    </div>
  );
};

export default AtisGroups;