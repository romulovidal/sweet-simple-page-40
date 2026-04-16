import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Save, RotateCcw, MessageCircleQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

const DEFAULT_PROMPT = `Você é um teólogo e pastor experiente. O usuário fará perguntas sobre a Bíblia, doutrina cristã, vida espiritual e temas relacionados.

Responda de forma:
1) Bíblica — sempre fundamente nas Escrituras com referências
2) Acessível — linguagem clara e acolhedora
3) Prática — conecte ao cotidiano do leitor
4) Equilibrada — apresente diferentes perspectivas quando relevante

Use markdown para formatação. Responda em português brasileiro.`;

const AdminAskBiblePrompt = () => {
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("admin_settings")
      .select("value")
      .eq("key", "ask_bible_prompt")
      .single()
      .then(({ data }) => {
        if (data?.value && typeof data.value === "string") {
          setPrompt(data.value as unknown as string);
        } else if (data?.value && typeof data.value === "object" && (data.value as any).prompt) {
          setPrompt((data.value as any).prompt);
        }
        setLoading(false);
      });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    const { error } = await (supabase.from("admin_settings") as any)
      .upsert({ key: "ask_bible_prompt", value: { prompt } }, { onConflict: "key" });

    if (error) {
      toast.error("Erro ao salvar prompt");
    } else {
      toast.success("Prompt salvo com sucesso!");
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
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-400 to-pink-500 flex items-center justify-center">
          <MessageCircleQuestion className="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 className="text-lg font-bold">Pergunte à Bíblia — Prompt</h2>
          <p className="text-xs text-[hsl(var(--dark-muted))]">Personalize o comportamento da IA ao responder perguntas</p>
        </div>
      </div>

      <Textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        className="bg-[hsl(var(--dark-card))] border-none min-h-[200px] text-sm"
        maxLength={5000}
      />

      <div className="flex gap-2">
        <Button onClick={handleSave} disabled={saving} className="flex-1">
          {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
          Salvar
        </Button>
        <Button variant="outline" onClick={() => setPrompt(DEFAULT_PROMPT)}
          className="bg-[hsl(var(--dark-card))] border-[hsl(var(--dark-card-hover))] text-[hsl(var(--dark-text))] hover:bg-[hsl(var(--dark-card-hover))] hover:text-[hsl(var(--dark-text))]">
          <RotateCcw className="w-4 h-4 mr-1" /> Restaurar padrão
        </Button>
      </div>
    </div>
  );
};

export default AdminAskBiblePrompt;
