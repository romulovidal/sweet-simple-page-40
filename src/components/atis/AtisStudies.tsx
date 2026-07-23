import { useEffect, useState } from "react";
import { atisDb } from "./atisDb";
import { toast } from "sonner";
import { Plus, Trash2, Loader2, BookOpen, Calendar, FileText, ExternalLink } from "lucide-react";

type Study = { id: string; title: string; theme: string | null; base_text: string; refs: string[]; questions: string[]; published: boolean };
type Plan = { id: string; title: string; description: string | null; category: string | null; total_days: number | null; is_active: boolean; image_emoji: string | null };
type Post = { id: string; title: string; excerpt: string | null; published: boolean; created_at: string };

type TabKey = "studies" | "plans" | "posts";

const AtisStudies = () => {
  const [items, setItems] = useState<Study[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabKey>("studies");
  const [form, setForm] = useState({ title: "", theme: "", base_text: "", refs: "", questions: "" });

  const load = async () => {
    setLoading(true);
    const [s, p, po] = await Promise.all([
      atisDb.from("atis_studies").select("*").order("created_at", { ascending: false }),
      atisDb.from("admin_plans").select("id,title,description,category,total_days,is_active,image_emoji").order("sort_order", { ascending: true }),
      atisDb.from("admin_posts").select("id,title,excerpt,published,created_at").order("created_at", { ascending: false }).limit(20),
    ]);
    setItems((s.data ?? []) as Study[]);
    setPlans((p.data ?? []) as Plan[]);
    setPosts((po.data ?? []) as Post[]);
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
      <div className="flex items-center gap-1.5 rounded-2xl bg-[hsl(var(--dark-card))] p-1.5">
        {([
          { k: "studies", label: `Estudos · ${items.length}`, icon: BookOpen },
          { k: "plans", label: `Planos · ${plans.length}`, icon: Calendar },
          { k: "posts", label: `Posts · ${posts.length}`, icon: FileText },
        ] as const).map(({ k, label, icon: Icon }) => (
          <button key={k} onClick={() => setTab(k)} className={`flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold py-2 rounded-xl transition-colors ${tab === k ? "bg-[hsl(var(--dark-card-hover))] text-[hsl(var(--dark-text))]" : "text-[hsl(var(--dark-muted))]"}`}>
            <Icon className="w-3.5 h-3.5" /> {label}
          </button>
        ))}
      </div>

      {tab === "studies" && (
      <>
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
      </>
      )}

      {tab === "plans" && (
        <div className="rounded-2xl bg-[hsl(var(--dark-card))] p-4">
          <p className="text-xs text-[hsl(var(--dark-muted))] mb-3">Planos de leitura cadastrados no app da Bíblia. O Atis pode citar e enviar quando alguém pedir por um plano.</p>
          {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto my-4" /> : plans.length === 0 ? (
            <p className="text-center text-sm text-[hsl(var(--dark-muted))] py-6">Nenhum plano cadastrado no painel admin.</p>
          ) : (
            <ul className="grid md:grid-cols-2 gap-2">
              {plans.map((p) => (
                <li key={p.id} className="rounded-xl bg-[hsl(var(--dark-bg))] p-3 flex items-start gap-3">
                  <span className="text-2xl leading-none">{p.image_emoji ?? "📖"}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold truncate">{p.title}</p>
                    <p className="text-[11px] text-[hsl(var(--dark-muted))] line-clamp-2">{p.description}</p>
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-[hsl(var(--dark-card-hover))]">{p.category ?? "Geral"}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-[hsl(var(--dark-card-hover))]">{p.total_days ?? 0} dias</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${p.is_active ? "bg-green-500/15 text-green-400" : "bg-red-500/15 text-red-400"}`}>
                        {p.is_active ? "Ativo" : "Inativo"}
                      </span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {tab === "posts" && (
        <div className="rounded-2xl bg-[hsl(var(--dark-card))] p-4">
          <p className="text-xs text-[hsl(var(--dark-muted))] mb-3">Últimos posts/devocionais publicados no app. O Atis pode encaminhá-los para grupos.</p>
          {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto my-4" /> : posts.length === 0 ? (
            <p className="text-center text-sm text-[hsl(var(--dark-muted))] py-6">Nenhum post cadastrado.</p>
          ) : (
            <ul className="divide-y divide-[hsl(var(--dark-card-hover))]">
              {posts.map((po) => (
                <li key={po.id} className="py-3 flex items-start gap-3">
                  <span className="w-9 h-9 rounded-full bg-[hsl(var(--dark-card-hover))] grid place-items-center"><FileText className="w-4 h-4" /></span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{po.title}</p>
                    <p className="text-[11px] text-[hsl(var(--dark-muted))] line-clamp-2">{po.excerpt}</p>
                    <p className="text-[10px] text-[hsl(var(--dark-muted))] mt-1">
                      {new Date(po.created_at).toLocaleDateString("pt-BR")} · {po.published ? "publicado" : "rascunho"}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <style>{`.input{width:100%;height:42px;padding:0 12px;border-radius:12px;background:hsl(var(--dark-bg));color:hsl(var(--dark-text));border:1px solid hsl(var(--dark-card-hover));font-size:14px}`}</style>
    </div>
  );
};

export default AtisStudies;