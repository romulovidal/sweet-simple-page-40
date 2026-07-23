import { useEffect, useState } from "react";
import { atisDb } from "./atisDb";
import { toast } from "sonner";
import { Save, Loader2, QrCode } from "lucide-react";
import AtisConnect from "./AtisConnect";

type Config = {
  id: number;
  bot_name: string;
  avatar_url: string | null;
  persona: string | null;
  timezone: string;
  active: boolean;
  mention_only_default: boolean;
  trigger_words: string[];
  commands: Record<string, boolean>;
  evolution_url: string | null;
  evolution_instance: string | null;
  bot_number: string | null;
};

const COMMANDS: Record<string, string> = {
  versiculo: "versículo — buscar referência",
  buscar: "buscar — busca por palavra",
  hino: "hino — Harpa Cristã",
  devocional: "devocional — IA do dia",
  oracao: "oração — registrar pedido",
  estudo: "estudo — enviar estudo do dia",
  aniversariantes: "aniversariantes — lista do dia",
};

const AtisConfig = () => {
  const [cfg, setCfg] = useState<Config | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showConnect, setShowConnect] = useState(false);

  useEffect(() => {
    (async () => {
      const { data, error } = await atisDb.from("atis_config").select("*").eq("id", 1).maybeSingle();
      if (error) toast.error(error.message);
      setCfg(data as Config);
      setLoading(false);
    })();
  }, []);

  if (loading || !cfg) return <Loader2 className="w-5 h-5 animate-spin mx-auto mt-10" />;

  const set = (patch: Partial<Config>) => setCfg({ ...cfg, ...patch });

  const save = async () => {
    setSaving(true);
    const { error } = await atisDb.from("atis_config").upsert({
      id: 1,
      bot_name: cfg.bot_name,
      avatar_url: cfg.avatar_url,
      persona: cfg.persona,
      timezone: cfg.timezone,
      active: cfg.active,
      mention_only_default: cfg.mention_only_default,
      trigger_words: cfg.trigger_words,
      commands: cfg.commands,
      evolution_url: cfg.evolution_url,
      evolution_instance: cfg.evolution_instance,
      bot_number: cfg.bot_number,
      updated_at: new Date().toISOString(),
    }, { onConflict: "id" });
    setSaving(false);
    if (error) {
      console.error("[AtisConfig] save error", error);
      toast.error(`Erro ao salvar: ${error.message}`);
    } else {
      toast.success("Configuração salva");
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-gradient-to-br from-[hsl(220,70%,50%)] to-[hsl(260,60%,45%)] text-white p-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-bold">Conexão WhatsApp</p>
          <p className="text-xs opacity-90">Escaneie o QR Code para conectar o número do Atis.</p>
        </div>
        <button onClick={() => setShowConnect(true)} className="shrink-0 bg-white/15 hover:bg-white/25 backdrop-blur rounded-xl px-3 py-2 text-xs font-semibold inline-flex items-center gap-1.5">
          <QrCode className="w-4 h-4" /> Conectar
        </button>
      </div>

      <div className="rounded-2xl bg-[hsl(var(--dark-card))] p-4 space-y-3">
        <p className="text-sm font-bold">Identidade</p>
        <input className="input" placeholder="Nome do bot" value={cfg.bot_name} onChange={e => set({ bot_name: e.target.value })} />
        <input className="input" placeholder="URL do avatar (opcional)" value={cfg.avatar_url ?? ""} onChange={e => set({ avatar_url: e.target.value })} />
        <textarea className="input" style={{ height: 100, padding: 10 }} placeholder="Persona / tom do bot" value={cfg.persona ?? ""} onChange={e => set({ persona: e.target.value })} />
        <input className="input" placeholder="Fuso horário (ex: America/Fortaleza)" value={cfg.timezone} onChange={e => set({ timezone: e.target.value })} />
      </div>

      <div className="rounded-2xl bg-[hsl(var(--dark-card))] p-4 space-y-3">
        <p className="text-sm font-bold">Comportamento em grupos</p>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={cfg.active} onChange={e => set({ active: e.target.checked })} /> Bot ativo
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={cfg.mention_only_default} onChange={e => set({ mention_only_default: e.target.checked })} /> Padrão: responder só quando mencionado
        </label>
        <input className="input" placeholder="Palavras-gatilho (vírgula)" value={(cfg.trigger_words ?? []).join(", ")} onChange={e => set({ trigger_words: e.target.value.split(",").map(s => s.trim()).filter(Boolean) })} />
      </div>

      <div className="rounded-2xl bg-[hsl(var(--dark-card))] p-4 space-y-2">
        <p className="text-sm font-bold mb-2">Comandos habilitados</p>
        {Object.entries(COMMANDS).map(([key, label]) => (
          <label key={key} className="flex items-center gap-2 text-sm py-1">
            <input type="checkbox" checked={!!cfg.commands?.[key]} onChange={e => set({ commands: { ...cfg.commands, [key]: e.target.checked } })} />
            <span>{label}</span>
          </label>
        ))}
      </div>

      <div className="rounded-2xl bg-[hsl(var(--dark-card))] p-4 space-y-3">
        <p className="text-sm font-bold">Evolution API</p>
        <p className="text-xs text-[hsl(var(--dark-muted))]">A chave (API key) é armazenada como secret no backend. Aqui só o endereço e a instância.</p>
        <input className="input" placeholder="URL da Evolution (https://…)" value={cfg.evolution_url ?? ""} onChange={e => set({ evolution_url: e.target.value })} />
        <input className="input" placeholder="Nome da instância" value={cfg.evolution_instance ?? ""} onChange={e => set({ evolution_instance: e.target.value })} />
        <input className="input" placeholder="Número do bot (ex: 5585999999999)" value={cfg.bot_number ?? ""} onChange={e => set({ bot_number: e.target.value })} />
      </div>

      <button onClick={save} disabled={saving} className="w-full h-12 rounded-2xl bg-primary text-primary-foreground font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50">
        <Save className="w-4 h-4" /> {saving ? "Salvando..." : "Salvar configuração"}
      </button>
      <style>{`.input{width:100%;height:42px;padding:0 12px;border-radius:12px;background:hsl(var(--dark-bg));color:hsl(var(--dark-text));border:1px solid hsl(var(--dark-card-hover));font-size:14px}`}</style>
      {showConnect && <AtisConnect onClose={() => setShowConnect(false)} />}
    </div>
  );
};

export default AtisConfig;