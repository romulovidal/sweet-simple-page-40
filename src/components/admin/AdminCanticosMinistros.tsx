import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, ArrowUp, ArrowDown, User } from "lucide-react";

type Ministro = {
  id: string;
  nome: string;
  foto_url: string | null;
  ativo: boolean;
  sort_order: number;
};

export default function AdminCanticosMinistros() {
  const [list, setList] = useState<Ministro[]>([]);
  const [loading, setLoading] = useState(true);
  const [nome, setNome] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("canticos_ministros")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("nome", { ascending: true });
    if (error) toast.error(error.message);
    setList((data as Ministro[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const add = async () => {
    if (!nome.trim()) return;
    setSaving(true);
    const nextOrder = (list[list.length - 1]?.sort_order ?? 0) + 10;
    const { error } = await supabase
      .from("canticos_ministros")
      .insert({ nome: nome.trim(), sort_order: nextOrder, ativo: true });
    setSaving(false);
    if (error) return toast.error(error.message);
    setNome("");
    toast.success("Ministro adicionado");
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Remover este ministro?")) return;
    const { error } = await supabase.from("canticos_ministros").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  const toggleAtivo = async (m: Ministro) => {
    const { error } = await supabase
      .from("canticos_ministros")
      .update({ ativo: !m.ativo })
      .eq("id", m.id);
    if (error) return toast.error(error.message);
    load();
  };

  const move = async (idx: number, dir: -1 | 1) => {
    const other = list[idx + dir];
    const cur = list[idx];
    if (!other || !cur) return;
    await supabase.from("canticos_ministros").update({ sort_order: other.sort_order }).eq("id", cur.id);
    await supabase.from("canticos_ministros").update({ sort_order: cur.sort_order }).eq("id", other.id);
    load();
  };

  const rename = async (m: Ministro) => {
    const novo = prompt("Novo nome:", m.nome);
    if (!novo || novo === m.nome) return;
    const { error } = await supabase.from("canticos_ministros").update({ nome: novo.trim() }).eq("id", m.id);
    if (error) return toast.error(error.message);
    load();
  };

  const setFoto = async (m: Ministro) => {
    const url = prompt("URL da foto (deixe vazio para remover):", m.foto_url ?? "");
    if (url === null) return;
    const clean = url.trim() || null;
    const { error } = await supabase.from("canticos_ministros").update({ foto_url: clean }).eq("id", m.id);
    if (error) return toast.error(error.message);
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <input
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Nome do ministro"
          className="flex-1 h-10 px-3 rounded-lg bg-[hsl(var(--dark-card))] border border-[hsl(var(--dark-card-hover))] text-sm"
          onKeyDown={(e) => e.key === "Enter" && add()}
        />
        <button
          onClick={add}
          disabled={saving || !nome.trim()}
          className="h-10 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium flex items-center gap-2 disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          Adicionar
        </button>
      </div>

      {loading ? (
        <div className="py-8 text-center"><Loader2 className="w-5 h-5 animate-spin inline" /></div>
      ) : list.length === 0 ? (
        <div className="py-8 text-center text-sm text-[hsl(var(--dark-muted))]">Nenhum ministro cadastrado</div>
      ) : (
        <ul className="space-y-2">
          {list.map((m, idx) => (
            <li key={m.id} className="flex items-center gap-3 p-3 rounded-xl bg-[hsl(var(--dark-card))] border border-[hsl(var(--dark-card-hover))]">
              <button onClick={() => setFoto(m)} className="w-10 h-10 rounded-full bg-[hsl(var(--dark-card-hover))] flex items-center justify-center overflow-hidden shrink-0">
                {m.foto_url ? (
                  <img src={m.foto_url} alt={m.nome} className="w-full h-full object-cover" />
                ) : (
                  <User className="w-5 h-5 text-[hsl(var(--dark-muted))]" />
                )}
              </button>
              <button onClick={() => rename(m)} className="flex-1 text-left text-sm font-medium">
                {m.nome}
              </button>
              <label className="flex items-center gap-1.5 text-xs">
                <input type="checkbox" checked={m.ativo} onChange={() => toggleAtivo(m)} />
                Ativo
              </label>
              <div className="flex items-center gap-1">
                <button onClick={() => move(idx, -1)} disabled={idx === 0} className="p-1.5 rounded-md hover:bg-[hsl(var(--dark-card-hover))] disabled:opacity-30">
                  <ArrowUp className="w-4 h-4" />
                </button>
                <button onClick={() => move(idx, 1)} disabled={idx === list.length - 1} className="p-1.5 rounded-md hover:bg-[hsl(var(--dark-card-hover))] disabled:opacity-30">
                  <ArrowDown className="w-4 h-4" />
                </button>
                <button onClick={() => remove(m.id)} className="p-1.5 rounded-md text-red-400 hover:bg-red-500/10">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}