import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Loader2, Save, RotateCcw, Pencil, Sparkles, MessageCircleQuestion,
  BookOpen, Heart, Link2, Languages, Clock, Wand2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import type { AIFeatures } from "@/hooks/useAIFeatures";
import type { AppFeatures } from "@/hooks/useAppFeatures";

// ---------- Defaults (kept in sync with the previous individual admin screens) ----------

const EXEGETAI_DEFAULT =
  "Você é um exegeta bíblico acadêmico. Ao receber um texto bíblico, faça uma exegese completa incluindo:\n" +
  "1) **Contexto histórico e cultural** da época em que o texto foi escrito\n" +
  "2) **Análise das palavras-chave** no idioma original (hebraico/grego), com transliteração\n" +
  "3) **Gênero literário** e estrutura do texto\n" +
  "4) **Significado teológico** e aplicação prática\n" +
  "5) **Referências cruzadas** relevantes\n\n" +
  "Seja profundo mas acessível. Use markdown para formatar. Responda sempre em português brasileiro.";

const ASK_BIBLE_DEFAULT = `Você é um teólogo e pastor experiente. O usuário fará perguntas sobre a Bíblia, doutrina cristã, vida espiritual e temas relacionados.

Responda de forma:
1) Bíblica — sempre fundamente nas Escrituras com referências
2) Acessível — linguagem clara e acolhedora
3) Prática — conecte ao cotidiano do leitor
4) Equilibrada — apresente diferentes perspectivas quando relevante

Use markdown para formatação. Responda em português brasileiro.`;

type ToolKey =
  | "summary" | "devotional" | "connections"
  | "word-meaning" | "timeline" | "plan-generator";

const TOOL_DEFAULTS: Record<ToolKey, string> = {
  summary:
    "Você é um teólogo acadêmico. Receba o texto bíblico e gere um RESUMO CONCISO (3-4 frases) do capítulo, destacando:\n" +
    "1) Tema principal\n2) Contexto narrativo/teológico\n3) Mensagem central\n" +
    "Seja direto e acessível. Use markdown. Responda em português brasileiro.",
  devotional:
    "Você é um pastor e escritor devocional. A partir do versículo bíblico fornecido, escreva uma REFLEXÃO DEVOCIONAL curta (2 parágrafos) que:\n" +
    "1) Conecte o texto ao cotidiano do leitor\n2) Traga uma aplicação prática e encorajadora\n" +
    "Seja caloroso e inspirador. Use markdown. Responda em português brasileiro.",
  connections:
    "Você é um estudioso bíblico especialista em intertextualidade. A partir do texto bíblico fornecido:\n" +
    "1) Liste 4-6 referências cruzadas relevantes com a citação exata\n" +
    "2) Para cada uma, explique em 1-2 frases a conexão temática\n" +
    "3) Agrupe por tipo: paralelo direto, profecia/cumprimento, tema recorrente\n" +
    "Use markdown com headers. Responda em português brasileiro.",
  "word-meaning":
    "Você é um linguista bíblico especialista em hebraico e grego. A partir do texto bíblico fornecido:\n" +
    "1) Identifique 3-5 palavras-chave teologicamente significativas\n" +
    "2) Para cada uma: dê a palavra original (hebraico/grego), transliteração, significado literal e uso no contexto\n" +
    "3) Explique nuances que se perdem na tradução\n" +
    "Formate como mini-dicionário com markdown. Responda em português brasileiro.",
  timeline:
    "Você é um historiador bíblico. A partir do texto bíblico fornecido:\n" +
    "1) Situe o texto no período histórico (data aproximada, império dominante, contexto social)\n" +
    "2) Liste 4-6 eventos históricos relevantes em ordem cronológica\n" +
    "3) Para cada evento: data, o que aconteceu, e como se relaciona ao texto\n" +
    "Formate como linha do tempo visual com markdown (use emojis de época). Responda em português brasileiro.",
  "plan-generator":
    "Você é um teólogo pastoral especialista em planos de leitura bíblica. O administrador vai descrever um tema ou assunto.\n" +
    "Gere um plano de leitura bíblica completo com:\n" +
    "1) Título atrativo\n2) Descrição do plano (2-3 frases)\n3) Lista de leituras diárias (7-21 dias)\n" +
    "Para cada dia: título do dia, livro (abreviação), capítulo, versículo início e fim.\n\n" +
    "IMPORTANTE: Retorne APENAS um JSON válido no formato:\n" +
    '{"title":"...","description":"...","category":"Temático","emoji":"📖","readings":[{"day":1,"title":"...","book_abbrev":"gn","chapter":1,"verse_start":1,"verse_end":31}]}\n\n' +
    "Abreviações válidas: gn,ex,lv,nm,dt,js,jz,rt,1sm,2sm,1rs,2rs,1cr,2cr,ed,ne,et,jó,sl,pv,ec,ct,is,jr,lm,ez,dn,os,jl,am,ob,jn,mq,na,hc,sf,ag,zc,ml,mt,mc,lc,jo,at,rm,1co,2co,gl,ef,fp,cl,1ts,2ts,1tm,2tm,tt,fm,hb,tg,1pe,2pe,1jo,2jo,3jo,jd,ap",
};

