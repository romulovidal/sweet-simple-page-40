import { useEffect, useState } from "react";
import { atisDb } from "./atisDb";
import { toast } from "sonner";
import { Plus, Trash2, Loader2, CalendarClock } from "lucide-react";

type BC = { id: string; title: string; body: string; target_type: string; target_ref: string | null; scheduled_at: string | null; recurrence: string | null; status: string; content_type: string };

const AtisBroadcasts = () => {
  const [items, setItems] = useState<BC[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ title: "", body: "", target_type: "all", target_ref: "", scheduled_at: "", recurrence: "once", content_type: "text" });

  const load = async () => {
    setLoading(true);
    const { data } = await atisDb.from("atis_broadcasts").select("*").order("scheduled_at", { ascending: true, nullsFirst: false });
    setItems((data ?? []) as BC[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const add = async () => {
    if (!form.title.trim() || !form.body.trim()) return toast.error("Título e mensagem obrigatórios");
    const payload = {
      title: form.title.trim(),
      body: form.body.trim(),
      target_type: form.target_type,
      target_ref: form.target_ref.trim() || null,
      scheduled_at: form.scheduled_at ? new Date(form.scheduled_at).toISOString() : null,
      recurrence: form.recurrence,
      content_type: form.content_type,
    };
    const { error } = await atisDb.from("atis_broadcasts").insert(payload);
    if (error) toast.error(error.message);
    else { toast.success("Agendado"); setForm({ title: "", body: "", target_type: "all", target_ref: "", scheduled_at: "", recurrence: "once", content_type: "text" }); load(); }
  };

  const remove = async (id: string) => {
    if (!confirm("Cancelar envio?")) return;
    await atisDb.from("atis_broadcasts").delete().eq("id", id);
    load();
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-[hsl(var(--dark-card))] p-4 space-y-3">
        <p className="text-sm font-bold flex items-center gap-2"><Plus className="w-4 h-4" /> Novo envio</p>
        <input className="input" placeholder="Título interno" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
        <textarea className="input" style={{ height: 90, padding: 10 }} placeholder="Mensagem (use {nome} para personalizar)" value={form.body} onChange={e => setForm({ ...form, body: e.target.value })} />
        <div className="grid md:grid-cols-3 gap-2">
          <select className="input" value={form.target_type} onChange={e => setForm({ ...form, target_type: e.target.value })}>
            <option value="all">Todos os contatos</option>
            <option value="tag">Por tag</option>
            <option value="group">Grupo</option>
            <option value="contact">Contato específico</option>
          </select>
          <input className="input" placeholder={form.target_type === "all" ? "—" : "Referência (tag, id grupo, telefone)"} value={form.target_ref} onChange={e => setForm({ ...form, target_ref: e.target.value })} disabled={form.target_type === "all"} />
          <select className="input" value={form.content_type} onChange={e => setForm({ ...form, content_type: e.target.value })}>
            <option value="text">Texto</option>
            <option value="verse">Versículo</option>
            <option value="hino">Hino Harpa</option>
            <option value="study">Estudo</option>
            <option value="devotional">Devocional</option>
          </select>
        </div>
        <div className="grid md:grid-cols-2 gap-2">
          <input className="input" type="datetime-local" value={form.scheduled_at} onChange={e => setForm({ ...form, scheduled_at: e.target.value })} />
          <select className="input" value={form.recurrence} onChange={e => setForm({ ...form, recurrence: e.target.value })}>
            <option value="once">Uma vez</option>
            <option value="daily">Diário</option>
            <option value="weekly">Semanal</option>
          </select>
        </div>
        <button onClick={add} className="w-full h-11 rounded-xl bg-primary text-primary-foreground font-semibold text-sm">Agendar envio</button>
      </div>

      <div className="rounded-2xl bg-[hsl(var(--dark-card))] p-4">
        {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : items.length === 0 ? (
          <p className="text-center text-sm text-[hsl(var(--dark-muted))] py-6">Nenhum envio agendado</p>
        ) : (
          <ul className="divide-y divide-[hsl(var(--dark-card-hover))]">
            {items.map(b => (
              <li key={b.id} className="py-3 flex items-start gap-3">
                <span className="w-9 h-9 rounded-full bg-[hsl(var(--dark-card-hover))] grid place-items-center mt-0.5"><CalendarClock className="w-4 h-4" /></span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{b.title}</p>
                  <p className="text-xs text-[hsl(var(--dark-muted))] line-clamp-2">{b.body}</p>
                  <p className="text-[10px] text-[hsl(var(--dark-muted))] mt-1">
                    {b.scheduled_at ? new Date(b.scheduled_at).toLocaleString("pt-BR") : "sem data"} · {b.recurrence} · {b.target_type}{b.target_ref ? ` (${b.target_ref})` : ""} · <span className="uppercase">{b.status}</span>
                  </p>
                </div>
                <button onClick={() => remove(b.id)} className="p-1.5 text-destructive hover:bg-destructive/10 rounded-lg"><Trash2 className="w-4 h-4" /></button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <style>{`.input{width:100%;height:42px;padding:0 12px;border-radius:12px;background:hsl(var(--dark-bg));color:hsl(var(--dark-text));border:1px solid hsl(var(--dark-card-hover));font-size:14px}`}</style>
    </div>
  );
};

export default AtisBroadcasts;