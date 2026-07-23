import { useEffect, useMemo, useState } from "react";
import { atisDb } from "./atisDb";
import { toast } from "sonner";
import { Plus, Trash2, Loader2, Cake, Pencil, X, Check, Power } from "lucide-react";
import AtisBirthdayAuto from "./AtisBirthdayAuto";

type Bday = { id: string; name: string; birth_date: string; phone: string | null; active: boolean };

const MESES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

const AtisBirthdays = () => {
  const [items, setItems] = useState<Bday[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: "", birth_date: "", phone: "" });
  const [editing, setEditing] = useState<Bday | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await atisDb.from("atis_birthdays").select("*").order("birth_date");
    if (error) toast.error(error.message);
    setItems((data ?? []) as Bday[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const add = async () => {
    if (!form.name.trim() || !form.birth_date) return toast.error("Nome e data obrigatórios");
    const { error } = await atisDb.from("atis_birthdays").insert({ name: form.name.trim(), birth_date: form.birth_date, phone: form.phone.trim() || null });
    if (error) toast.error(error.message);
    else { toast.success("Aniversariante adicionado"); setForm({ name: "", birth_date: "", phone: "" }); load(); }
  };

  const remove = async (id: string, name: string) => {
    if (!confirm(`Remover ${name}?`)) return;
    const { error } = await atisDb.from("atis_birthdays").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Removido");
    setItems(prev => prev.filter(i => i.id !== id));
  };

  const toggleActive = async (b: Bday) => {
    const { error } = await atisDb.from("atis_birthdays").update({ active: !b.active }).eq("id", b.id);
    if (error) return toast.error(error.message);
    setItems(prev => prev.map(i => i.id === b.id ? { ...i, active: !b.active } : i));
  };

  const saveEdit = async () => {
    if (!editing) return;
    if (!editing.name.trim() || !editing.birth_date) return toast.error("Nome e data obrigatórios");
    const { error } = await atisDb.from("atis_birthdays").update({
      name: editing.name.trim(),
      birth_date: editing.birth_date,
      phone: editing.phone?.trim() || null,
      active: editing.active,
    }).eq("id", editing.id);
    if (error) return toast.error(error.message);
    toast.success("Atualizado");
    setEditing(null);
    load();
  };

  const grouped = useMemo(() => {
    const g: Record<number, Bday[]> = {};
    for (const b of items) {
      const m = new Date(b.birth_date + "T00:00:00").getMonth();
      (g[m] ||= []).push(b);
    }
    for (const k of Object.keys(g)) g[+k].sort((a, b) => new Date(a.birth_date).getDate() - new Date(b.birth_date).getDate());
    return g;
  }, [items]);

  const fmtDay = (d: string) => String(new Date(d + "T00:00:00").getDate()).padStart(2, "0");

  return (
    <div className="space-y-4">
      <AtisBirthdayAuto />

      <div className="rounded-2xl bg-[hsl(var(--dark-card))] p-4 space-y-3">
        <p className="text-sm font-bold flex items-center gap-2"><Plus className="w-4 h-4" /> Novo aniversariante</p>
        <div className="grid md:grid-cols-3 gap-2">
          <input className="input" placeholder="Nome" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          <input className="input" type="date" value={form.birth_date} onChange={e => setForm({ ...form, birth_date: e.target.value })} />
          <input className="input" placeholder="Telefone (opcional)" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
        </div>
        <button onClick={add} className="w-full h-11 rounded-xl bg-primary text-primary-foreground font-semibold text-sm">Adicionar</button>
      </div>

      {loading ? (
        <div className="rounded-2xl bg-[hsl(var(--dark-card))] p-6"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl bg-[hsl(var(--dark-card))] p-6 text-center text-sm text-[hsl(var(--dark-muted))]">Nenhum aniversariante cadastrado</div>
      ) : (
        <div className="space-y-3">
          {MESES.map((mes, i) => grouped[i] && (
            <div key={i} className="rounded-2xl bg-[hsl(var(--dark-card))] p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-[hsl(var(--dark-muted))] mb-2">{mes} · {grouped[i].length}</p>
              <ul className="divide-y divide-[hsl(var(--dark-card-hover))]">
                {grouped[i].map(b => (
                  <li key={b.id} className={`py-3 flex items-center gap-3 ${!b.active ? "opacity-50" : ""}`}>
                    <span className="w-10 h-10 rounded-full bg-[hsl(var(--streak-orange)/0.15)] text-[hsl(var(--streak-orange))] grid place-items-center font-bold text-sm">{fmtDay(b.birth_date)}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate flex items-center gap-1"><Cake className="w-3.5 h-3.5" /> {b.name}</p>
                      {b.phone && <p className="text-xs text-[hsl(var(--dark-muted))]">{b.phone}</p>}
                    </div>
                    <button onClick={() => toggleActive(b)} title={b.active ? "Desativar" : "Ativar"} className={`p-1.5 rounded-lg ${b.active ? "text-emerald-500 hover:bg-emerald-500/10" : "text-[hsl(var(--dark-muted))] hover:bg-white/5"}`}><Power className="w-4 h-4" /></button>
                    <button onClick={() => setEditing(b)} className="p-1.5 text-primary hover:bg-primary/10 rounded-lg"><Pencil className="w-4 h-4" /></button>
                    <button onClick={() => remove(b.id, b.name)} className="p-1.5 text-destructive hover:bg-destructive/10 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 bg-black/60 grid place-items-center p-4" onClick={() => setEditing(null)}>
          <div className="w-full max-w-md rounded-2xl bg-[hsl(var(--dark-card))] p-4 space-y-3" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold">Editar aniversariante</p>
              <button onClick={() => setEditing(null)} className="p-1.5 hover:bg-white/5 rounded-lg"><X className="w-4 h-4" /></button>
            </div>
            <input className="input" placeholder="Nome" value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} />
            <input className="input" type="date" value={editing.birth_date} onChange={e => setEditing({ ...editing, birth_date: e.target.value })} />
            <input className="input" placeholder="Telefone (opcional)" value={editing.phone ?? ""} onChange={e => setEditing({ ...editing, phone: e.target.value })} />
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={editing.active} onChange={e => setEditing({ ...editing, active: e.target.checked })} /> Ativo</label>
            <button onClick={saveEdit} className="w-full h-11 rounded-xl bg-primary text-primary-foreground font-semibold text-sm flex items-center justify-center gap-2"><Check className="w-4 h-4" /> Salvar</button>
          </div>
        </div>
      )}

      <style>{`.input{width:100%;height:42px;padding:0 12px;border-radius:12px;background:hsl(var(--dark-bg));color:hsl(var(--dark-text));border:1px solid hsl(var(--dark-card-hover));font-size:14px}`}</style>
    </div>
  );
};

export default AtisBirthdays;