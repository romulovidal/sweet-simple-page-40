import { useEffect, useState } from "react";
import { Clock3, Loader2, Pencil, Plus, Save, Trash2, WandSparkles, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Automation = {
  id: string;
  key: string;
  name: string;
  description?: string | null;
  type: string;
  enabled: boolean;
  timezone: string;
  trigger_type: string;
  schedule_cron?: string | null;
  target_selector?: Record<string, any> | null;
  config?: Record<string, any> | null;
  last_run_at?: string | null;
};

type FormState = {
  id?: string;
  name: string;
  description: string;
  type: string;
  enabled: boolean;
  schedule_cron: string;
  target_mode: "all_opted_in" | "all_groups";
  content: string;
};

const emptyForm = (): FormState => ({ name: "", description: "", type: "custom", enabled: false, schedule_cron: "0 19 * * *", target_mode: "all_opted_in", content: "" });

async function invoke(body: Record<string, unknown>) {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) throw new Error("Sua sessão administrativa expirou.");
  const { data, error } = await supabase.functions.invoke("atis-console", { body, headers: { Authorization: `Bearer ${token}` } });
  if (error) {
    const response = error?.context;
    if (response instanceof Response) {
      try { const parsed = await response.clone().json(); throw new Error(parsed?.message || parsed?.error || error.message); } catch (err) { if (err instanceof Error && err.message !== error.message) throw err; }
    }
    throw new Error(error.message || "Falha no ATIS.");
  }
  return data as any;
}

