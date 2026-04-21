import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Save, RotateCcw, BookOpen, Heart, Link2, Languages, Clock, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type ToolKey = "summary" | "devotional" | "connections" | "word-meaning" | "timeline" | "plan-generator";

const DEFAULTS: Record<ToolKey, string> = {
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

const META: { key: ToolKey; label: string; description: string; icon: typeof BookOpen; color: string }[] = [
  { key: "summary", label: "Resumo do Capítulo", description: "Resumo acadêmico ao abrir um capítulo", icon: BookOpen, color: "text-blue-400" },
  { key: "devotional", label: "Devocional Diário", description: "Reflexão para o versículo do dia", icon: Heart, color: "text-purple-400" },
  { key: "connections", label: "Conexões Bíblicas", description: "Referências cruzadas e paralelos", icon: Link2, color: "text-emerald-400" },
  { key: "word-meaning", label: "Significado Original", description: "Palavras em hebraico/grego", icon: Languages, color: "text-cyan-400" },
  { key: "timeline", label: "Linha do Tempo", description: "Contexto histórico e eventos", icon: Clock, color: "text-orange-400" },
  { key: "plan-generator", label: "Gerador de Planos", description: "Cria planos de leitura por tema", icon: Wand2, color: "text-pink-400" },
];

const AdminAIPrompts = () => {
  const [prompts, setPrompts] = useState<Record<ToolKey, string>>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<ToolKey | null>(null);
  const [openKey, setOpenKey] = useState<ToolKey | null>("summary");

  useEffect(() => {
    supabase
      .from("admin_settings")
      .select("value")
      .eq("key", "ai_tool_prompts")
      .maybeSingle()
      .then(({ data }) => {
        if (data?.value && typeof data.value === "object") {
          const saved = data.value as Partial<Record<ToolKey, string>>;
          setPrompts({ ...DEFAULTS, ...saved });
        }
        setLoading(false);
      });
  }, []);

  const saveOne = async (key: ToolKey) => {
    setSavingKey(key);
    const next = { ...prompts };
    const { error } = await (supabase.from("admin_settings") as any).upsert(
      { key: "ai_tool_prompts", value: next as unknown as Record<string, unknown>, updated_at: new Date().toISOString() },
      { onConflict: "key" }
    );
    if (error) toast.error("Erro ao salvar prompt");
    else toast.success(`Prompt "${META.find(m => m.key === key)?.label}" salvo!`);
    setSavingKey(null);
  };

  const reset = (key: ToolKey) => {
    setPrompts((p) => ({ ...p, [key]: DEFAULTS[key] }));
    toast.info("Prompt restaurado (clique em salvar para confirmar)");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="mb-2">
        <h2 className="text-lg font-bold">Prompts das IAs</h2>
        <p className="text-xs text-[hsl(var(--dark-muted))]">
          Personalize o prompt de sistema usado por cada recurso de IA. As mudanças se aplicam imediatamente.
        </p>
      </div>

      {META.map((m) => {
        const Icon = m.icon;
        const open = openKey === m.key;
        return (
          <div key={m.key} className="bg-[hsl(var(--dark-card))] rounded-xl overflow-hidden">
            <button
              onClick={() => setOpenKey(open ? null : m.key)}
              className="w-full flex items-center gap-3 p-4 text-left"
            >
              <div className="w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center">
                <Icon className={`w-5 h-5 ${m.color}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold">{m.label}</p>
                <p className="text-xs text-[hsl(var(--dark-muted))] truncate">{m.description}</p>
              </div>
              <span className="text-xs text-[hsl(var(--dark-muted))]">{open ? "−" : "+"}</span>
            </button>
            {open && (
              <div className="px-4 pb-4 space-y-3">
                <Textarea
                  value={prompts[m.key]}
                  onChange={(e) => setPrompts((p) => ({ ...p, [m.key]: e.target.value }))}
                  className="bg-[hsl(var(--dark-bg))] border-none min-h-[180px] text-xs font-mono"
                  maxLength={5000}
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => saveOne(m.key)}
                    disabled={savingKey === m.key}
                    className="flex-1"
                  >
                    {savingKey === m.key ? (
                      <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4 mr-1" />
                    )}
                    Salvar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => reset(m.key)}
                    className="bg-[hsl(var(--dark-card))] border-[hsl(var(--dark-card-hover))] text-[hsl(var(--dark-text))] hover:bg-[hsl(var(--dark-card-hover))]"
                  >
                    <RotateCcw className="w-4 h-4 mr-1" /> Padrão
                  </Button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default AdminAIPrompts;
