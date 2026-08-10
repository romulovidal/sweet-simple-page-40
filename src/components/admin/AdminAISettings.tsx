import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  BrainCircuit, BookOpen, Heart, Link2, Languages, Clock, Wand2, 
  Loader2, ToggleLeft, ToggleRight 
} from "lucide-react";
import type { AIFeatures } from "@/hooks/useAIFeatures";

const FEATURES_CONFIG: { key: keyof AIFeatures; label: string; description: string; icon: typeof BrainCircuit; color: string }[] = [
  { key: "exegetai", label: "ExegettAI", description: "Exegese bíblica completa com inteligência espiritual", icon: BrainCircuit, color: "text-amber-400" },
  { key: "summary", label: "Resumo do Capítulo", description: "Gera um resumo acadêmico ao abrir um capítulo", icon: BookOpen, color: "text-blue-400" },
  { key: "devotional", label: "Devocional Diário", description: "Reflexão devocional para o versículo do dia", icon: Heart, color: "text-purple-400" },
  { key: "connections", label: "Conexões Bíblicas", description: "Referências cruzadas e paralelos temáticos", icon: Link2, color: "text-emerald-400" },
  { key: "word_meaning", label: "Significado Original", description: "Significado das palavras em hebraico/grego", icon: Languages, color: "text-cyan-400" },
  { key: "timeline", label: "Linha do Tempo", description: "Contexto histórico e eventos da época", icon: Clock, color: "text-orange-400" },
  { key: "plan_generator", label: "Gerador de Planos", description: "Gera planos de leitura por tema com IA", icon: Wand2, color: "text-pink-400" },
];

const DEFAULT_FEATURES: AIFeatures = {
  summary: true,
  devotional: true,
  connections: true,
  word_meaning: true,
  timeline: true,
  plan_generator: true,
  exegetai: true,
};

const AdminAISettings = () => {
  const [features, setFeatures] = useState<AIFeatures>(DEFAULT_FEATURES);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase
      .from("admin_settings")
      .select("value")
      .eq("key", "ai_features")
      .maybeSingle()
      .then(({ data }) => {
        if (data?.value && typeof data.value === "object") {
          setFeatures({ ...DEFAULT_FEATURES, ...(data.value as Partial<AIFeatures>) });
        }
        setLoading(false);
      });
  }, []);

  const toggleFeature = async (key: keyof AIFeatures) => {
    const newFeatures = { ...features, [key]: !features[key] };
    setFeatures(newFeatures);
    setSaving(true);

    const { error } = await (supabase
      .from("admin_settings") as any)
      .upsert({ key: "ai_features", value: newFeatures as unknown as Record<string, unknown> }, { onConflict: "key" });

    if (error) {
      toast.error("Erro ao salvar configuração");
      setFeatures(features);
    } else {
      toast.success(`${FEATURES_CONFIG.find(f => f.key === key)?.label} ${newFeatures[key] ? "ativado" : "desativado"}`);
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
          <BrainCircuit className="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 className="text-lg font-bold">Recursos de Inteligência Espiritual</h2>
          <p className="text-xs text-[hsl(var(--dark-muted))]">Ative ou desative cada recurso inteligente</p>
        </div>
      </div>

      <div className="space-y-2">
        {FEATURES_CONFIG.map((feat) => {
          const Icon = feat.icon;
          const enabled = features[feat.key];
          return (
            <button
              key={feat.key}
              onClick={() => toggleFeature(feat.key)}
              disabled={saving}
              className={`w-full flex items-center gap-4 px-4 py-4 rounded-xl border transition-all ${
                enabled 
                  ? "bg-[hsl(var(--dark-card))] border-[hsl(var(--dark-card))]" 
                  : "bg-[hsl(var(--dark-card)/0.4)] border-[hsl(var(--dark-card)/0.5)] opacity-60"
              }`}
            >
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${enabled ? "bg-white/5" : "bg-white/3"}`}>
                <Icon className={`w-5 h-5 ${enabled ? feat.color : "text-[hsl(var(--dark-muted))]"}`} />
              </div>
              <div className="flex-1 text-left">
                <p className="text-sm font-semibold">{feat.label}</p>
                <p className="text-xs text-[hsl(var(--dark-muted))]">{feat.description}</p>
              </div>
              {enabled ? (
                <ToggleRight className="w-7 h-7 text-green-400" />
              ) : (
                <ToggleLeft className="w-7 h-7 text-[hsl(var(--dark-muted))]" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default AdminAISettings;