function formatLast(value?: string | null) {
  if (!value) return "Ainda não executada";
  try { return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Fortaleza" }).format(new Date(value)); }
  catch { return "Ainda não executada"; }
}

export default function AtisAutomations() {
  const [rows, setRows] = useState<Automation[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = async () => {
    setLoading(true); setError(null);
    try { const result = await invoke({ action: "automations_list" }); setRows(result.rows ?? []); }
    catch (err) { setError(err instanceof Error ? err.message : "Falha ao carregar automações."); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);

  const edit = (row: Automation) => setEditing({
    id: row.id,
    name: row.name,
    description: row.description ?? "",
    type: row.type,
    enabled: row.enabled,
    schedule_cron: row.schedule_cron ?? "0 19 * * *",
    target_mode: row.target_selector?.mode === "all_groups" ? "all_groups" : "all_opted_in",
    content: String(row.config?.content ?? ""),
  });

  const save = async () => {
    if (!editing) return;
    setSaving(true); setError(null); setNotice(null);
    try {
      await invoke({ action: "automation_save", data: {
        id: editing.id,
        name: editing.name,
        description: editing.description,
        type: editing.type,
        enabled: editing.enabled,
        trigger_type: "schedule",
        schedule_cron: editing.schedule_cron,
        target_selector: { mode: editing.target_mode },
        content: editing.content,
        config: { content: editing.content },
      } });
      setNotice(editing.id ? "Automação atualizada." : "Automação criada.");
      setEditing(null); await load();
    } catch (err) { setError(err instanceof Error ? err.message : "Falha ao salvar automação."); }
    finally { setSaving(false); }
  };

  const remove = async (row: Automation) => {
    if (!window.confirm(`Excluir a automação “${row.name}”?`)) return;
    setError(null); setNotice(null);
    try { await invoke({ action: "automation_delete", data: { id: row.id } }); setNotice("Automação excluída."); await load(); }
    catch (err) { setError(err instanceof Error ? err.message : "Falha ao excluir."); }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 flex items-start gap-3">
        <WandSparkles className="w-5 h-5 text-primary mt-0.5" />
        <div className="flex-1"><h2 className="text-sm font-bold">Automações do ATIS</h2><p className="text-[11px] text-[hsl(var(--dark-muted))] mt-1">Crie rotinas recorrentes usando o motor e a fila já existentes. Grupos só recebem automações quando essa permissão estiver ativa no próprio grupo.</p><button onClick={() => setEditing(emptyForm())} className="mt-3 h-10 px-4 rounded-xl bg-primary text-primary-foreground text-xs font-bold inline-flex items-center gap-2"><Plus className="w-4 h-4" /> Nova automação</button></div>
      </div>

      {error && <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive">{error}</div>}
      {notice && <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs text-emerald-400">{notice}</div>}

      {loading ? <div className="py-14 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div> : rows.length === 0 ? (
        <div className="rounded-2xl bg-[hsl(var(--dark-card))] border border-[hsl(var(--dark-card-hover))] p-8 text-center"><WandSparkles className="w-9 h-9 mx-auto text-[hsl(var(--dark-muted))] opacity-50" /><p className="text-sm font-bold mt-3">Nenhuma automação geral cadastrada</p><p className="text-[11px] text-[hsl(var(--dark-muted))] mt-1">Aniversários e conteúdos por destinatário continuam independentes. Esta área é para novas rotinas gerais.</p></div>
      ) : <div className="space-y-2">{rows.map((row) => <div key={row.id} className="rounded-2xl bg-[hsl(var(--dark-card))] border border-[hsl(var(--dark-card-hover))] p-4"><div className="flex items-start gap-3"><span className={`w-2.5 h-2.5 rounded-full mt-1.5 ${row.enabled ? "bg-emerald-400" : "bg-[hsl(var(--dark-muted))]"}`} /><div className="min-w-0 flex-1"><div className="flex items-center gap-2 flex-wrap"><p className="text-sm font-bold">{row.name}</p><span className="text-[9px] px-2 py-0.5 rounded-full bg-primary/10 text-primary">{row.type}</span></div>{row.description && <p className="text-[10px] text-[hsl(var(--dark-muted))] mt-1">{row.description}</p>}<p className="text-[10px] text-[hsl(var(--dark-muted))] mt-2 flex gap-2 flex-wrap"><span className="inline-flex items-center gap-1"><Clock3 className="w-3 h-3" /> {row.schedule_cron}</span><span>• {row.target_selector?.mode === "all_groups" ? "Todos os grupos permitidos" : "Contatos com consentimento"}</span><span>• {formatLast(row.last_run_at)}</span></p></div><button onClick={() => edit(row)} className="w-8 h-8 rounded-lg grid place-items-center bg-[hsl(var(--dark-bg))]"><Pencil className="w-4 h-4" /></button><button onClick={() => remove(row)} className="w-8 h-8 rounded-lg grid place-items-center text-destructive bg-destructive/10"><Trash2 className="w-4 h-4" /></button></div></div>)}</div>}

      {editing && <div className="fixed inset-0 z-[90] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center"><div className="w-full sm:max-w-xl max-h-[94dvh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-[hsl(var(--dark-bg))] border border-[hsl(var(--dark-card-hover))]"><div className="sticky top-0 bg-[hsl(var(--dark-bg))]/95 backdrop-blur p-4 border-b border-[hsl(var(--dark-card-hover))] flex items-center"><div className="flex-1"><p className="text-sm font-bold">{editing.id ? "Editar automação" : "Nova automação"}</p><p className="text-[10px] text-[hsl(var(--dark-muted))]">Fuso: America/Fortaleza</p></div><button onClick={() => setEditing(null)} className="w-9 h-9 rounded-xl bg-[hsl(var(--dark-card))] grid place-items-center"><X className="w-4 h-4" /></button></div><div className="p-4 space-y-4 pb-24">
        <Field label="Nome *"><input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} maxLength={160} className="field-auto" placeholder="Ex.: Palavra da semana" /></Field>
        <Field label="Descrição"><input value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} className="field-auto" /></Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><Field label="Tipo"><select value={editing.type} onChange={(e) => setEditing({ ...editing, type: e.target.value })} className="field-auto"><option value="custom">Personalizada</option><option value="devotional">Devocional</option><option value="daily_verse">Versículo do dia</option><option value="reading_plan">Plano de leitura</option><option value="culto">Culto</option><option value="series">Série</option><option value="inactivity">Inatividade</option><option value="goal">Meta</option><option value="broadcast">Broadcast</option></select></Field><Field label="Destinatários"><select value={editing.target_mode} onChange={(e) => setEditing({ ...editing, target_mode: e.target.value as FormState["target_mode"] })} className="field-auto"><option value="all_opted_in">Contatos com consentimento</option><option value="all_groups">Todos os grupos permitidos</option></select></Field></div>
        <Field label="Cron (minuto hora dia mês semana) *"><input value={editing.schedule_cron} onChange={(e) => setEditing({ ...editing, schedule_cron: e.target.value })} className="field-auto font-mono" placeholder="0 19 * * 0" /><p className="text-[9px] text-[hsl(var(--dark-muted))] mt-1">Ex.: <strong>0 19 * * 0</strong> = domingo às 19:00. <strong>0 7 * * *</strong> = todos os dias às 07:00.</p></Field>
        <Field label="Mensagem *"><textarea value={editing.content} onChange={(e) => setEditing({ ...editing, content: e.target.value })} maxLength={4096} rows={6} className="field-auto h-auto py-3 resize-y" placeholder="Use {{nome}}, {{data}} e {{hora}} quando fizer sentido." /></Field>
        <label className="rounded-xl bg-[hsl(var(--dark-card))] p-3 flex items-center justify-between"><span><span className="block text-xs font-bold">Ativada</span><span className="block text-[9px] text-[hsl(var(--dark-muted))] mt-0.5">Quando ativa, o runner avalia o cron automaticamente.</span></span><input type="checkbox" checked={editing.enabled} onChange={(e) => setEditing({ ...editing, enabled: e.target.checked })} className="w-5 h-5 accent-primary" /></label>
      </div><div className="sticky bottom-0 p-3 border-t border-[hsl(var(--dark-card-hover))] bg-[hsl(var(--dark-bg))]/95 backdrop-blur"><button onClick={save} disabled={saving} className="w-full h-12 rounded-xl bg-primary text-primary-foreground text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-40">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}{saving ? "Salvando…" : "Salvar automação"}</button></div></div></div>}

      <style>{`.field-auto{width:100%;min-height:44px;border-radius:12px;border:1px solid hsl(var(--dark-card-hover));background:hsl(var(--dark-card));padding:0 12px;color:hsl(var(--dark-text));font-size:12px;outline:none}.field-auto:focus{border-color:hsl(var(--primary))}`}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="text-[11px] font-bold">{label}</span><div className="mt-1.5">{children}</div></label>;
}
