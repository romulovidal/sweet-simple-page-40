import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, Edit2, Save, X, Church, Bell, Loader2, MessageSquare, Send, Repeat } from "lucide-react";

const DAYS_PT = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

interface CultoSchedule {
  id: string;
  name: string;
  day_of_week: number;
  time: string;
  reminder_minutes_before: number;
  is_active: boolean;
  last_reminder_sent: string | null;
  created_at: string;
}

interface CultoReminder {
  id: string;
  schedule_id: string;
  minutes_before: number | null;
  message: string;
  last_sent: string | null;
  sort_order: number;
  scheduled_at: string | null;
}

const MAX_REMINDERS = 4;

// Recurring reminders — each lembrete dispara automaticamente toda semana,
// X minutos antes do horário do culto (mesmo dia da semana).
const REMINDER_PRESETS: { label: string; minutes: number }[] = [
  { label: "15 min antes", minutes: 15 },
  { label: "30 min antes", minutes: 30 },
  { label: "1 hora antes", minutes: 60 },
  { label: "2 horas antes", minutes: 120 },
  { label: "3 horas antes", minutes: 180 },
  { label: "6 horas antes", minutes: 360 },
  { label: "1 dia antes", minutes: 1440 },
  { label: "2 dias antes", minutes: 2880 },
];

const formatMinutesBefore = (min: number | null | undefined): string => {
  if (min == null) return "";
  const preset = REMINDER_PRESETS.find((p) => p.minutes === min);
  if (preset) return preset.label;
  if (min < 60) return `${min} min antes`;
  if (min % 1440 === 0) {
    const d = min / 1440;
    return `${d} dia${d > 1 ? "s" : ""} antes`;
  }
  if (min % 60 === 0) {
    const h = min / 60;
    return `${h}h antes`;
  }
  return `${min} min antes`;
};

