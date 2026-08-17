import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Cake,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  UsersRound,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Birthday = {
  id: string;
  source: "app" | "manual";
  user_id?: string | null;
  name: string;
  birth_date?: string | null;
  birth_day: number;
  birth_month: number;
  phone_e164?: string | null;
  tags?: string[];
  notes?: string | null;
};

type BirthdayGroup = {
  id: string;
  name: string;
  participant_count?: number;
  allow_automations: boolean;
  is_active: boolean;
  provider_exists: boolean;
};

type BirthdaySettings = {
  enabled: boolean;
  mode: "group_only";
  group_id?: string | null;
  send_time?: string | null;
  timezone: string;
  message_template?: string | null;
};

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

async function functionErrorMessage(error: any) {
  const fallback = error?.message || "Não foi possível concluir a operação.";
  const response = error?.context;
  if (!(response instanceof Response)) return fallback;
  try {
    const body = await response.clone().json();
    const code = body?.error;
    const friendly: Record<string, string> = {
      GROUP_AND_SEND_TIME_REQUIRED: "Escolha o grupo e o horário antes de ativar o agendamento.",
      GROUP_AUTOMATIONS_DISABLED: "Este grupo ainda não permite automações. Ative essa opção em Destinatários → Grupos.",
      GROUP_NOT_ACTIVE: "O grupo selecionado não está ativo no ATIS.",
      INVALID_SEND_TIME: "Informe um horário válido.",
      APP_BIRTHDAY_SOURCE_MANAGED: "Este aniversário vem do cadastro do app e deve ser alterado no perfil do usuário.",
      INVALID_BIRTH_DATE: "Informe o aniversário no formato DD/MM.",
    };
    return friendly[code] || body?.message || code || fallback;
  } catch {
    return fallback;
  }
}

