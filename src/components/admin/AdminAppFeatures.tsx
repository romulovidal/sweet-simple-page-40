import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Monitor, Volume2, StickyNote, HandHeart, Target, MessageCircleQuestion, BellRing,
  Loader2, ToggleLeft, ToggleRight, Settings2,
} from "lucide-react";
import type { AppFeatures } from "@/hooks/useAppFeatures";

const FEATURES_CONFIG: { key: keyof AppFeatures; label: string; description: string; icon: typeof Monitor; color: string }[] = [
  { key: "presentation_mode", label: "Modo Apresentação", description: "Tela cheia para projeção em cultos e estudos", icon: Monitor, color: "text-blue-400" },
  { key: "audio_bible", label: "Áudio Bíblia", description: "Leitura em voz com destaque do texto em tempo real", icon: Volume2, color: "text-green-400" },
  { key: "personal_notes", label: "Anotações Pessoais", description: "Notas vinculadas a versículos bíblicos", icon: StickyNote, color: "text-yellow-400" },
  { key: "prayer_requests", label: "Pedidos de Oração", description: "Feed de pedidos de oração da comunidade", icon: HandHeart, color: "text-pink-400" },
  { key: "reading_goals", label: "Metas de Leitura", description: "Metas anuais de leitura com progresso visual", icon: Target, color: "text-orange-400" },
  { key: "ask_bible", label: "Pergunte à Bíblia", description: "Chat com IA para perguntas bíblicas", icon: MessageCircleQuestion, color: "text-purple-400" },
  { key: "smart_notifications", label: "Notificações Inteligentes", description: "Lembretes baseados em padrões de leitura", icon: BellRing, color: "text-cyan-400" },
];

const DEFAULT_FEATURES: AppFeatures = {
  presentation_mode: true,
  audio_bible: true,
  personal_notes: true,
  prayer_requests: true,
  reading_goals: true,
  ask_bible: true,
  smart_notifications: true,
};

const AdminAppFeatures = () => {
  const [features, setFeatures] = useState<AppFeatures>(DEFAULT_FEATURES);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase
      .from("admin_settings")
      .select("value")
      .eq("key", "app_features")
      .maybeSingle()
      .then(({ data }) => {
        if (data?.value && typeof data.value === "object") {
          setFeatures({ ...DEFAULT_FEATURES, ...(data.value as Partial<AppFeatures>) });
        }
        setLoading(false);
      });
  }, []);

  const toggleFeature = async (key: keyof AppFeatures) => {
    const newFeatures = { ...features, [key]: !features[key] };
    setFeatures(newFeatures);
    setSaving(true);

    const { error } = await (supabase
      .from("admin_settings") as any)
      .upsert({ key: "app_features", value: newFeatures as unknown as Record<string, unknown> }, { onConflict: "key" });

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
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center">
          <Settings2 className="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 className="text-lg font-bold">Funcionalidades do App</h2>
          <p className="text-xs text-[hsl(var(--dark-muted))]">Ative ou desative cada funcionalidade do aplicativo</p>
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

export default AdminAppFeatures;
