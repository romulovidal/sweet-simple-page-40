import { useEffect, useState } from "react";
import { atisDb } from "./atisDb";
import { toast } from "sonner";
import { Plus, Trash2, Loader2, Cake } from "lucide-react";

type Bday = { id: string; name: string; birth_date: string; phone: string | null; active: boolean };

const AtisBirthdays = () => {
  const [items, setItems] = useState<Bday[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: "", birth_date: "", phone: "" });

  const load = async () => {
    setLoading(true);
    const { data } = await atisDb.from("atis_birthdays").select("*").order("birth_date");
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

  const remove = async (id: string) => {
    if (!confirm("Remover aniversariante?")) return;
    await atisDb.from("atis_birthdays").delete().eq("id", id);
    load();
  };

  const fmt = (d: string) => {
    const dt = new Date(d + "T00:00:00");
    return dt.toLocaleDateString("pt-BR", { day: "2-digit", month: "long" });
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-[hsl(var(--dark-card))] p-4 space-y-3">
        <p className="text-sm font-bold flex items-center gap-2"><Plus className="w-4 h-4" /> Novo aniversariante</p>
        <div className="grid md:grid-cols-3 gap-2">
          <input className="input" placeholder="Nome" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          <input className="input" type="date" value={form.birth_date} onChange={e => setForm({ ...form, birth_date: e.target.value })} />
          <input className="input" placeholder="Telefone (opcional)" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
        </div>
        <button onClick={add} className="w-full h-11 rounded-xl bg-primary text-primary-foreground font-semibold text-sm">Adicionar</button>
      </div>

      <div className="rounded-2xl bg-[hsl(var(--dark-card))] p-4">
        {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : items.length === 0 ? (
          <p className="text-center text-sm text-[hsl(var(--dark-muted))] py-6">Nenhum aniversariante cadastrado</p>
        ) : (
          <ul className="divide-y divide-[hsl(var(--dark-card-hover))]">
            {items.map(b => (
              <li key={b.id} className="py-3 flex items-center gap-3">
                <span className="w-9 h-9 rounded-full bg-[hsl(var(--streak-orange)/0.15)] text-[hsl(var(--streak-orange))] grid place-items-center"><Cake className="w-4 h-4" /></span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{b.name}</p>
                  <p className="text-xs text-[hsl(var(--dark-muted))]">{fmt(b.birth_date)}{b.phone && ` · ${b.phone}`}</p>
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

export default AtisBirthdays;