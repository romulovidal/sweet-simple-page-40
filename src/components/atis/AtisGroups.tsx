import { useEffect, useState } from "react";
import { atisDb } from "./atisDb";
import { toast } from "sonner";
import { Plus, Trash2, Loader2, Bot } from "lucide-react";

type Group = { id: string; name: string; wa_group_id: string | null; respond_mode: "mention_only" | "always" | "off"; active: boolean; welcome_message: string | null };

const modes: Record<string, string> = { mention_only: "Só quando mencionado", always: "Sempre", off: "Desligado" };

const AtisGroups = () => {
  const [items, setItems] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: "", wa_group_id: "" });

  const load = async () => {
    setLoading(true);
    const { data } = await atisDb.from("atis_groups").select("*").order("name");
    setItems((data ?? []) as Group[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const add = async () => {
    if (!form.name.trim()) return toast.error("Nome obrigatório");
    const { error } = await atisDb.from("atis_groups").insert({ name: form.name.trim(), wa_group_id: form.wa_group_id.trim() || null });
    if (error) toast.error(error.message);
    else { toast.success("Grupo cadastrado"); setForm({ name: "", wa_group_id: "" }); load(); }
  };

  const update = async (id: string, patch: Partial<Group>) => {
    const { error } = await atisDb.from("atis_groups").update(patch).eq("id", id);
    if (error) toast.error(error.message); else load();
  };

  const remove = async (id: string) => {
    if (!confirm("Remover grupo?")) return;
    await atisDb.from("atis_groups").delete().eq("id", id);
    load();
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-[hsl(var(--dark-card))] p-4 space-y-3">
        <p className="text-sm font-bold flex items-center gap-2"><Plus className="w-4 h-4" /> Novo grupo</p>
        <div className="grid md:grid-cols-2 gap-2">
          <input className="input" placeholder="Nome do grupo" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          <input className="input" placeholder="ID do grupo (opcional, ex: 12345@g.us)" value={form.wa_group_id} onChange={e => setForm({ ...form, wa_group_id: e.target.value })} />
        </div>
        <button onClick={add} className="w-full h-11 rounded-xl bg-primary text-primary-foreground font-semibold text-sm">Adicionar grupo</button>
      </div>

      <div className="rounded-2xl bg-[hsl(var(--dark-card))] p-4">
        {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : items.length === 0 ? (
          <p className="text-center text-sm text-[hsl(var(--dark-muted))] py-6">Nenhum grupo cadastrado</p>
        ) : (
          <ul className="divide-y divide-[hsl(var(--dark-card-hover))]">
            {items.map(g => (
              <li key={g.id} className="py-3 flex items-center gap-3">
                <span className="w-9 h-9 rounded-full bg-[hsl(var(--dark-card-hover))] grid place-items-center"><Bot className="w-4 h-4" /></span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{g.name}</p>
                  <p className="text-xs text-[hsl(var(--dark-muted))] truncate">{g.wa_group_id || "sem ID vinculado"}</p>
                </div>
                <select value={g.respond_mode} onChange={e => update(g.id, { respond_mode: e.target.value as Group["respond_mode"] })}
                  className="text-xs bg-[hsl(var(--dark-bg))] border border-[hsl(var(--dark-card-hover))] rounded-lg px-2 py-1.5">
                  {Object.entries(modes).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
                <button onClick={() => remove(g.id)} className="p-1.5 text-destructive hover:bg-destructive/10 rounded-lg"><Trash2 className="w-4 h-4" /></button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <style>{`.input{width:100%;height:42px;padding:0 12px;border-radius:12px;background:hsl(var(--dark-bg));color:hsl(var(--dark-text));border:1px solid hsl(var(--dark-card-hover));font-size:14px}`}</style>
    </div>
  );
};

export default AtisGroups;