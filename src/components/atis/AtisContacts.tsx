import { useEffect, useState } from "react";
import { atisDb } from "./atisDb";
import { toast } from "sonner";
import { Plus, Trash2, Search, Loader2, User, Pencil, X, Check } from "lucide-react";

type Contact = { id: string; name: string; phone: string; tags: string[]; opt_in: boolean; birthday: string | null; notes: string | null };

const AtisContacts = () => {
  const [items, setItems] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [form, setForm] = useState({ name: "", phone: "", tags: "", birthday: "" });
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: "", phone: "", tags: "", birthday: "" });

  const load = async () => {
    setLoading(true);
    const { data, error } = await atisDb.from("atis_contacts").select("*").order("name");
    if (error) toast.error("Erro ao carregar contatos");
    else setItems(data as Contact[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const add = async () => {
    if (!form.name.trim() || !form.phone.trim()) { toast.error("Nome e telefone obrigatórios"); return; }
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      phone: form.phone.trim(),
      tags: form.tags.split(",").map(s => s.trim()).filter(Boolean),
      birthday: form.birthday || null,
    };
    const { error } = await atisDb.from("atis_contacts").insert(payload);
    setSaving(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Contato adicionado");
      setForm({ name: "", phone: "", tags: "", birthday: "" });
      load();
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Remover contato?")) return;
    const { error } = await atisDb.from("atis_contacts").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Removido"); load(); }
  };

  const startEdit = (c: Contact) => {
    setEditId(c.id);
    setEditForm({ name: c.name, phone: c.phone, tags: (c.tags ?? []).join(", "), birthday: c.birthday ?? "" });
  };
  const cancelEdit = () => { setEditId(null); };
  const saveEdit = async (id: string) => {
    if (!editForm.name.trim() || !editForm.phone.trim()) { toast.error("Nome e telefone obrigatórios"); return; }
    const payload = {
      name: editForm.name.trim(),
      phone: editForm.phone.trim(),
      tags: editForm.tags.split(",").map(s => s.trim()).filter(Boolean),
      birthday: editForm.birthday || null,
    };
    const { error } = await atisDb.from("atis_contacts").update(payload).eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Atualizado"); setEditId(null); load(); }
  };

  const toggleOptIn = async (c: Contact) => {
    const { error } = await atisDb.from("atis_contacts").update({ opt_in: !c.opt_in }).eq("id", c.id);
    if (error) toast.error(error.message);
    else load();
  };

  const filtered = items.filter(c =>
    !q || c.name.toLowerCase().includes(q.toLowerCase()) || c.phone.includes(q) || c.tags.some(t => t.toLowerCase().includes(q.toLowerCase()))
  );

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-[hsl(var(--dark-card))] p-4 space-y-3">
        <p className="text-sm font-bold flex items-center gap-2"><Plus className="w-4 h-4" /> Novo contato</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <input className="input" placeholder="Nome" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          <input className="input" placeholder="Telefone (ex: 5585999999999)" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
          <input className="input" placeholder="Tags separadas por vírgula" value={form.tags} onChange={e => setForm({ ...form, tags: e.target.value })} />
          <input className="input" type="date" value={form.birthday} onChange={e => setForm({ ...form, birthday: e.target.value })} />
        </div>
        <button onClick={add} disabled={saving} className="w-full h-11 rounded-xl bg-primary text-primary-foreground font-semibold text-sm disabled:opacity-50">
          {saving ? "Salvando..." : "Adicionar contato"}
        </button>
      </div>

      <div className="rounded-2xl bg-[hsl(var(--dark-card))] p-4">
        <div className="relative mb-3">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(var(--dark-muted))]" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar por nome, telefone ou tag" className="input pl-9" />
        </div>
        {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : filtered.length === 0 ? (
          <p className="text-center text-sm text-[hsl(var(--dark-muted))] py-6">Nenhum contato ainda</p>
        ) : (
          <ul className="divide-y divide-[hsl(var(--dark-card-hover))]">
            {filtered.map(c => (
              <li key={c.id} className="py-3">
                {editId === c.id ? (
                  <div className="space-y-2">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      <input className="input" placeholder="Nome" value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} />
                      <input className="input" placeholder="Telefone" value={editForm.phone} onChange={e => setEditForm({ ...editForm, phone: e.target.value })} />
                      <input className="input" placeholder="Tags separadas por vírgula" value={editForm.tags} onChange={e => setEditForm({ ...editForm, tags: e.target.value })} />
                      <input className="input" type="date" value={editForm.birthday} onChange={e => setEditForm({ ...editForm, birthday: e.target.value })} />
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => saveEdit(c.id)} className="flex-1 h-10 rounded-xl bg-primary text-primary-foreground font-semibold text-sm flex items-center justify-center gap-1"><Check className="w-4 h-4" /> Salvar</button>
                      <button onClick={cancelEdit} className="flex-1 h-10 rounded-xl bg-[hsl(var(--dark-card-hover))] font-semibold text-sm flex items-center justify-center gap-1"><X className="w-4 h-4" /> Cancelar</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <span className="w-9 h-9 rounded-full bg-[hsl(var(--dark-card-hover))] grid place-items-center"><User className="w-4 h-4" /></span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{c.name}</p>
                      <p className="text-xs text-[hsl(var(--dark-muted))] truncate">{c.phone} {c.tags.length > 0 && `· ${c.tags.join(", ")}`}</p>
                    </div>
                    <button onClick={() => toggleOptIn(c)} className={`text-[10px] font-bold px-2 py-1 rounded-full ${c.opt_in ? "bg-green-500/20 text-green-500" : "bg-[hsl(var(--dark-card-hover))] text-[hsl(var(--dark-muted))]"}`}>
                      {c.opt_in ? "Ativo" : "Opt-out"}
                    </button>
                    <button onClick={() => startEdit(c)} className="p-1.5 text-primary hover:bg-primary/10 rounded-lg"><Pencil className="w-4 h-4" /></button>
                    <button onClick={() => remove(c.id)} className="p-1.5 text-destructive hover:bg-destructive/10 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <style>{`.input{width:100%;height:42px;padding:0 12px;border-radius:12px;background:hsl(var(--dark-bg));color:hsl(var(--dark-text));border:1px solid hsl(var(--dark-card-hover));font-size:14px}.input:focus{outline:none;border-color:hsl(var(--primary))}`}</style>
    </div>
  );
};

export default AtisContacts;