const AdminCultoSchedule = () => {
  const [schedules, setSchedules] = useState<CultoSchedule[]>([]);
  const [reminders, setReminders] = useState<CultoReminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<CultoSchedule> | null>(null);
  const [editingReminders, setEditingReminders] = useState<Partial<CultoReminder>[]>([]);
  const [viewingScheduleId, setViewingScheduleId] = useState<string | null>(null);

  useEffect(() => { loadSchedules(); }, []);

  const loadSchedules = async () => {
    setLoading(true);
    const [schedulesRes, remindersRes] = await Promise.all([
      supabase.from("culto_schedules").select("*").order("day_of_week").order("time"),
      supabase.from("culto_reminders").select("*").order("minutes_before", { ascending: false }),
    ]);
    setSchedules((schedulesRes.data as CultoSchedule[]) || []);
    setReminders((remindersRes.data as CultoReminder[]) || []);
    setLoading(false);
  };

  const save = async () => {
    if (!editing?.name?.trim()) { toast.error("Nome é obrigatório"); return; }
    if (editing.time === undefined || editing.time === "") { toast.error("Horário é obrigatório"); return; }

    const payload = {
      name: editing.name.trim(),
      day_of_week: editing.day_of_week ?? 0,
      time: editing.time,
      reminder_minutes_before: editing.reminder_minutes_before ?? 180,
      is_active: editing.is_active ?? true,
    };

    let scheduleId = editing.id;

    if (editing.id) {
      const { error } = await supabase.from("culto_schedules").update(payload).eq("id", editing.id);
      if (error) { toast.error("Erro ao salvar"); return; }
    } else {
      const { data, error } = await supabase.from("culto_schedules").insert(payload).select().single();
      if (error || !data) { toast.error("Erro ao criar"); return; }
      scheduleId = data.id;
    }

    // Save reminders
    if (scheduleId) {
      // Validate: every reminder must have a minutes_before
      for (const r of editingReminders) {
        if (r.minutes_before == null || r.minutes_before < 0) {
          toast.error("Defina o tempo antes do culto para cada lembrete");
          return;
        }
      }
      if (editingReminders.length > MAX_REMINDERS) {
        toast.error(`Máximo de ${MAX_REMINDERS} lembretes`);
        return;
      }

      // Delete existing reminders for this schedule
      await supabase.from("culto_reminders").delete().eq("schedule_id", scheduleId);

      // Insert new reminders
      if (editingReminders.length > 0) {
        const reminderPayloads = editingReminders.map((r, i) => ({
          schedule_id: scheduleId!,
          minutes_before: r.minutes_before!,
          scheduled_at: null,
          message: r.message?.trim() || "",
          sort_order: i,
        }));
        const { error } = await supabase.from("culto_reminders").insert(reminderPayloads);
        if (error) { toast.error("Erro ao salvar lembretes"); return; }
      }
    }

    toast.success(editing.id ? "Culto atualizado!" : "Culto agendado!");
    setEditing(null);
    setEditingReminders([]);
    loadSchedules();
  };

  const remove = async (id: string) => {
    if (!window.confirm("Excluir este horário de culto?")) return;
    await supabase.from("culto_schedules").delete().eq("id", id);
    toast.success("Culto removido");
    loadSchedules();
  };

  const toggleActive = async (schedule: CultoSchedule) => {
    await supabase.from("culto_schedules").update({ is_active: !schedule.is_active }).eq("id", schedule.id);
    loadSchedules();
  };

  const [sendingId, setSendingId] = useState<string | null>(null);
  const sendManualReminder = async (schedule: CultoSchedule) => {
    if (!window.confirm(`Enviar lembrete agora para todos os usuários sobre "${schedule.name}"?`)) return;
    setSendingId(schedule.id);
    try {
      const { data, error } = await supabase.functions.invoke("culto-reminder", {
        body: { schedule_id: schedule.id },
      });
      if (error) throw error;
      const pushResult = data?.push;
      const sent = pushResult?.sent ?? 0;
      const failed = pushResult?.failed ?? 0;
      toast.success(`Lembrete enviado! ${sent} entregue${sent !== 1 ? "s" : ""}${failed ? `, ${failed} falha${failed > 1 ? "s" : ""}` : ""}`);
    } catch (e) {
      console.error(e);
      toast.error("Erro ao enviar lembrete");
    } finally {
      setSendingId(null);
    }
  };

  const startEditing = (schedule?: CultoSchedule) => {
    if (schedule) {
      setEditing(schedule);
      const schedReminders = reminders.filter(r => r.schedule_id === schedule.id);
      setEditingReminders(
        schedReminders.length > 0
          ? schedReminders
          : [{ minutes_before: 60, message: "" }]
      );
    } else {
      setEditing({ day_of_week: 0, reminder_minutes_before: 180, is_active: true });
      setEditingReminders([{ minutes_before: 60, message: "" }]);
    }
  };

  const addReminder = () => {
    if (editingReminders.length >= MAX_REMINDERS) {
      toast.error(`Máximo de ${MAX_REMINDERS} lembretes`);
      return;
    }
    // Sugere um novo lembrete com o dobro do tempo do último (ex: 60 → 120 → 180 min)
    const last = editingReminders[editingReminders.length - 1]?.minutes_before ?? 60;
    const next = Math.min(2880, last + 60);
    setEditingReminders([...editingReminders, { minutes_before: next, message: "" }]);
  };

  const removeReminder = (index: number) => {
    setEditingReminders(editingReminders.filter((_, i) => i !== index));
  };

  const updateReminder = (index: number, updates: Partial<CultoReminder>) => {
    setEditingReminders(editingReminders.map((r, i) => i === index ? { ...r, ...updates } : r));
  };

  // Editing form
  if (editing) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <button onClick={() => { setEditing(null); setEditingReminders([]); }}><X className="w-5 h-5 text-[hsl(var(--dark-text))]" /></button>
          <h2 className="text-sm font-bold flex-1 text-[hsl(var(--dark-text))]">{editing.id ? "Editar" : "Novo"} Culto</h2>
        </div>

        <div>
          <label className="text-xs text-[hsl(var(--dark-muted))] mb-1 block">Nome do Culto *</label>
          <Input value={editing.name || ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })}
            placeholder="Ex: Culto de Domingo" className="bg-[hsl(var(--dark-card))] border-none" maxLength={100} />
        </div>

        <div>
          <label className="text-xs text-[hsl(var(--dark-muted))] mb-1 block">Dia da Semana *</label>
          <div className="flex flex-wrap gap-2">
            {DAYS_PT.map((day, i) => (
              <button key={i} onClick={() => setEditing({ ...editing, day_of_week: i })}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  editing.day_of_week === i ? "bg-primary text-primary-foreground" : "bg-[hsl(var(--dark-card))] text-[hsl(var(--dark-muted))]"
                }`}>{day}</button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs text-[hsl(var(--dark-muted))] mb-1 block">Horário *</label>
          <Input type="time" value={editing.time || ""} onChange={(e) => setEditing({ ...editing, time: e.target.value })}
            className="bg-[hsl(var(--dark-card))] border-none w-36" />
        </div>

        {/* Multiple reminders */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs text-[hsl(var(--dark-muted))] flex items-center gap-1">
              <Bell className="w-3 h-3" /> Lembretes agendados ({editingReminders.length}/{MAX_REMINDERS})
            </label>
            <button
              onClick={addReminder}
              disabled={editingReminders.length >= MAX_REMINDERS}
              className="text-xs text-primary font-medium flex items-center gap-1 disabled:opacity-40"
            >
              <Plus className="w-3 h-3" /> Adicionar
            </button>
          </div>

          {editingReminders.map((reminder, index) => (
            <div key={index} className="bg-[hsl(var(--dark-card))] rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-primary">Lembrete {index + 1}</span>
                <button onClick={() => removeReminder(index)} className="text-destructive">
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>

              <div>
                <label className="text-[10px] text-[hsl(var(--dark-muted))] mb-1 block">
                  Data e hora do envio
                </label>
                <Input
                  type="datetime-local"
                  value={toLocalInput(reminder.scheduled_at)}
                  onChange={(e) => updateReminder(index, { scheduled_at: fromLocalInput(e.target.value) || undefined })}
                  className="bg-[hsl(var(--dark-bg))] border-none h-9 text-xs"
                />
              </div>

              <div>
                <label className="text-[10px] text-[hsl(var(--dark-muted))] mb-1 block flex items-center gap-1">
                  <MessageSquare className="w-3 h-3" /> Mensagem personalizada (opcional)
                </label>
                <Textarea value={reminder.message || ""}
                  onChange={(e) => updateReminder(index, { message: e.target.value })}
                  placeholder="Deixe vazio para usar mensagem padrão"
                  className="bg-[hsl(var(--dark-bg))] border-none min-h-[60px] text-xs" maxLength={300} />
              </div>
            </div>
          ))}

          {editingReminders.length === 0 && (
            <div className="text-center py-4">
              <p className="text-xs text-[hsl(var(--dark-muted))]">Nenhum lembrete configurado</p>
              <button onClick={addReminder} className="text-xs text-primary font-medium mt-1">+ Adicionar lembrete</button>
            </div>
          )}
        </div>

        <Button onClick={save} className="w-full">
          <Save className="w-4 h-4 mr-1" /> Salvar
        </Button>
      </div>
    );
  }

  // View reminders for a schedule
  if (viewingScheduleId) {
    const schedule = schedules.find(s => s.id === viewingScheduleId);
    const schedReminders = reminders.filter(r => r.schedule_id === viewingScheduleId);

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <button onClick={() => setViewingScheduleId(null)}><X className="w-5 h-5 text-[hsl(var(--dark-text))]" /></button>
          <h2 className="text-sm font-bold flex-1 text-[hsl(var(--dark-text))]">
            Lembretes: {schedule?.name}
          </h2>
        </div>

        {schedReminders.length === 0 ? (
          <div className="text-center py-6">
            <Bell className="w-8 h-8 text-[hsl(var(--dark-muted))] mx-auto mb-2 opacity-40" />
            <p className="text-sm text-[hsl(var(--dark-muted))]">Nenhum lembrete configurado</p>
            <p className="text-xs text-[hsl(var(--dark-muted))] mt-1">Edite o culto para adicionar lembretes</p>
          </div>
        ) : (
          <div className="space-y-2">
            {schedReminders.map((r, i) => (
              <div key={r.id} className="bg-[hsl(var(--dark-card))] rounded-xl p-3">
                <div className="flex items-center gap-2">
                  <Bell className="w-4 h-4 text-primary" />
                  <span className="text-sm font-semibold text-[hsl(var(--dark-text))]">
                    {r.scheduled_at ? formatScheduled(r.scheduled_at) : `${r.minutes_before ?? 0}min antes`}
                  </span>
                </div>
                {r.message ? (
                  <p className="text-xs text-[hsl(var(--dark-muted))] mt-1 ml-6">"{r.message}"</p>
                ) : (
                  <p className="text-xs text-[hsl(var(--dark-muted))] mt-1 ml-6 italic">Mensagem padrão</p>
                )}
                {r.last_sent && (
                  <p className="text-[10px] text-[hsl(var(--dark-muted))] mt-1 ml-6">
                    Último envio: {new Date(r.last_sent).toLocaleString("pt-BR", { timeZone: "America/Fortaleza" })}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Main list
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-1">
        <Church className="w-4 h-4 text-primary" />
        <span className="text-sm font-semibold text-[hsl(var(--dark-text))]">Horários de Culto</span>
      </div>
      <p className="text-xs text-[hsl(var(--dark-muted))] leading-relaxed">
        Configure os dias e horários dos cultos com múltiplos lembretes push personalizados.
      </p>

      <Button onClick={() => startEditing()} className="w-full">
        <Plus className="w-4 h-4 mr-2" /> Novo Horário de Culto
      </Button>

      {loading ? (
        <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
      ) : schedules.length === 0 ? (
        <p className="text-sm text-[hsl(var(--dark-muted))] text-center py-6">Nenhum culto agendado ainda</p>
      ) : (
        <div className="space-y-2">
          {schedules.map((s) => {
            const schedReminders = reminders.filter(r => r.schedule_id === s.id);
            return (
              <div key={s.id} className="bg-[hsl(var(--dark-card))] rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/15 flex items-center justify-center flex-shrink-0">
                    <Church className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-sm text-[hsl(var(--dark-text))]">{s.name}</p>
                      {!s.is_active && <span className="text-[10px] bg-destructive/20 text-destructive px-1.5 py-0.5 rounded-full">Inativo</span>}
                    </div>
                    <p className="text-xs text-[hsl(var(--dark-muted))] mt-0.5">
                      {DAYS_PT[s.day_of_week]} às {s.time.substring(0, 5)}
                    </p>
                    <p className="text-[10px] text-[hsl(var(--dark-muted))] mt-0.5 flex items-center gap-1">
                      <Bell className="w-3 h-3" />
                      {schedReminders.length > 0
                        ? `${schedReminders.length} lembrete${schedReminders.length > 1 ? "s" : ""}`
                        : "Nenhum lembrete"}
                    </p>
                  </div>
                  <Switch checked={s.is_active} onCheckedChange={() => toggleActive(s)} />
                </div>
                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-[hsl(var(--dark-bg))] flex-wrap">
                  <button onClick={() => startEditing(s)} className="text-xs text-primary font-medium flex items-center gap-1">
                    <Edit2 className="w-3 h-3" /> Editar
                  </button>
                  <button onClick={() => setViewingScheduleId(s.id)} className="text-xs text-primary font-medium flex items-center gap-1">
                    <Bell className="w-3 h-3" /> Lembretes
                  </button>
                  <button
                    onClick={() => sendManualReminder(s)}
                    disabled={sendingId === s.id}
                    className="text-xs text-primary font-medium flex items-center gap-1 disabled:opacity-50"
                  >
                    {sendingId === s.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                    Lembrete desse culto
                  </button>
                  <button onClick={() => remove(s.id)} className="text-xs text-destructive font-medium flex items-center gap-1 ml-auto">
                    <Trash2 className="w-3 h-3" /> Excluir
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AdminCultoSchedule;
