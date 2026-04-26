import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Save, Loader2, Sparkles, RotateCcw } from "lucide-react";
import { toast } from "sonner";

const DEFAULT_PROMPT =
  "Você é um exegeta bíblico acadêmico. Ao receber um texto bíblico, faça uma exegese completa incluindo:\n" +
  "1) **Contexto histórico e cultural** da época em que o texto foi escrito\n" +
  "2) **Análise das palavras-chave** no idioma original (hebraico/grego), com transliteração\n" +
  "3) **Gênero literário** e estrutura do texto\n" +
  "4) **Significado teológico** e aplicação prática\n" +
  "5) **Referências cruzadas** relevantes\n\n" +
  "Seja profundo mas acessível. Use markdown para formatar. Responda sempre em português brasileiro.";

const AdminExegetAI = () => {
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("admin_settings")
      .select("value")
      .eq("key", "exegetai_prompt")
      .single()
      .then(({ data }) => {
        if (data?.value && typeof data.value === "object" && "prompt" in data.value) {
          const saved = (data.value as { prompt: string }).prompt;
          if (saved.trim()) setPrompt(saved);
        }
        setLoading(false);
      });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: existing } = await supabase
        .from("admin_settings")
        .select("id")
        .eq("key", "exegetai_prompt")
        .single();

      if (existing) {
        await supabase
          .from("admin_settings")
          .update({ value: { prompt } as any })
          .eq("key", "exegetai_prompt");
      } else {
        await supabase
          .from("admin_settings")
          .insert({ key: "exegetai_prompt", value: { prompt } as any });
      }
      toast.success("Prompt do ExegettAI salvo!");
    } catch {
      toast.error("Erro ao salvar prompt");
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
      <div className="flex items-center gap-2 mb-2">
        <Sparkles className="w-5 h-5 text-amber-500" />
        <h2 className="text-lg font-bold text-[hsl(var(--dark-text))]">Instrução ExegettAI</h2>
      </div>
      <p className="text-sm text-[hsl(var(--dark-muted))]">
        Personalize a instrução que a Inteligência Espiritual usa para gerar as exegeses.
      </p>

      <Textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        rows={12}
        className="bg-[hsl(var(--dark-bg))] border-[hsl(var(--dark-card-hover))] text-[hsl(var(--dark-text))] text-sm font-mono"
        placeholder="Digite o prompt da IA..."
      />

      <div className="flex items-center gap-3">
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Salvar prompt
        </Button>
        <Button
          variant="outline"
          onClick={() => setPrompt(DEFAULT_PROMPT)}
          className="gap-2 border-[hsl(var(--dark-card-hover))] text-[hsl(var(--dark-text))] hover:bg-[hsl(var(--dark-card))]"
        >
          <RotateCcw className="w-4 h-4" />
          Restaurar padrão
        </Button>
      </div>
    </div>
  );
};

export default AdminExegetAI;
