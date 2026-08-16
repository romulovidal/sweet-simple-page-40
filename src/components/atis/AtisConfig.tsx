import { useEffect, useState } from "react";
import { atisDb } from "./atisDb";
import { toast } from "sonner";
import { Save, Loader2, BookOpen, Search, Music2, Sparkles, HandHeart, GraduationCap, Cake, Check, QrCode } from "lucide-react";
import AtisAdvancedSettings from "./AtisAdvancedSettings";
import AtisEvolutionConfig from "./AtisEvolutionConfig";

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

type Cmd = { key: string; label: string; hint: string; example: string; icon: any; tint: string };

const COMMANDS: Cmd[] = [
  { key: "versiculo", label: "Versículo", hint: "Buscar por referência", example: "Jo 3:16", icon: BookOpen, tint: "from-blue-500/25 to-blue-500/5 text-blue-400" },
  { key: "buscar", label: "Buscar", hint: "Busca por palavra ou tema", example: "amor", icon: Search, tint: "from-cyan-500/25 to-cyan-500/5 text-cyan-400" },
  { key: "hino", label: "Hino", hint: "Enviar hino da Harpa Cristã", example: "hino 117", icon: Music2, tint: "from-violet-500/25 to-violet-500/5 text-violet-400" },
  { key: "devocional", label: "Devocional", hint: "Devocional gerado por IA", example: "devocional de hoje", icon: Sparkles, tint: "from-fuchsia-500/25 to-fuchsia-500/5 text-fuchsia-400" },
  { key: "oracao", label: "Oração", hint: "Registrar pedido de oração", example: "orem por…", icon: HandHeart, tint: "from-rose-500/25 to-rose-500/5 text-rose-400" },
  { key: "estudo", label: "Estudo", hint: "Enviar estudo publicado", example: "estudo de hoje", icon: GraduationCap, tint: "from-amber-500/25 to-amber-500/5 text-amber-400" },
  { key: "aniversariantes", label: "Aniversariantes", hint: "Lista de hoje", example: "aniversariantes", icon: Cake, tint: "from-pink-500/25 to-pink-500/5 text-pink-400" },
];

