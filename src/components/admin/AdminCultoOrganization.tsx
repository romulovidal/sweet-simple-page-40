import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CalendarDays, Church, Clock3, MapPin, Mic2, Pencil, Plus, Save, ScrollText, Trash2, UserRound, X } from "lucide-react";

type Schedule = {
  id: string;
  name: string;
  day_of_week: number;
  time: string;
  is_active: boolean;
};

type CultoEvent = {
  id: string;
  schedule_id: string | null;
  title: string;
  service_date: string;
  start_time: string | null;
  minister_name: string | null;
  leader_name: string | null;
  theme: string | null;
  scripture_reference: string | null;
  location: string | null;
  notes: string | null;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
};

type FormState = Omit<CultoEvent, "id"> & { id?: string };

const DOW = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const todayISO = () => {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
};

const emptyForm = (): FormState => ({
  schedule_id: null,
  title: "Culto",
  service_date: todayISO(),
  start_time: null,
  minister_name: null,
  leader_name: null,
  theme: null,
  scripture_reference: null,
  location: null,
  notes: null,
  is_active: true,
});

function fmtDate(value: string) {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1).toLocaleDateString("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  });
}

function clean(value: string | null | undefined) {
  const text = String(value ?? "").trim();
  return text || null;
}

export default function AdminCultoOrganization() {
  const [events, setEvents] = useState<CultoEvent[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [eventsRes, schedulesRes] = await Promise.all([
      (supabase as any).from("culto_events").select("*").order("service_date", { ascending: true }).order("start_time", { ascending: true }),
      supabase.from("culto_schedules").select("id,name,day_of_week,time,is_active").order("day_of_week").order("time"),
    ]);
    if (eventsRes.error) toast.error("Não foi possível carregar a organização dos cultos");
    setEvents((eventsRes.data as CultoEvent[]) || []);
    setSchedules((schedulesRes.data as Schedule[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const upcoming = useMemo(() => {
    const today = todayISO();
    return events.filter((event) => event.service_date >= today).slice(0, 30);
  }, [events]);

  const selectSchedule = (scheduleId: string) => {
    const schedule = schedules.find((item) => item.id === scheduleId);
    setEditing((current) => current ? {
      ...current,
      schedule_id: scheduleId || null,
      ...(schedule ? {
        title: current.title === "Culto" || !current.title.trim() ? schedule.name : current.title,
        start_time: current.start_time || schedule.time.slice(0, 5),
      } : {}),
    } : current);
  };

  const save = async () => {
    if (!editing) return;
    if (!editing.title.trim()) return toast.error("Informe o nome/tipo do culto");
    if (!editing.service_date) return toast.error("Informe a data do culto");

    setSaving(true);
    const payload = {
      schedule_id: editing.schedule_id || null,
      title: editing.title.trim(),
      service_date: editing.service_date,
      start_time: clean(editing.start_time),
      minister_name: clean(editing.minister_name),
      leader_name: clean(editing.leader_name),
      theme: clean(editing.theme),
      scripture_reference: clean(editing.scripture_reference),
      location: clean(editing.location),
      notes: clean(editing.notes),
      is_active: editing.is_active,
    };

    const request = editing.id
      ? (supabase as any).from("culto_events").update(payload).eq("id", editing.id)
      : (supabase as any).from("culto_events").insert(payload);
    const { error } = await request;
    setSaving(false);
    if (error) return toast.error(error.message || "Erro ao salvar culto");
    toast.success(editing.id ? "Organização atualizada" : "Culto organizado");
    setEditing(null);
    load();
  };

  const remove = async (event: CultoEvent) => {
    if (!window.confirm(`Excluir a organização de “${event.title}” em ${fmtDate(event.service_date)}?`)) return;
    const { error } = await (supabase as any).from("culto_events").delete().eq("id", event.id);
    if (error) return toast.error("Não foi possível excluir");
    toast.success("Organização removida");
    load();
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/15 text-primary flex items-center justify-center shrink-0"><Church className="w-5 h-5" /></div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold">Organização do culto</p>
            <p className="text-xs text-[hsl(var(--dark-muted))] mt-1 leading-relaxed">
              Cadastre os detalhes reais de cada data. O ATIS usa estes dados para responder ministro, tema, horário, texto-base, dirigente e local sem inventar informações.
            </p>
          </div>
        </div>
        <button onClick={() => setEditing(emptyForm())} className="mt-4 w-full sm:w-auto h-11 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-semibold flex items-center justify-center gap-2">
          <Plus className="w-4 h-4" /> Organizar novo culto
        </button>
      </div>

      {loading ? (
        <div className="py-10 text-center text-sm text-[hsl(var(--dark-muted))]">Carregando cultos…</div>
      ) : upcoming.length === 0 ? (
        <div className="rounded-2xl border border-[hsl(var(--dark-card-hover))] bg-[hsl(var(--dark-card))] p-8 text-center">
          <CalendarDays className="w-9 h-9 mx-auto text-[hsl(var(--dark-muted))] opacity-60" />
          <p className="text-sm font-semibold mt-3">Nenhum culto específico organizado</p>
          <p className="text-xs text-[hsl(var(--dark-muted))] mt-1">A agenda recorrente continua válida; adicione uma data quando souber ministro, tema ou outros detalhes.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {upcoming.map((event) => {
            const schedule = schedules.find((item) => item.id === event.schedule_id);
            const time = event.start_time?.slice(0, 5) || schedule?.time?.slice(0, 5) || null;
            return (
              <div key={event.id} className="rounded-2xl border border-[hsl(var(--dark-card-hover))] bg-[hsl(var(--dark-card))] p-4">
                <div className="flex gap-3">
                  <div className="w-12 shrink-0 text-center rounded-xl bg-[hsl(var(--dark-bg))] py-2">
                    <p className="text-[10px] uppercase text-primary font-bold">{DOW[new Date(`${event.service_date}T12:00:00`).getDay()]}</p>
                    <p className="text-lg font-black leading-none mt-1">{event.service_date.slice(8, 10)}</p>
                    <p className="text-[10px] text-[hsl(var(--dark-muted))]">/{event.service_date.slice(5, 7)}</p>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-bold truncate">{event.title}</p>
                        <p className="text-[11px] text-[hsl(var(--dark-muted))] mt-0.5 flex flex-wrap gap-x-3 gap-y-1">
                          {time && <span className="inline-flex items-center gap-1"><Clock3 className="w-3 h-3" /> {time}</span>}
                          {event.minister_name && <span className="inline-flex items-center gap-1"><Mic2 className="w-3 h-3" /> {event.minister_name}</span>}
                        </p>
                      </div>
                      <div className="flex shrink-0">
                        <button onClick={() => setEditing({ ...event })} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-[hsl(var(--dark-card-hover))]" aria-label="Editar"><Pencil className="w-4 h-4" /></button>
                        <button onClick={() => remove(event)} className="w-8 h-8 rounded-lg flex items-center justify-center text-destructive hover:bg-destructive/10" aria-label="Excluir"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </div>
                    {event.theme && <p className="mt-2 text-xs"><span className="text-[hsl(var(--dark-muted))]">Tema:</span> <strong>{event.theme}</strong></p>}
                    {event.scripture_reference && <p className="mt-1 text-[11px] text-[hsl(var(--dark-muted))] flex items-center gap-1"><ScrollText className="w-3 h-3" /> {event.scripture_reference}</p>}
                    {event.location && <p className="mt-1 text-[11px] text-[hsl(var(--dark-muted))] flex items-center gap-1"><MapPin className="w-3 h-3" /> {event.location}</p>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-[80] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center">
          <div className="w-full sm:max-w-2xl max-h-[94vh] rounded-t-3xl sm:rounded-3xl border border-[hsl(var(--dark-card-hover))] bg-[hsl(var(--dark-bg))] flex flex-col">
            <div className="px-4 py-3 border-b border-[hsl(var(--dark-card-hover))] flex items-center gap-3">
              <div className="flex-1"><p className="font-bold text-sm">{editing.id ? "Editar culto" : "Organizar culto"}</p><p className="text-[10px] text-[hsl(var(--dark-muted))]">Dados usados pelo app e pelo ATIS</p></div>
              <button onClick={() => setEditing(null)} className="w-9 h-9 rounded-full bg-[hsl(var(--dark-card))] flex items-center justify-center"><X className="w-4 h-4" /></button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 pb-28">
              <Field label="Agenda recorrente (opcional)">
                <select value={editing.schedule_id || ""} onChange={(e) => selectSchedule(e.target.value)} className="input-culto">
                  <option value="">Sem vínculo</option>
                  {schedules.filter((item) => item.is_active).map((schedule) => <option key={schedule.id} value={schedule.id}>{schedule.name} · {DOW[schedule.day_of_week]} {schedule.time.slice(0, 5)}</option>)}
                </select>
              </Field>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Nome / tipo do culto *"><input value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} maxLength={120} placeholder="Culto de Adoração" className="input-culto" /></Field>
                <Field label="Data *"><input type="date" value={editing.service_date} onChange={(e) => setEditing({ ...editing, service_date: e.target.value })} className="input-culto" /></Field>
                <Field label="Horário"><input type="time" value={editing.start_time?.slice(0, 5) || ""} onChange={(e) => setEditing({ ...editing, start_time: e.target.value || null })} className="input-culto" /></Field>
                <Field label="Ministro / pregador"><div className="relative"><Mic2 className="field-icon" /><input value={editing.minister_name || ""} onChange={(e) => setEditing({ ...editing, minister_name: e.target.value })} maxLength={160} placeholder="Pr. Nome" className="input-culto pl-10" /></div></Field>
                <Field label="Dirigente"><div className="relative"><UserRound className="field-icon" /><input value={editing.leader_name || ""} onChange={(e) => setEditing({ ...editing, leader_name: e.target.value })} maxLength={160} placeholder="Nome do dirigente" className="input-culto pl-10" /></div></Field>
                <Field label="Texto-base"><input value={editing.scripture_reference || ""} onChange={(e) => setEditing({ ...editing, scripture_reference: e.target.value })} maxLength={120} placeholder="Ex.: João 3:16" className="input-culto" /></Field>
              </div>

              <Field label="Tema"><input value={editing.theme || ""} onChange={(e) => setEditing({ ...editing, theme: e.target.value })} maxLength={300} placeholder="Tema da ministração" className="input-culto" /></Field>
              <Field label="Local"><div className="relative"><MapPin className="field-icon" /><input value={editing.location || ""} onChange={(e) => setEditing({ ...editing, location: e.target.value })} maxLength={240} placeholder="Templo / endereço" className="input-culto pl-10" /></div></Field>
              <Field label="Observações"><textarea value={editing.notes || ""} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} maxLength={2000} rows={4} placeholder="Santa Ceia, programação especial, orientações…" className="input-culto h-auto py-3 resize-none" /></Field>
              <label className="flex items-center justify-between gap-3 rounded-xl bg-[hsl(var(--dark-card))] p-3"><span><span className="block text-sm font-semibold">Ativo</span><span className="block text-[10px] text-[hsl(var(--dark-muted))]">Disponível para consultas do ATIS</span></span><input type="checkbox" checked={editing.is_active} onChange={(e) => setEditing({ ...editing, is_active: e.target.checked })} className="w-5 h-5 accent-primary" /></label>
            </div>

            <div className="absolute sm:static bottom-0 left-0 right-0 p-3 border-t border-[hsl(var(--dark-card-hover))] bg-[hsl(var(--dark-bg))]/95 backdrop-blur">
              <button disabled={saving} onClick={save} className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50"><Save className="w-4 h-4" /> {saving ? "Salvando…" : "Salvar organização"}</button>
            </div>
          </div>
          <style>{`.input-culto{width:100%;height:44px;border-radius:12px;border:1px solid hsl(var(--dark-card-hover));background:hsl(var(--dark-card));padding-left:12px;padding-right:12px;font-size:14px;outline:none}.input-culto:focus{border-color:hsl(var(--primary)/.65)}.field-icon{position:absolute;left:12px;top:14px;width:16px;height:16px;color:hsl(var(--dark-muted))}`}</style>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="text-[11px] font-semibold uppercase tracking-wider text-[hsl(var(--dark-muted))] mb-1.5 block">{label}</span>{children}</label>;
}