async function invokeAtis<T = any>(body: Record<string, unknown>) {
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) throw new Error("Sua sessão administrativa expirou. Entre novamente.");
  const { data, error } = await supabase.functions.invoke("atis-birthdays", {
    body,
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (error) throw new Error(await functionErrorMessage(error));
  return data as T;
}

function formatBirthday(value: Pick<Birthday, "birth_day" | "birth_month">) {
  return `${String(value.birth_day).padStart(2, "0")}/${String(value.birth_month).padStart(2, "0")}`;
}

function maskBirthday(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

function isValidBirthday(value: string) {
  const match = value.match(/^(\d{2})\/(\d{2})$/);
  if (!match) return false;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const maxDay = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
  return Number.isInteger(day) && Number.isInteger(month) && month >= 1 && month <= 12 && day >= 1 && day <= maxDay;
}

function formatPhone(value?: string | null) {
  if (!value) return "Sem WhatsApp — permitido";
  const digits = value.replace(/\D/g, "");
  if (digits.startsWith("55") && digits.length >= 12) {
    const ddd = digits.slice(2, 4);
    const local = digits.slice(4);
    return `+55 (${ddd}) ${local.slice(0, local.length - 4)}-${local.slice(-4)}`;
  }
  return value;
}

const AtisBirthdays = () => {
  const defaultMonth = Number(new Intl.DateTimeFormat("en-US", { month: "numeric", timeZone: "America/Fortaleza" }).format(new Date()));
  const [month, setMonth] = useState(defaultMonth);
  const [birthdays, setBirthdays] = useState<Birthday[]>([]);
  const [groups, setGroups] = useState<BirthdayGroup[]>([]);
  const [settings, setSettings] = useState<BirthdaySettings>({ enabled: false, mode: "group_only", group_id: null, send_time: null, timezone: "America/Fortaleza", message_template: null });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [editor, setEditor] = useState<Birthday | "new" | null>(null);
  const [name, setName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [phone, setPhone] = useState("");
  const [tags, setTags] = useState("");
  const [notes, setNotes] = useState("");
  const [groupId, setGroupId] = useState("");
  const [sendTime, setSendTime] = useState("");
  const [template, setTemplate] = useState("");
  const [enabled, setEnabled] = useState(false);

  const clearMessages = () => { setError(null); setNotice(null); };

  const load = useCallback(async () => {
    setLoading(true);
    clearMessages();
    try {
      const [list, groupResult] = await Promise.all([
        invokeAtis<{ birthdays: Birthday[]; settings: BirthdaySettings }>( { action: "list", data: { month } } ),
        invokeAtis<{ groups: BirthdayGroup[] }>( { action: "groups" } ),
      ]);
      setBirthdays(list.birthdays ?? []);
      setGroups(groupResult.groups ?? []);
      const next = list.settings ?? settings;
      setSettings(next);
      setGroupId(next.group_id ?? "");
      setSendTime(next.send_time ?? "");
      setTemplate(next.message_template ?? "");
      setEnabled(next.enabled === true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao carregar aniversariantes.");
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => { void load(); }, [load]);

  const run = async (key: string, task: () => Promise<void>) => {
    clearMessages();
    setBusy(key);
    try { await task(); }
    catch (err) { setError(err instanceof Error ? err.message : "Não foi possível concluir a operação."); }
    finally { setBusy(null); }
  };

  const selectedGroup = useMemo(() => groups.find((group) => group.id === groupId) ?? null, [groups, groupId]);

  const syncApp = () => run("sync", async () => {
    const result = await invokeAtis<{ app_birthdays?: { found?: number; created?: number; updated?: number } }>({ action: "sync_app" });
    await load();
    setNotice(`${Number(result.app_birthdays?.found ?? 0)} aniversário(s) do cadastro do app conferidos. WhatsApp não é obrigatório.`);
  });

  const openNew = () => {
    clearMessages();
    setEditor("new");
    setName("");
    setBirthDate("");
    setPhone("");
    setTags("");
    setNotes("");
  };

  const openEdit = (birthday: Birthday) => {
    if (birthday.source === "app") return;
    clearMessages();
    setEditor(birthday);
    setName(birthday.name);
    setBirthDate(formatBirthday(birthday));
    setPhone(birthday.phone_e164 ?? "");
    setTags((birthday.tags ?? []).join(", "));
    setNotes(birthday.notes ?? "");
  };

  const saveBirthday = () => run("save", async () => {
    const data = {
      name,
      birth_date: birthDate,
      phone: phone.trim() || null,
      tags: tags.split(",").map((value) => value.trim()).filter(Boolean),
      notes: notes.trim() || null,
    };
    if (editor === "new") await invokeAtis({ action: "create", data });
    else if (editor) await invokeAtis({ action: "update", data: { id: editor.id, ...data } });
    setEditor(null);
    await load();
    setNotice(editor === "new" ? "Aniversariante cadastrado." : "Aniversariante atualizado.");
  });

  const archiveBirthday = (birthday: Birthday) => {
    if (birthday.source !== "manual") return;
    if (!window.confirm(`Arquivar o aniversário de ${birthday.name}?`)) return;
    void run(`archive-${birthday.id}`, async () => {
      await invokeAtis({ action: "archive", data: { id: birthday.id } });
      await load();
    });
  };

  const saveSchedule = () => run("schedule", async () => {
    const result = await invokeAtis<{ settings: BirthdaySettings }>({
      action: "settings_update",
      data: {
        group_id: groupId || null,
        send_time: sendTime || null,
        enabled,
        timezone: "America/Fortaleza",
        message_template: template.trim() || null,
      },
    });
    setSettings(result.settings);
    setNotice(enabled ? "Agendamento de aniversários ativado para o grupo selecionado." : "Configuração salva. O agendamento permanece desativado.");
  });

  if (loading) {
    return <div className="py-16 flex justify-center"><Loader2 className="w-7 h-7 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl p-4 sm:p-5 bg-[hsl(var(--dark-card))] border border-[hsl(var(--dark-card-hover))]/50">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <span className="w-11 h-11 rounded-xl grid place-items-center bg-primary/15 text-primary shrink-0"><Cake className="w-5 h-5" /></span>
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-primary">Aniversariantes ATIS</p>
              <h2 className="text-lg font-bold text-[hsl(var(--dark-text))] mt-1">Aniversariantes do mês</h2>
              <p className="text-xs text-[hsl(var(--dark-muted))] mt-1">Nome e aniversário em DD/MM são suficientes. O ano de nascimento não é solicitado nem usado pelo ATIS. O WhatsApp é opcional.</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={syncApp} disabled={busy !== null} className="h-10 px-3 rounded-xl bg-[hsl(var(--dark-bg))] text-[11px] font-semibold flex items-center gap-2 disabled:opacity-40"><RefreshCw className={`w-4 h-4 ${busy === "sync" ? "animate-spin" : ""}`} /> Cadastros do app</button>
            <button onClick={openNew} disabled={busy !== null} className="h-10 px-4 rounded-xl bg-primary text-primary-foreground text-xs font-bold flex items-center gap-2 disabled:opacity-40"><Plus className="w-4 h-4" /> Novo</button>
          </div>
        </div>
      </div>

      {error && <div className="rounded-2xl p-4 border border-destructive/20 bg-destructive/10 text-destructive flex gap-3"><AlertTriangle className="w-5 h-5 shrink-0" /><p className="text-sm">{error}</p></div>}
      {notice && <div className="rounded-2xl p-4 border border-emerald-500/20 bg-emerald-500/10 text-emerald-400 flex gap-3"><CheckCircle2 className="w-5 h-5 shrink-0" /><p className="text-sm">{notice}</p></div>}

      <div className="rounded-2xl p-4 bg-[hsl(var(--dark-card))] border border-[hsl(var(--dark-card-hover))]/50">
        <div className="flex items-center gap-3">
          <CalendarDays className="w-5 h-5 text-primary" />
          <select value={month} onChange={(event) => setMonth(Number(event.target.value))} className="h-10 rounded-xl bg-[hsl(var(--dark-bg))] border border-[hsl(var(--dark-card-hover))] px-3 text-sm text-[hsl(var(--dark-text))] outline-none">
            {MONTHS.map((label, index) => <option key={label} value={index + 1}>{label}</option>)}
          </select>
          <span className="ml-auto text-xs text-[hsl(var(--dark-muted))]">{birthdays.length} cadastrado(s)</span>
        </div>

        <div className="mt-4 space-y-2">
          {!birthdays.length ? (
            <div className="rounded-xl bg-[hsl(var(--dark-bg))] p-6 text-center text-sm text-[hsl(var(--dark-muted))]">Nenhum aniversariante cadastrado neste mês.</div>
          ) : birthdays.map((birthday) => (
            <div key={birthday.id} className="rounded-xl bg-[hsl(var(--dark-bg))] p-3 sm:p-4 flex items-center gap-3">
              <span className="w-11 h-11 rounded-xl grid place-items-center bg-primary/10 text-primary font-bold shrink-0">{String(birthday.birth_day).padStart(2, "0")}</span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-bold text-[hsl(var(--dark-text))] truncate">{birthday.name}</p>
                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${birthday.source === "app" ? "bg-sky-500/10 text-sky-400" : "bg-primary/10 text-primary"}`}>{birthday.source === "app" ? "Cadastro do app" : "Manual"}</span>
                </div>
                <p className="text-[11px] text-[hsl(var(--dark-muted))] mt-1">🎂 {formatBirthday(birthday)} • {formatPhone(birthday.phone_e164)}</p>
              </div>
              {birthday.source === "manual" && (
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => openEdit(birthday)} className="w-9 h-9 rounded-xl grid place-items-center text-[hsl(var(--dark-muted))] hover:bg-[hsl(var(--dark-card-hover))]" aria-label="Editar"><Pencil className="w-4 h-4" /></button>
                  <button onClick={() => archiveBirthday(birthday)} className="w-9 h-9 rounded-xl grid place-items-center text-destructive hover:bg-destructive/10" aria-label="Arquivar"><Trash2 className="w-4 h-4" /></button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl p-4 sm:p-5 bg-[hsl(var(--dark-card))] border border-[hsl(var(--dark-card-hover))]/50">
        <div className="flex items-start gap-3">
          <span className="w-11 h-11 rounded-xl grid place-items-center bg-primary/15 text-primary shrink-0"><UsersRound className="w-5 h-5" /></span>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-bold text-[hsl(var(--dark-text))]">Mensagem automática no grupo de aniversário</h3>
            <p className="text-[11px] text-[hsl(var(--dark-muted))] mt-1">O ATIS consulta os aniversariantes do dia e envia uma única mensagem ao grupo escolhido. Nenhuma mensagem individual é criada por este agendamento.</p>
          </div>
          <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${enabled ? "bg-emerald-500/15 text-emerald-400" : "bg-[hsl(var(--dark-bg))] text-[hsl(var(--dark-muted))]"}`}>{enabled ? "Ativo" : "Desativado"}</span>
        </div>

        <div className="grid sm:grid-cols-2 gap-3 mt-4">
          <label className="space-y-1.5">
            <span className="text-[10px] uppercase tracking-wider text-[hsl(var(--dark-muted))]">Grupo Feliz Aniversário</span>
            <select value={groupId} onChange={(event) => setGroupId(event.target.value)} className="w-full h-11 rounded-xl bg-[hsl(var(--dark-bg))] border border-[hsl(var(--dark-card-hover))] px-3 text-sm text-[hsl(var(--dark-text))] outline-none">
              <option value="">Selecione um grupo cadastrado</option>
              {groups.map((group) => <option key={group.id} value={group.id}>{group.name}{group.allow_automations ? "" : " — automações OFF"}</option>)}
            </select>
          </label>
          <label className="space-y-1.5">
            <span className="text-[10px] uppercase tracking-wider text-[hsl(var(--dark-muted))]">Horário diário</span>
            <div className="relative"><Clock3 className="absolute left-3 top-3.5 w-4 h-4 text-[hsl(var(--dark-muted))]" /><input type="time" value={sendTime} onChange={(event) => setSendTime(event.target.value)} className="w-full h-11 rounded-xl bg-[hsl(var(--dark-bg))] border border-[hsl(var(--dark-card-hover))] pl-10 pr-3 text-sm text-[hsl(var(--dark-text))] outline-none" /></div>
          </label>
        </div>

        {selectedGroup && !selectedGroup.allow_automations && <div className="mt-3 rounded-xl bg-amber-500/10 border border-amber-500/20 p-3 text-[11px] text-amber-400">Este grupo ainda está com “Automações” desligado. Ative em <strong>Destinatários → Grupos</strong> antes de ligar o agendamento.</div>}

        <label className="block space-y-1.5 mt-3">
          <span className="text-[10px] uppercase tracking-wider text-[hsl(var(--dark-muted))]">Mensagem personalizada — opcional</span>
          <textarea value={template} onChange={(event) => setTemplate(event.target.value)} rows={4} placeholder="Deixe vazio para usar a mensagem padrão. Tokens disponíveis: {{nome}}, {{nomes}}, {{quantidade}}, {{grupo}}, {{data}}" className="w-full rounded-xl bg-[hsl(var(--dark-bg))] border border-[hsl(var(--dark-card-hover))] p-3 text-sm text-[hsl(var(--dark-text))] placeholder:text-[hsl(var(--dark-muted))]/60 outline-none resize-y" />
        </label>

        <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-[hsl(var(--dark-text))] cursor-pointer">
            <input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} className="w-4 h-4 accent-primary" />
            Ativar agendamento automático
          </label>
          <button onClick={saveSchedule} disabled={busy !== null} className="sm:ml-auto h-10 px-4 rounded-xl bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center gap-2 disabled:opacity-40">{busy === "schedule" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Salvar configuração</button>
        </div>
      </div>

      {editor && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm p-4 flex items-center justify-center">
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-[hsl(var(--dark-card))] border border-[hsl(var(--dark-card-hover))] p-5 shadow-2xl">
            <div className="flex items-center justify-between gap-3">
              <div><p className="text-[10px] uppercase tracking-[0.2em] text-primary">{editor === "new" ? "Novo cadastro" : "Editar cadastro"}</p><h3 className="text-lg font-bold text-[hsl(var(--dark-text))] mt-1">Aniversariante</h3></div>
              <button onClick={() => setEditor(null)} className="w-9 h-9 rounded-xl grid place-items-center bg-[hsl(var(--dark-bg))] text-[hsl(var(--dark-muted))]"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-3 mt-5">
              <label className="block space-y-1.5"><span className="text-xs text-[hsl(var(--dark-muted))]">Nome *</span><input value={name} onChange={(event) => setName(event.target.value)} className="w-full h-11 rounded-xl bg-[hsl(var(--dark-bg))] border border-[hsl(var(--dark-card-hover))] px-3 text-sm text-[hsl(var(--dark-text))] outline-none" /></label>
              <div className="grid sm:grid-cols-2 gap-3">
                <label className="block space-y-1.5"><span className="text-xs text-[hsl(var(--dark-muted))]">Aniversário (DD/MM) *</span><input type="text" inputMode="numeric" maxLength={5} value={birthDate} onChange={(event) => setBirthDate(maskBirthday(event.target.value))} placeholder="Ex.: 25/12" className="w-full h-11 rounded-xl bg-[hsl(var(--dark-bg))] border border-[hsl(var(--dark-card-hover))] px-3 text-sm text-[hsl(var(--dark-text))] outline-none" /></label>
                <label className="block space-y-1.5"><span className="text-xs text-[hsl(var(--dark-muted))]">WhatsApp — opcional</span><input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="Pode deixar vazio" className="w-full h-11 rounded-xl bg-[hsl(var(--dark-bg))] border border-[hsl(var(--dark-card-hover))] px-3 text-sm text-[hsl(var(--dark-text))] outline-none" /></label>
              </div>
              <label className="block space-y-1.5"><span className="text-xs text-[hsl(var(--dark-muted))]">Tags</span><input value={tags} onChange={(event) => setTags(event.target.value)} placeholder="jovens, obreiros, coral" className="w-full h-11 rounded-xl bg-[hsl(var(--dark-bg))] border border-[hsl(var(--dark-card-hover))] px-3 text-sm text-[hsl(var(--dark-text))] outline-none" /></label>
              <label className="block space-y-1.5"><span className="text-xs text-[hsl(var(--dark-muted))]">Observações</span><textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} className="w-full rounded-xl bg-[hsl(var(--dark-bg))] border border-[hsl(var(--dark-card-hover))] p-3 text-sm text-[hsl(var(--dark-text))] outline-none resize-y" /></label>
            </div>
            <div className="mt-5 flex justify-end gap-2"><button onClick={() => setEditor(null)} className="h-10 px-4 rounded-xl bg-[hsl(var(--dark-bg))] text-xs font-semibold text-[hsl(var(--dark-text))]">Cancelar</button><button onClick={saveBirthday} disabled={!name.trim() || !isValidBirthday(birthDate) || busy !== null} className="h-10 px-4 rounded-xl bg-primary text-primary-foreground text-xs font-bold flex items-center gap-2 disabled:opacity-40">{busy === "save" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Salvar</button></div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AtisBirthdays;