// ---------- Card metadata (unified across all AI prompts) ----------

type Kind = "exegetai" | "ask-bible" | "tool";

// Each card also maps to a persisted enable/disable flag. AI tool flags live
// in admin_settings.ai_features; ask_bible lives in admin_settings.app_features.
type FeatureFlag =
  | { store: "ai_features"; key: keyof AIFeatures }
  | { store: "app_features"; key: keyof AppFeatures };

interface PromptCard {
  id: string;
  kind: Kind;
  toolKey?: ToolKey;
  label: string;
  description: string;
  icon: typeof BookOpen;
  defaultPrompt: string;
  flag: FeatureFlag;
}

interface Category {
  title: string;
  subtitle: string;
  items: PromptCard[];
}

const CATEGORIES: Category[] = [
  {
    title: "Estudo Profundo",
    subtitle: "Análises acadêmicas do texto",
    items: [
      {
        id: "exegetai", kind: "exegetai",
        label: "ExegetAI", description: "Exegese completa do texto bíblico",
        icon: Sparkles,
        defaultPrompt: EXEGETAI_DEFAULT,
        flag: { store: "ai_features", key: "exegetai" },
      },
      {
        id: "summary", kind: "tool", toolKey: "summary",
        label: "Resumo do Capítulo", description: "Resumo acadêmico ao abrir um capítulo",
        icon: BookOpen,
        defaultPrompt: TOOL_DEFAULTS.summary,
        flag: { store: "ai_features", key: "summary" },
      },
      {
        id: "word-meaning", kind: "tool", toolKey: "word-meaning",
        label: "Significado Original", description: "Palavras em hebraico e grego",
        icon: Languages,
        defaultPrompt: TOOL_DEFAULTS["word-meaning"],
        flag: { store: "ai_features", key: "word_meaning" },
      },
      {
        id: "timeline", kind: "tool", toolKey: "timeline",
        label: "Linha do Tempo", description: "Contexto histórico e eventos",
        icon: Clock,
        defaultPrompt: TOOL_DEFAULTS.timeline,
        flag: { store: "ai_features", key: "timeline" },
      },
    ],
  },
  {
    title: "Devocional & Pastoral",
    subtitle: "Aplicação e vida espiritual",
    items: [
      {
        id: "devotional", kind: "tool", toolKey: "devotional",
        label: "Devocional Diário", description: "Reflexão para o versículo do dia",
        icon: Heart,
        defaultPrompt: TOOL_DEFAULTS.devotional,
        flag: { store: "ai_features", key: "devotional" },
      },
      {
        id: "ask-bible", kind: "ask-bible",
        label: "Pergunte à Bíblia", description: "Chat pastoral com o usuário",
        icon: MessageCircleQuestion,
        defaultPrompt: ASK_BIBLE_DEFAULT,
        flag: { store: "app_features", key: "ask_bible" },
      },
    ],
  },
  {
    title: "Conexões & Geração",
    subtitle: "Referências e criação de conteúdo",
    items: [
      {
        id: "connections", kind: "tool", toolKey: "connections",
        label: "Conexões Bíblicas", description: "Referências cruzadas e paralelos",
        icon: Link2,
        defaultPrompt: TOOL_DEFAULTS.connections,
        flag: { store: "ai_features", key: "connections" },
      },
      {
        id: "plan-generator", kind: "tool", toolKey: "plan-generator",
        label: "Gerador de Planos", description: "Cria planos de leitura por tema",
        icon: Wand2,
        defaultPrompt: TOOL_DEFAULTS["plan-generator"],
        flag: { store: "ai_features", key: "plan_generator" },
      },
    ],
  },
];

const DEFAULT_AI_FEATURES: AIFeatures = {
  summary: true, devotional: true, connections: true,
  word_meaning: true, timeline: true, plan_generator: true, exegetai: true,
};
const DEFAULT_APP_FEATURES: Partial<AppFeatures> = { ask_bible: true };

// ---------- Component ----------