const AtisConfig = () => {
  const [cfg, setCfg] = useState<Config | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showConnect, setShowConnect] = useState(false);

  useEffect(() => {
    const loadConfig = async () => {
      setLoading(true);
      try {
        const { data, error } = await atisDb.from("atis_config").select("*").eq("id", 1).maybeSingle();
        if (error) {
          console.error("[AtisConfig] load error:", error);
          toast.error(`Erro ao carregar configuração: ${error.message}`);
        } else if (!data) {
          console.warn("[AtisConfig] No config found for ID 1, initializing default state");
          setCfg({
            id: 1,
            bot_name: "Atis",
            avatar_url: null,
            persona: null,
            timezone: "America/Fortaleza",
            active: true,
            mention_only_default: true,
            trigger_words: [],
            commands: {},
            evolution_url: null,
            evolution_instance: null,
            bot_number: null,
          });
        } else {
          setCfg(data as Config);
        }
      } catch (err: any) {
        console.error("[AtisConfig] critical load error:", err);
        toast.error("Erro crítico ao carregar configurações");
      } finally {
        setLoading(false);
      }
    };
    loadConfig();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-sm text-[hsl(var(--dark-muted))]">Carregando configurações...</p>
      </div>
    );
  }

  if (!cfg) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
        <div className="bg-destructive/10 p-4 rounded-full">
          <Loader2 className="w-8 h-8 text-destructive" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-bold">Falha ao carregar</p>
          <p className="text-xs text-[hsl(var(--dark-muted))]">Não foi possível recuperar os dados do Atis.</p>
        </div>
        <button 
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-xl text-xs font-semibold"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

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
      console.error("[ATIS CONFIG] Save error:", error);
      const isPermError = error.code === '42501' || error.message?.includes('42501');
      toast.error(`Erro ao salvar: ${error.message}${isPermError ? ' (Sem permissão de escrita)' : ''}`);

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

      <div className="rounded-2xl bg-[hsl(var(--dark-card))] p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-bold">Comandos habilitados</p>
            <p className="text-[11px] text-[hsl(var(--dark-muted))]">
              Toque para ativar. Ativos: {Object.values(cfg.commands ?? {}).filter(Boolean).length}/{COMMANDS.length}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => set({ commands: Object.fromEntries(COMMANDS.map(c => [c.key, true])) })}
              className="text-[10px] font-semibold text-primary hover:underline"
            >Todos</button>
            <span className="text-[hsl(var(--dark-muted))] text-[10px]">·</span>
            <button
              onClick={() => set({ commands: {} })}
              className="text-[10px] font-semibold text-[hsl(var(--dark-muted))] hover:underline"
            >Nenhum</button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {COMMANDS.map((c) => {
            const on = !!cfg.commands?.[c.key];
            const Icon = c.icon;
            return (
              <button
                key={c.key}
                type="button"
                onClick={() => set({ commands: { ...cfg.commands, [c.key]: !on } })}
                className={`relative text-left rounded-xl p-3 transition-all ${
                  on
                    ? `bg-gradient-to-br ${c.tint} ring-1 ring-primary/40`
                    : "bg-[hsl(var(--dark-bg))] ring-1 ring-[hsl(var(--dark-card-hover))] hover:ring-[hsl(var(--dark-muted))]"
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <span className={`w-9 h-9 rounded-lg grid place-items-center shrink-0 ${on ? "bg-black/25" : "bg-[hsl(var(--dark-card))]"}`}>
                    <Icon className={`w-4 h-4 ${on ? "" : "text-[hsl(var(--dark-muted))]"}`} />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-[13px] font-bold leading-tight ${on ? "" : "text-[hsl(var(--dark-text))]"}`}>{c.label}</p>
                    <p className={`text-[10px] mt-0.5 leading-snug ${on ? "opacity-90" : "text-[hsl(var(--dark-muted))]"}`}>{c.hint}</p>
                    <p className={`text-[10px] font-mono mt-1 truncate ${on ? "opacity-70" : "text-[hsl(var(--dark-muted))]/70"}`}>“{c.example}”</p>
                  </div>
                </div>
                {on && (
                  <span className="absolute top-2 right-2 w-4 h-4 rounded-full bg-primary text-primary-foreground grid place-items-center">
                    <Check className="w-2.5 h-2.5" strokeWidth={3} />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-2xl bg-[hsl(var(--dark-card))] p-4 space-y-3">
        <p className="text-sm font-bold">Número do bot</p>
        <p className="text-xs text-[hsl(var(--dark-muted))]">
          Número do WhatsApp conectado (usado para detectar menções em grupos). A URL, a chave (API key) e a instância da Evolution API ficam armazenadas como secrets no backend.
        </p>
        <input className="input" placeholder="Número do bot (ex: 5585999999999)" value={cfg.bot_number ?? ""} onChange={e => set({ bot_number: e.target.value })} />
      </div>

      <button onClick={save} disabled={saving} className="w-full h-12 rounded-2xl bg-primary text-primary-foreground font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50">
        <Save className="w-4 h-4" /> {saving ? "Salvando..." : "Salvar configuração"}
      </button>

      <div className="pt-2">
        <p className="text-xs font-bold uppercase tracking-wide text-[hsl(var(--dark-muted))] mb-4 px-1 flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-primary" />
          Configurações Avançadas do Motor ATIS V2
        </p>
        <AtisAdvancedSettings />
      </div>

      <style>{`.input{width:100%;height:42px;padding:0 12px;border-radius:12px;background:hsl(var(--dark-bg));color:hsl(var(--dark-text));border:1px solid hsl(var(--dark-card-hover));font-size:14px}`}</style>
    </div>
  );
};

export default AtisConfig;