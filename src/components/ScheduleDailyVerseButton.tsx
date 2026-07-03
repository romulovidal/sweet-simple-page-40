import { useState } from "react";
import { CalendarPlus, Loader2, Save } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  reference: string;
  text: string;
  disabled?: boolean;
  onScheduled?: () => void;
}

/**
 * Admin-only button rendered in the Bible selection action bar.
 * Opens a popover with a date picker to schedule the selected verses
 * as the "verse of the day" (writes to daily_verse_queue).
 */
const ScheduleDailyVerseButton = ({ reference, text, disabled, onScheduled }: Props) => {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [saving, setSaving] = useState(false);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const handleSave = async () => {
    if (!date || !reference || !text) {
      toast.error("Selecione uma data");
      return;
    }
    setSaving(true);
    const scheduled_date = format(date, "yyyy-MM-dd");
    const { error } = await supabase.from("daily_verse_queue").insert({
      verse_text: text,
      verse_ref: reference,
      scheduled_date,
    });
    setSaving(false);
    if (error) {
      if ((error as any).code === "23505") {
        toast.error("Já existe um versículo agendado para esta data");
      } else {
        toast.error("Não foi possível agendar");
      }
      return;
    }
    toast.success(`Agendado para ${format(date, "dd 'de' MMMM", { locale: ptBR })}`);
    setOpen(false);
    setDate(undefined);
    onScheduled?.();
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          disabled={disabled}
          title="Agendar como versículo do dia"
          aria-label="Agendar como versículo do dia"
          className="p-1.5 rounded-lg bg-primary-foreground/20 active:bg-primary-foreground/30 shrink-0 disabled:opacity-40"
        >
          <CalendarPlus className="w-[18px] h-[18px] text-primary-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="end">
        <div className="p-3 border-b border-border">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">
            Agendar Versículo do Dia
          </p>
          <p className="text-sm font-semibold text-primary mt-1 truncate max-w-[260px]">
            {reference}
          </p>
        </div>
        <Calendar
          mode="single"
          selected={date}
          onSelect={setDate}
          disabled={(d) => d < today}
          initialFocus
          locale={ptBR}
          className={cn("p-3 pointer-events-auto")}
        />
        <div className="p-3 pt-0">
          <Button
            onClick={handleSave}
            disabled={!date || saving}
            className="w-full h-10"
            size="sm"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            {date
              ? `Agendar para ${format(date, "dd/MM/yyyy")}`
              : "Selecione uma data"}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default ScheduleDailyVerseButton;