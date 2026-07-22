import { useEffect, useState } from "react";
import { atisDb } from "./atisDb";
import { toast } from "sonner";
import { Plus, Trash2, Loader2, BookOpen } from "lucide-react";

type Study = { id: string; title: string; theme: string | null; base_text: string; refs: string[]; questions: string[]; published: boolean };

const AtisStudies = () => {
  const [items, setItems] = useState<Study[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ title: "", theme: "", base_text: "", refs: "", questions: "" });

  const load = async () => {
    setLoading(true);
    const { data } = await atisDb.from("atis_studies").select("*").order("created_at", { ascending: false });
    setItems((data ?? []) as Study[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const add = async () => {
    if (!form.title.trim() || !form.base_text.trim()) return toast.error("Título e texto base obrigatórios");
    const payload = {
      title: form.title.trim(),
      theme: form.theme.trim() || null,
      base_text: form.base_text.trim(),
      refs: form.refs.split(",").map(s => s.trim()).filter(Boolean),
      questions: form.questions.split("\n").map(s => s.trim()).filter(Boolean),
    };
    const { error } = await atisDb.from("atis_studies").insert(payload);
    if (error) toast.error(error.message);
    else { toast.success("Estudo criado"); setForm({ title: "", theme: "", base_text: "", refs: "", questions: "" }); load(); }
  };

  const togglePublish = async (s: Study) => {
    await atisDb.from("atis_studies").update({ published: !s.published }).eq("id", s.id);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Remover estudo?")) return;
    await atisDb.from("atis_studies").delete().eq("id", id);
    load();
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-[hsl(var(--dark-card))] p-4 space-y-3">
        <p className="text-sm font-bold flex items-center gap-2"><Plus className="w-4 h-4" /> Novo estudo</p>
        <input className="input" placeholder="Título" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
        <input className="input" placeholder="Tema (ex: Fé, Oração)" value={form.theme} onChange={e => setForm({ ...form, theme: e.target.value })} />
        <textarea className="input" style={{ height: 120, padding: 10 }} placeholder="Texto base do estudo" value={form.base_text} onChange={e => setForm({ ...form, base_text: e.target.value })} />
        <input className="input" placeholder="Referências (ex: Jo 3:16, Sl 23)" value={form.refs} onChange={e => setForm({ ...form, refs: e.target.value })} />
        <textarea className="input" style={{ height: 80, padding: 10 }} placeholder="Perguntas de reflexão (uma por linha)" value={form.questions} onChange={e => setForm({ ...form, questions: e.target.value })} />
        <button onClick={add} className="w-full h-11 rounded-xl bg-primary text-primary-foreground font-semibold text-sm">Criar estudo</button>
      </div>

      <div className="rounded-2xl bg-[hsl(var(--dark-card))] p-4">
        {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : items.length === 0 ? (
          <p className="text-center text-sm text-[hsl(var(--dark-muted))] py-6">Nenhum estudo criado</p>
        ) : (
          <ul className="divide-y divide-[hsl(var(--dark-card-hover))]">
            {items.map(s => (
              <li key={s.id} className="py-3 flex items-start gap-3">
                <span className="w-9 h-9 rounded-full bg-[hsl(var(--dark-card-hover))] grid place-items-center mt-0.5"><BookOpen className="w-4 h-4" /></span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{s.title}</p>
                  <p className="text-xs text-[hsl(var(--dark-muted))] truncate">{s.theme || "sem tema"}{s.refs.length > 0 && ` · ${s.refs.join(", ")}`}</p>
                </div>
                <button onClick={() => togglePublish(s)} className={`text-[10px] font-bold px-2 py-1 rounded-full ${s.published ? "bg-green-500/20 text-green-500" : "bg-[hsl(var(--dark-card-hover))] text-[hsl(var(--dark-muted))]"}`}>
                  {s.published ? "Publicado" : "Rascunho"}
                </button>
                <button onClick={() => remove(s.id)} className="p-1.5 text-destructive hover:bg-destructive/10 rounded-lg"><Trash2 className="w-4 h-4" /></button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <style>{`.input{width:100%;height:42px;padding:0 12px;border-radius:12px;background:hsl(var(--dark-bg));color:hsl(var(--dark-text));border:1px solid hsl(var(--dark-card-hover));font-size:14px}`}</style>
    </div>
  );
};

export default AtisStudies;