const AdminAIInstructions = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [exegetPrompt, setExegetPrompt] = useState(EXEGETAI_DEFAULT);
  const [askBiblePrompt, setAskBiblePrompt] = useState(ASK_BIBLE_DEFAULT);
  const [tools, setTools] = useState<Record<ToolKey, string>>(TOOL_DEFAULTS);
  const [aiFeatures, setAiFeatures] = useState<AIFeatures>(DEFAULT_AI_FEATURES);
  const [appFeatures, setAppFeatures] = useState<Partial<AppFeatures>>(DEFAULT_APP_FEATURES);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const [editing, setEditing] = useState<PromptCard | null>(null);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    (async () => {
      const [exRes, askRes, toolsRes, aiFeatRes, appFeatRes] = await Promise.all([
        supabase.from("admin_settings").select("value").eq("key", "exegetai_prompt").maybeSingle(),
        supabase.from("admin_settings").select("value").eq("key", "ask_bible_prompt").maybeSingle(),
        supabase.from("admin_settings").select("value").eq("key", "ai_tool_prompts").maybeSingle(),
        supabase.from("admin_settings").select("value").eq("key", "ai_features").maybeSingle(),
        supabase.from("admin_settings").select("value").eq("key", "app_features").maybeSingle(),
      ]);

      if (exRes.data?.value && typeof exRes.data.value === "object" && "prompt" in (exRes.data.value as any)) {
        const p = (exRes.data.value as any).prompt as string;
        if (p?.trim()) setExegetPrompt(p);
      }
      if (askRes.data?.value) {
        const v = askRes.data.value as any;
        if (typeof v === "string" && v.trim()) setAskBiblePrompt(v);
        else if (typeof v === "object" && v.prompt) setAskBiblePrompt(v.prompt);
      }
      if (toolsRes.data?.value && typeof toolsRes.data.value === "object") {
        setTools({ ...TOOL_DEFAULTS, ...(toolsRes.data.value as Partial<Record<ToolKey, string>>) });
      }
      if (aiFeatRes.data?.value && typeof aiFeatRes.data.value === "object") {
        setAiFeatures({ ...DEFAULT_AI_FEATURES, ...(aiFeatRes.data.value as Partial<AIFeatures>) });
      }
      if (appFeatRes.data?.value && typeof appFeatRes.data.value === "object") {
        setAppFeatures({ ...DEFAULT_APP_FEATURES, ...(appFeatRes.data.value as Partial<AppFeatures>) });
      }
      setLoading(false);
    })();
  }, []);

  const getCurrent = (card: PromptCard): string => {
    if (card.kind === "exegetai") return exegetPrompt;
    if (card.kind === "ask-bible") return askBiblePrompt;
    return tools[card.toolKey!];
  };

  const isEnabled = (card: PromptCard): boolean => {
    if (card.flag.store === "ai_features") return aiFeatures[card.flag.key] ?? true;
    return (appFeatures[card.flag.key] as boolean | undefined) ?? true;
  };

  const toggleEnabled = async (card: PromptCard) => {
    setTogglingId(card.id);
    try {
      if (card.flag.store === "ai_features") {
        const next = { ...aiFeatures, [card.flag.key]: !aiFeatures[card.flag.key] };
        const { error } = await (supabase.from("admin_settings") as any).upsert(
          { key: "ai_features", value: next as unknown as Record<string, unknown>, updated_at: new Date().toISOString() },
          { onConflict: "key" }
        );
        if (error) throw error;
        setAiFeatures(next);
        toast.success(`${card.label} ${next[card.flag.key] ? "ativado" : "desativado"}`);
      } else {
        const current = (appFeatures[card.flag.key] as boolean | undefined) ?? true;
        const next = { ...appFeatures, [card.flag.key]: !current };
        const { error } = await (supabase.from("admin_settings") as any).upsert(
          { key: "app_features", value: next as unknown as Record<string, unknown>, updated_at: new Date().toISOString() },
          { onConflict: "key" }
        );
        if (error) throw error;
        setAppFeatures(next);
        toast.success(`${card.label} ${!current ? "ativado" : "desativado"}`);
      }
    } catch {
      toast.error("Erro ao alterar estado");
    } finally {
      setTogglingId(null);
    }
  };

  const openEditor = (card: PromptCard) => {
    setEditing(card);
    setDraft(getCurrent(card));
  };

  const closeEditor = () => {
    setEditing(null);
    setDraft("");
  };

  const persist = async (card: PromptCard, value: string) => {
    if (card.kind === "exegetai") {
      const { error } = await (supabase.from("admin_settings") as any).upsert(
        { key: "exegetai_prompt", value: { prompt: value }, updated_at: new Date().toISOString() },
        { onConflict: "key" }
      );
      if (error) throw error;
      setExegetPrompt(value);
    } else if (card.kind === "ask-bible") {
      const { error } = await (supabase.from("admin_settings") as any).upsert(
        { key: "ask_bible_prompt", value: { prompt: value }, updated_at: new Date().toISOString() },
        { onConflict: "key" }
      );
      if (error) throw error;
      setAskBiblePrompt(value);
    } else {
      const next = { ...tools, [card.toolKey!]: value };
      const { error } = await (supabase.from("admin_settings") as any).upsert(
        { key: "ai_tool_prompts", value: next as unknown as Record<string, unknown>, updated_at: new Date().toISOString() },
        { onConflict: "key" }
      );
      if (error) throw error;
      setTools(next);
    }
  };

  const handleSave = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      await persist(editing, draft);
      toast.success(`"${editing.label}" salvo!`);
      closeEditor();
    } catch {
      toast.error("Erro ao salvar prompt");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (!editing) return;
    setDraft(editing.defaultPrompt);
    toast.info("Prompt padrão restaurado (salve para confirmar)");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-[hsl(var(--dark-text))]">IAs do App</h2>
        <p className="text-xs text-[hsl(var(--dark-muted))] mt-0.5">
          Ative, desative ou edite o prompt de cada inteligência artificial. Tudo em um só lugar.
        </p>
      </div>

      {CATEGORIES.map((cat) => (
        <section key={cat.title}>
          <div className="flex items-baseline justify-between px-1 mb-2">
            <h3 className="text-[10px] font-bold uppercase tracking-[0.15em] text-[hsl(var(--dark-muted))]">
              {cat.title}
            </h3>
            <span className="text-[10px] text-[hsl(var(--dark-muted))]/70">{cat.subtitle}</span>
          </div>
          <div className="space-y-2.5">
            {cat.items.map((card) => {
              const Icon = card.icon;
              const current = getCurrent(card);
              const isCustom = current.trim() !== card.defaultPrompt.trim();
              const enabled = isEnabled(card);
              const busy = togglingId === card.id;
              return (
                <div
                  key={card.id}
                  className={`rounded-2xl p-3.5 bg-[hsl(var(--dark-card))]/70 ring-1 ring-[hsl(var(--streak-orange)/0.2)] flex items-center gap-3 transition-opacity ${enabled ? "" : "opacity-55"}`}
                >
                  <span className={`w-11 h-11 shrink-0 rounded-xl grid place-items-center bg-[hsl(var(--dark-bg))] ${enabled ? "text-[hsl(var(--streak-orange))]" : "text-[hsl(var(--dark-muted))]"}`}>
                    <Icon className="w-5 h-5" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-[hsl(var(--dark-text))] truncate">{card.label}</p>
                      {isCustom && (
                        <span className="text-[9px] font-bold uppercase tracking-wider text-primary bg-primary/15 px-1.5 py-0.5 rounded-full">
                          custom
                        </span>
                      )}
                      {!enabled && (
                        <span className="text-[9px] font-bold uppercase tracking-wider text-[hsl(var(--dark-muted))] bg-[hsl(var(--dark-bg))] px-1.5 py-0.5 rounded-full">
                          off
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-[hsl(var(--dark-muted))] truncate">{card.description}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Switch
                      checked={enabled}
                      disabled={busy}
                      onCheckedChange={() => toggleEnabled(card)}
                      aria-label={enabled ? `Desativar ${card.label}` : `Ativar ${card.label}`}
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openEditor(card)}
                      className="h-9 px-3 bg-[hsl(var(--dark-bg))] border-[hsl(var(--dark-card-hover))] text-[hsl(var(--dark-text))] hover:bg-[hsl(var(--dark-card))]"
                    >
                      <Pencil className="w-3.5 h-3.5 mr-1.5" />
                      Editar
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}

      <Dialog open={!!editing} onOpenChange={(o) => { if (!o) closeEditor(); }}>
        <DialogContent className="max-w-2xl bg-[hsl(var(--dark-bg))] border-[hsl(var(--dark-card))]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[hsl(var(--dark-text))]">
              {editing && (
                <span className="w-8 h-8 rounded-xl grid place-items-center bg-[hsl(var(--dark-card))] text-[hsl(var(--streak-orange))]">
                  <editing.icon className="w-4 h-4" />
                </span>
              )}
              {editing?.label}
            </DialogTitle>
            <DialogDescription className="text-xs text-[hsl(var(--dark-muted))]">
              {editing?.description}. As mudanças se aplicam imediatamente ao app.
            </DialogDescription>
          </DialogHeader>

          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="bg-[hsl(var(--dark-card))] border-[hsl(var(--dark-card-hover))] text-[hsl(var(--dark-text))] min-h-[280px] text-xs font-mono"
            maxLength={6000}
            placeholder="Digite o prompt da IA..."
          />

          <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={handleReset}
              className="bg-[hsl(var(--dark-card))] border-[hsl(var(--dark-card-hover))] text-[hsl(var(--dark-text))] hover:bg-[hsl(var(--dark-card-hover))]"
            >
              <RotateCcw className="w-4 h-4 mr-1.5" /> Restaurar padrão
            </Button>
            <Button onClick={handleSave} disabled={saving} className="flex-1 sm:flex-none">
              {saving ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Save className="w-4 h-4 mr-1.5" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminAIInstructions;