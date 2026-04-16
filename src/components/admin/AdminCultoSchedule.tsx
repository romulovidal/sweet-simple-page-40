import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, Edit2, Save, X, Church, Clock, Bell, Loader2 } from "lucide-react";

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

const REMINDER_OPTIONS = [
  { value: 30, label: "30 min" },
  { value: 60, label: "1 hora" },
  { value: 120, label: "2 horas" },
  { value: 180, label: "3 horas" },
  { value: 360, label: "6 horas" },
  { value: 720, label: "12 horas" },
  { value: 1440, label: "24 horas" },
];

const AdminCultoSchedule = () => {
  const [schedules, setSchedules] = useState<CultoSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<CultoSchedule> | null>(null);

  useEffect(() => { loadSchedules(); }, []);

  const loadSchedules = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("culto_schedules")
      .select("*")
      .order("day_of_week", { ascending: true })
      .order("time", { ascending: true });
    setSchedules((data as CultoSchedule[]) || []);
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

    if (editing.id) {
      const { error } = await supabase.from("culto_schedules").update(payload).eq("id", editing.id);
      if (error) { toast.error("Erro ao salvar"); return; }
      toast.success("Culto atualizado!");
    } else {
      const { error } = await supabase.from("culto_schedules").insert(payload);
      if (error) { toast.error("Erro ao criar"); return; }
      toast.success("Culto agendado!");
    }
    setEditing(null);
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

  if (editing) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <button onClick={() => setEditing(null)}><X className="w-5 h-5" /></button>
          <h2 className="text-sm font-bold flex-1">{editing.id ? "Editar" : "Novo"} Culto</h2>
        </div>

        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Nome do Culto *</label>
          <Input value={editing.name || ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })}
            placeholder="Ex: Culto de Domingo" className="bg-muted border-none" maxLength={100} />
        </div>

        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Dia da Semana *</label>
          <div className="flex flex-wrap gap-2">
            {DAYS_PT.map((day, i) => (
              <button key={i} onClick={() => setEditing({ ...editing, day_of_week: i })}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  editing.day_of_week === i ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                }`}>{day}</button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Horário *</label>
          <Input type="time" value={editing.time || ""} onChange={(e) => setEditing({ ...editing, time: e.target.value })}
            className="bg-muted border-none w-36" />
        </div>

        <div>
          <label className="text-xs text-muted-foreground mb-1 block flex items-center gap-1">
            <Bell className="w-3 h-3" /> Lembrete antes do culto
          </label>
          <div className="flex flex-wrap gap-2">
            {REMINDER_OPTIONS.map((opt) => (
              <button key={opt.value} onClick={() => setEditing({ ...editing, reminder_minutes_before: opt.value })}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  editing.reminder_minutes_before === opt.value ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                }`}>{opt.label}</button>
            ))}
          </div>
        </div>

        <Button onClick={save} className="w-full">
          <Save className="w-4 h-4 mr-1" /> Salvar
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-1">
        <Church className="w-4 h-4 text-primary" />
        <span className="text-sm font-semibold">Horários de Culto</span>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">
        Configure os dias e horários dos cultos. Um lembrete push será enviado automaticamente antes de cada culto.
      </p>

      <Button onClick={() => setEditing({ day_of_week: 0, reminder_minutes_before: 180, is_active: true })} className="w-full">
        <Plus className="w-4 h-4 mr-2" /> Novo Horário de Culto
      </Button>

      {loading ? (
        <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
      ) : schedules.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">Nenhum culto agendado ainda</p>
      ) : (
        <div className="space-y-2">
          {schedules.map((s) => {
            const reminderLabel = REMINDER_OPTIONS.find(o => o.value === s.reminder_minutes_before)?.label || `${s.reminder_minutes_before} min`;
            return (
              <div key={s.id} className="bg-muted rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/15 flex items-center justify-center flex-shrink-0">
                    <Church className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-sm">{s.name}</p>
                      {!s.is_active && <span className="text-[10px] bg-destructive/20 text-destructive px-1.5 py-0.5 rounded-full">Inativo</span>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {DAYS_PT[s.day_of_week]} às {s.time.substring(0, 5)}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1">
                      <Bell className="w-3 h-3" /> Lembrete: {reminderLabel} antes
                    </p>
                  </div>
                  <Switch checked={s.is_active} onCheckedChange={() => toggleActive(s)} />
                </div>
                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-background">
                  <button onClick={() => setEditing(s)} className="text-xs text-primary font-medium flex items-center gap-1">
                    <Edit2 className="w-3 h-3" /> Editar
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
