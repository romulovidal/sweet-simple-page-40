import { useEffect, useState } from "react";
import { atisDb } from "./atisDb";
import { toast } from "sonner";
import { 
  Save, 
  Loader2, 
  ShieldCheck, 
  Clock, 
  AlertTriangle,
  Zap,
  RotateCcw,
  Gauge
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

interface AutomationSettings {
  id: number;
  timezone: string;
  global_enabled: boolean;
  quiet_hours_enabled: boolean;
  quiet_hours_start: string;
  quiet_hours_end: string;
  delay_between_messages_ms: number;
  max_messages_per_minute: number;
  retry_max: number;
  retry_interval_minutes: number;
  daily_global_cap: number;
  daily_recipient_cap: number;
  daily_group_cap: number;
  hourly_cap: number;
  min_gap_ms: number;
  max_gap_ms: number;
  jitter_max_ms: number;
  updated_at: string;
}

const AtisAdvancedSettings = () => {
  const [settings, setSettings] = useState<AutomationSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const { data, error } = await atisDb
        .from("atis_automation_settings")
        .select("*")
        .eq("id", 1)
        .maybeSingle();

      if (error) throw error;
      if (data) {
        setSettings(data as AutomationSettings);
      }
    } catch (e: any) {
      console.error("[AtisAdvancedSettings] Error loading settings:", e);
      toast.error("Erro ao carregar configurações: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      const { error } = await atisDb
        .from("atis_automation_settings")
        .upsert({
          ...settings,
          updated_at: new Date().toISOString(),
        }, { onConflict: "id" });

      if (error) throw error;
      toast.success("Configurações globais salvas com sucesso");
    } catch (e: any) {
      console.error("[AtisAdvancedSettings] Error saving settings:", e);
      toast.error(`Erro ao salvar: ${e.message}${e.code === '42501' ? ' (Sem permissão de escrita)' : ''}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-8 space-y-4 rounded-2xl bg-[hsl(var(--dark-card))] border border-[hsl(var(--dark-card-hover))] min-h-[200px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-sm text-[hsl(var(--dark-muted))] font-medium">Carregando motor ATIS...</p>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="flex flex-col items-center justify-center p-8 space-y-3 rounded-2xl bg-[hsl(var(--dark-card))] border border-[hsl(var(--dark-card-hover))] min-h-[200px] text-center">
        <AlertTriangle className="w-6 h-6 text-amber-500" />
        <p className="text-xs text-[hsl(var(--dark-muted))] leading-relaxed max-w-[200px]">
          Não foi possível carregar as configurações do motor ATIS. Verifique as permissões.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Motor de Automações */}
      <div className="rounded-2xl bg-[hsl(var(--dark-card))] p-5 border border-[hsl(var(--dark-card-hover))] shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl ${settings.global_enabled ? 'bg-primary/20 text-primary' : 'bg-destructive/20 text-destructive'}`}>
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold">Motor de Automações</h3>
              <p className="text-[11px] text-[hsl(var(--dark-muted))]">Controle mestre de todos os envios automáticos</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className={`text-xs font-semibold ${settings.global_enabled ? 'text-primary' : 'text-destructive'}`}>
              {settings.global_enabled ? 'ATIVADO' : 'DESATIVADO'}
            </span>
            <Switch 
              checked={settings.global_enabled}
              onCheckedChange={(checked) => setSettings({ ...settings, global_enabled: checked })}
            />
          </div>
        </div>

        {!settings.global_enabled && (
          <div className="flex gap-3 p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive animate-pulse">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <p className="text-xs font-medium">O motor global está desligado. Nenhuma automação será processada pelo backend até que seja reativado.</p>
          </div>
        )}
      </div>

      {/* Horário Silencioso */}
      <div className="rounded-2xl bg-[hsl(var(--dark-card))] p-5 border border-[hsl(var(--dark-card-hover))] shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-500">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold">Horário Silencioso</h3>
              <p className="text-[11px] text-[hsl(var(--dark-muted))]">Evite envios em horários impróprios</p>
            </div>
          </div>
          <Switch 
            checked={settings.quiet_hours_enabled}
            onCheckedChange={(checked) => setSettings({ ...settings, quiet_hours_enabled: checked })}
          />
        </div>

        {settings.quiet_hours_enabled && (
          <div className="grid grid-cols-2 gap-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-[10px] uppercase text-[hsl(var(--dark-muted))] font-bold">Início</Label>
              <Input 
                type="time" 
                value={settings.quiet_hours_start}
                onChange={(e) => setSettings({ ...settings, quiet_hours_start: e.target.value })}
                className="bg-[hsl(var(--dark-bg))] border-[hsl(var(--dark-card-hover))]"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] uppercase text-[hsl(var(--dark-muted))] font-bold">Fim</Label>
              <Input 
                type="time" 
                value={settings.quiet_hours_end}
                onChange={(e) => setSettings({ ...settings, quiet_hours_end: e.target.value })}
                className="bg-[hsl(var(--dark-bg))] border-[hsl(var(--dark-card-hover))]"
              />
            </div>
          </div>
        )}

        <div className="p-3 rounded-xl bg-[hsl(var(--dark-bg))] border border-[hsl(var(--dark-card-hover))]">
          <p className="text-[11px] leading-relaxed text-[hsl(var(--dark-muted))] italic">
            «Durante o horário silencioso, mensagens que não podem ser enviadas imediatamente são tratadas pelo motor ATIS conforme as regras de reagendamento do backend. A interface não deve descartar ou reagendar mensagens por conta própria.»
          </p>
        </div>
      </div>

      {/* Proteção de Envio (Anti-ban) */}
      <div className="rounded-2xl bg-[hsl(var(--dark-card))] p-5 border border-[hsl(var(--dark-card-hover))] shadow-sm space-y-5">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-500">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold">Proteção de Envio (Anti-ban)</h3>
            <p className="text-[11px] text-[hsl(var(--dark-muted))]">Configurações de segurança para evitar bloqueios</p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-5 pt-2">
          <div className="space-y-1.5">
            <Label className="text-[10px] uppercase text-[hsl(var(--dark-muted))] font-bold flex items-center gap-1">
              <Gauge className="w-3 h-3" /> Limite Global/Dia
            </Label>
            <Input 
              type="number" 
              value={settings.daily_global_cap}
              onChange={(e) => setSettings({ ...settings, daily_global_cap: parseInt(e.target.value) || 0 })}
              className="bg-[hsl(var(--dark-bg))] border-[hsl(var(--dark-card-hover))]"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[10px] uppercase text-[hsl(var(--dark-muted))] font-bold">Máx Contato/Dia</Label>
            <Input 
              type="number" 
              value={settings.daily_recipient_cap}
              onChange={(e) => setSettings({ ...settings, daily_recipient_cap: parseInt(e.target.value) || 0 })}
              className="bg-[hsl(var(--dark-bg))] border-[hsl(var(--dark-card-hover))]"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[10px] uppercase text-[hsl(var(--dark-muted))] font-bold">Máx Grupo/Dia</Label>
            <Input 
              type="number" 
              value={settings.daily_group_cap}
              onChange={(e) => setSettings({ ...settings, daily_group_cap: parseInt(e.target.value) || 0 })}
              className="bg-[hsl(var(--dark-bg))] border-[hsl(var(--dark-card-hover))]"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[10px] uppercase text-[hsl(var(--dark-muted))] font-bold">Limite/Hora</Label>
            <Input 
              type="number" 
              value={settings.hourly_cap}
              onChange={(e) => setSettings({ ...settings, hourly_cap: parseInt(e.target.value) || 0 })}
              className="bg-[hsl(var(--dark-bg))] border-[hsl(var(--dark-card-hover))]"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[10px] uppercase text-[hsl(var(--dark-muted))] font-bold">Limite/Minuto</Label>
            <Input 
              type="number" 
              value={settings.max_messages_per_minute}
              onChange={(e) => setSettings({ ...settings, max_messages_per_minute: parseInt(e.target.value) || 0 })}
              className="bg-[hsl(var(--dark-bg))] border-[hsl(var(--dark-card-hover))]"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[10px] uppercase text-[hsl(var(--dark-muted))] font-bold">Gap Mín (ms)</Label>
            <Input 
              type="number" 
              value={settings.min_gap_ms}
              onChange={(e) => setSettings({ ...settings, min_gap_ms: parseInt(e.target.value) || 0 })}
              className="bg-[hsl(var(--dark-bg))] border-[hsl(var(--dark-card-hover))]"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[10px] uppercase text-[hsl(var(--dark-muted))] font-bold">Gap Máx (ms)</Label>
            <Input 
              type="number" 
              value={settings.max_gap_ms}
              onChange={(e) => setSettings({ ...settings, max_gap_ms: parseInt(e.target.value) || 0 })}
              className="bg-[hsl(var(--dark-bg))] border-[hsl(var(--dark-card-hover))]"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[10px] uppercase text-[hsl(var(--dark-muted))] font-bold">Jitter Máx (ms)</Label>
            <Input 
              type="number" 
              value={settings.jitter_max_ms}
              onChange={(e) => setSettings({ ...settings, jitter_max_ms: parseInt(e.target.value) || 0 })}
              className="bg-[hsl(var(--dark-bg))] border-[hsl(var(--dark-card-hover))]"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[10px] uppercase text-[hsl(var(--dark-muted))] font-bold">Timezone</Label>
            <Input 
              value={settings.timezone}
              onChange={(e) => setSettings({ ...settings, timezone: e.target.value })}
              className="bg-[hsl(var(--dark-bg))] border-[hsl(var(--dark-card-hover))]"
              disabled
            />
          </div>
        </div>

        <Separator className="bg-[hsl(var(--dark-card-hover))]" />

        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-blue-500/20 text-blue-500">
            <RotateCcw className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-bold">Retentativas Automáticas</h3>
            <p className="text-[11px] text-[hsl(var(--dark-muted))]">Regras globais para falhas temporárias</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-5 pt-1">
          <div className="space-y-1.5">
            <Label className="text-[10px] uppercase text-[hsl(var(--dark-muted))] font-bold">Máximo de Tentativas</Label>
            <Input 
              type="number" 
              value={settings.retry_max}
              onChange={(e) => setSettings({ ...settings, retry_max: parseInt(e.target.value) || 0 })}
              className="bg-[hsl(var(--dark-bg))] border-[hsl(var(--dark-card-hover))]"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[10px] uppercase text-[hsl(var(--dark-muted))] font-bold">Intervalo Retry (min)</Label>
            <Input 
              type="number" 
              value={settings.retry_interval_minutes}
              onChange={(e) => setSettings({ ...settings, retry_interval_minutes: parseInt(e.target.value) || 0 })}
              className="bg-[hsl(var(--dark-bg))] border-[hsl(var(--dark-card-hover))]"
            />
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <button 
          onClick={handleSave}
          disabled={saving}
          className="w-full h-12 rounded-2xl bg-primary text-primary-foreground font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
          SALVAR CONFIGURAÇÕES GLOBAIS
        </button>
        <p className="text-[10px] text-center text-[hsl(var(--dark-muted))]">
          Última atualização: {new Date(settings.updated_at).toLocaleString('pt-BR')}
        </p>
      </div>
    </div>
  );
};

export default AtisAdvancedSettings;