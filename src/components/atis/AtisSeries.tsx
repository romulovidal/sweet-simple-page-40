import { useEffect, useState } from "react";
import { atisDb } from "./atisDb";
import { toast } from "sonner";
import { Plus, Trash2, Save, Loader2, Users, X, BookOpen, UserPlus } from "lucide-react";

type SeriesItem = { day: number; title?: string; verse_ref?: string; verse_text?: string; body: string };
type Series = {
  id: string; name: string; theme: string | null;
  items: SeriesItem[]; send_time: string; active: boolean;
};
type Subscriber = {
  id: string; series_id: string; phone: string; name: string | null;
  current_day: number; active: boolean; last_sent_date: string | null;
};

const emptySeries: Series = { id: "", name: "", theme: "", items: [{ day: 1, body: "" }], send_time: "07:00", active: true };

const AtisSeries = () => {
  const [list, setList] = useState<Series[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Series | null>(null);
  const [saving, setSaving] = useState(false);
  const [subsFor, setSubsFor] = useState<Series | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await atisDb.from("atis_series").select("*").order("created_at", { ascending: false });
    if (error) toast.error(error.message); else setList((data as Series[]) ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!editing) return;
    if (!editing.name.trim()) { toast.error("Nome é obrigatório"); return; }
    if (!editing.items.length) { toast.error("Adicione ao menos 1 dia"); return; }
    setSaving(true);
    const payload: any = {
      name: editing.name.trim(), theme: editing.theme?.trim() || null,
      items: editing.items.map((it, i) => ({ ...it, day: i + 1 })),
      send_time: editing.send_time, active: editing.active,
    };
    let res;
    if (editing.id) res = await atisDb.from("atis_series").update(payload).eq("id", editing.id);
    else res = await atisDb.from("atis_series").insert(payload);
    setSaving(false);
    if (res.error) toast.error(res.error.message);
    else { toast.success("Série salva"); setEditing(null); load(); }
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir esta série? Todos os inscritos serão removidos.")) return;
    const { error } = await atisDb.from("atis_series").delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Removida"); load(); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Séries temáticas</h2>
          <p className="text-sm text-[hsl(var(--dark-muted))]">Envie sequências devocionais dia a dia via WhatsApp.</p>
        </div>
        <button onClick={() => setEditing({ ...emptySeries })} className="inline-flex items-center gap-1.5 bg-primary text-primary-foreground rounded-xl px-3 py-2 text-xs font-semibold">
          <Plus className="w-4 h-4" /> Nova série
        </button>
      </div>

      {loading ? <Loader2 className="w-6 h-6 animate-spin mx-auto mt-8 text-primary" /> :
        !list.length ? (
          <div className="bg-[hsl(var(--dark-card))] rounded-2xl p-8 text-center">
            <BookOpen className="w-10 h-10 text-[hsl(var(--dark-muted))] mx-auto mb-2" />
            <p className="text-sm text-[hsl(var(--dark-muted))]">Nenhuma série ainda. Crie a primeira.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {list.map((s) => (
              <div key={s.id} className="bg-[hsl(var(--dark-card))] rounded-2xl p-4">
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-bold truncate">{s.name}</p>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${s.active ? "bg-green-500/20 text-green-400" : "bg-[hsl(var(--dark-bg))] text-[hsl(var(--dark-muted))]"}`}>{s.active ? "ativa" : "pausada"}</span>
                    </div>
                    {s.theme && <p className="text-xs text-[hsl(var(--dark-muted))] mt-0.5">{s.theme}</p>}
                    <p className="text-[11px] text-[hsl(var(--dark-muted))] mt-1">{s.items.length} dia(s) · envia às {s.send_time}</p>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <button onClick={() => setSubsFor(s)} className="p-1.5 rounded-lg bg-[hsl(var(--dark-bg))] hover:bg-[hsl(var(--dark-card-hover))]" title="Inscritos"><Users className="w-4 h-4" /></button>
                    <button onClick={() => setEditing(s)} className="p-1.5 rounded-lg bg-[hsl(var(--dark-bg))] hover:bg-[hsl(var(--dark-card-hover))] text-primary text-[10px] font-bold px-2">Editar</button>
                    <button onClick={() => remove(s.id)} className="p-1.5 rounded-lg bg-[hsl(var(--dark-bg))] hover:bg-red-500/20 text-red-400"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

      {editing && <EditorModal series={editing} onChange={setEditing} onSave={save} onClose={() => setEditing(null)} saving={saving} />}
      {subsFor && <SubsModal series={subsFor} onClose={() => setSubsFor(null)} />}
    </div>
  );
};

const EditorModal = ({ series, onChange, onSave, onClose, saving }: {
  series: Series; onChange: (s: Series) => void; onSave: () => void; onClose: () => void; saving: boolean;
}) => {
  const set = (p: Partial<Series>) => onChange({ ...series, ...p });
  const setItem = (i: number, p: Partial<SeriesItem>) => {
    const items = series.items.map((it, idx) => idx === i ? { ...it, ...p } : it);
    set({ items });
  };
  const addItem = () => set({ items: [...series.items, { day: series.items.length + 1, body: "" }] });
  const rmItem = (i: number) => set({ items: series.items.filter((_, idx) => idx !== i) });

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-3">
      <div className="bg-[hsl(var(--dark-card))] rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-[hsl(var(--dark-card))] p-4 border-b border-[hsl(var(--dark-bg))] flex items-center justify-between">
          <p className="font-bold">{series.id ? "Editar série" : "Nova série"}</p>
          <button onClick={onClose}><X className="w-5 h-5" /></button>
        </div>
        <div className="p-4 space-y-3">
          <input className="input-atis" placeholder="Nome da série (ex: Salmos de refúgio)" value={series.name} onChange={(e) => set({ name: e.target.value })} />
          <input className="input-atis" placeholder="Tema (opcional)" value={series.theme ?? ""} onChange={(e) => set({ theme: e.target.value })} />
          <div className="grid grid-cols-2 gap-2">
            <input type="time" className="input-atis" value={series.send_time} onChange={(e) => set({ send_time: e.target.value })} />
            <label className="flex items-center gap-2 text-sm px-3">
              <input type="checkbox" checked={series.active} onChange={(e) => set({ active: e.target.checked })} /> Ativa
            </label>
          </div>

          <div className="space-y-2 pt-2">
            <p className="text-xs font-bold uppercase tracking-wide text-[hsl(var(--dark-muted))]">Dias ({series.items.length})</p>
            {series.items.map((it, i) => (
              <div key={i} className="bg-[hsl(var(--dark-bg))] rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold">Dia {i + 1}</p>
                  {series.items.length > 1 && <button onClick={() => rmItem(i)} className="text-red-400 text-xs">Remover</button>}
                </div>
                <input className="input-atis" placeholder="Título (opcional)" value={it.title ?? ""} onChange={(e) => setItem(i, { title: e.target.value })} />
                <input className="input-atis" placeholder="Referência (ex: Salmo 23:1)" value={it.verse_ref ?? ""} onChange={(e) => setItem(i, { verse_ref: e.target.value })} />
                <textarea className="input-atis" style={{ height: 60, padding: 10 }} placeholder="Texto do versículo (opcional)" value={it.verse_text ?? ""} onChange={(e) => setItem(i, { verse_text: e.target.value })} />
                <textarea className="input-atis" style={{ height: 90, padding: 10 }} placeholder="Reflexão / conteúdo do dia" value={it.body} onChange={(e) => setItem(i, { body: e.target.value })} />
              </div>
            ))}
            <button onClick={addItem} className="w-full py-2 rounded-xl border border-dashed border-[hsl(var(--dark-muted))] text-[hsl(var(--dark-muted))] text-xs font-semibold inline-flex items-center justify-center gap-1"><Plus className="w-3.5 h-3.5" /> Adicionar dia</button>
          </div>
        </div>
        <div className="sticky bottom-0 bg-[hsl(var(--dark-card))] p-4 border-t border-[hsl(var(--dark-bg))]">
          <button onClick={onSave} disabled={saving} className="w-full h-11 rounded-xl bg-primary text-primary-foreground font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-50">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Salvar série
          </button>
        </div>
      </div>
      <style>{`.input-atis{width:100%;height:40px;padding:0 12px;border-radius:10px;background:hsl(var(--dark-bg));color:hsl(var(--dark-text));border:1px solid hsl(var(--dark-card-hover));font-size:13px}`}</style>
    </div>
  );
};

const SubsModal = ({ series, onClose }: { series: Series; onClose: () => void }) => {
  const [subs, setSubs] = useState<Subscriber[]>([]);
  const [loading, setLoading] = useState(true);
  const [contacts, setContacts] = useState<Array<{ id: string; name: string; phone: string; opt_in: boolean }>>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [manualPhone, setManualPhone] = useState("");
  const [manualName, setManualName] = useState("");

  const load = async () => {
    setLoading(true);
    const [{ data: s }, { data: c }] = await Promise.all([
      atisDb.from("atis_series_subscribers").select("*").eq("series_id", series.id).order("created_at", { ascending: false }),
      atisDb.from("atis_contacts").select("id,name,phone,opt_in").eq("opt_in", true).order("name"),
    ]);
    setSubs((s as Subscriber[]) ?? []);
    setContacts((c as any) ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, [series.id]);

  const addSelected = async () => {
    const chosen = contacts.filter((c) => selected[c.id]);
    if (!chosen.length && !manualPhone) return;
    const rows = chosen.map((c) => ({
      series_id: series.id, phone: c.phone.replace(/\D/g, ""), name: c.name, contact_id: c.id,
    }));
    if (manualPhone) {
      const phone = manualPhone.replace(/\D/g, "");
      if (phone.length >= 10) rows.push({ series_id: series.id, phone, name: manualName || null, contact_id: null as any });
    }
    if (!rows.length) return;
    const { error } = await atisDb.from("atis_series_subscribers").upsert(rows, { onConflict: "series_id,phone" });
    if (error) toast.error(error.message);
    else {
      toast.success(`${rows.length} inscrito(s) adicionados`);
      setSelected({}); setManualPhone(""); setManualName(""); load();
    }
  };

  const removeSub = async (id: string) => {
    const { error } = await atisDb.from("atis_series_subscribers").delete().eq("id", id);
    if (error) toast.error(error.message); else load();
  };

  const toggleActive = async (s: Subscriber) => {
    const { error } = await atisDb.from("atis_series_subscribers").update({ active: !s.active }).eq("id", s.id);
    if (error) toast.error(error.message); else load();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-3">
      <div className="bg-[hsl(var(--dark-card))] rounded-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-[hsl(var(--dark-card))] p-4 border-b border-[hsl(var(--dark-bg))] flex items-center justify-between">
          <div>
            <p className="font-bold">Inscritos — {series.name}</p>
            <p className="text-xs text-[hsl(var(--dark-muted))]">{subs.length} total</p>
          </div>
          <button onClick={onClose}><X className="w-5 h-5" /></button>
        </div>

        <div className="p-4 space-y-4">
          <div className="bg-[hsl(var(--dark-bg))] rounded-xl p-3 space-y-2">
            <p className="text-xs font-bold uppercase tracking-wide text-[hsl(var(--dark-muted))]">Adicionar</p>
            <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
              {contacts.map((c) => (
                <label key={c.id} className="flex items-center gap-2 text-sm p-1.5 rounded hover:bg-[hsl(var(--dark-card))] cursor-pointer">
                  <input type="checkbox" checked={!!selected[c.id]} onChange={(e) => setSelected({ ...selected, [c.id]: e.target.checked })} />
                  <span className="flex-1 truncate">{c.name}</span>
                  <span className="text-[10px] text-[hsl(var(--dark-muted))]">{c.phone}</span>
                </label>
              ))}
            </div>
            <div className="flex gap-2 pt-1">
              <input className="input-atis flex-1" placeholder="Nome (opcional)" value={manualName} onChange={(e) => setManualName(e.target.value)} />
              <input className="input-atis flex-1" placeholder="55859..." value={manualPhone} onChange={(e) => setManualPhone(e.target.value)} inputMode="tel" />
            </div>
            <button onClick={addSelected} className="w-full h-9 rounded-xl bg-primary text-primary-foreground font-semibold text-xs inline-flex items-center justify-center gap-1"><UserPlus className="w-3.5 h-3.5" /> Adicionar</button>
          </div>

          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-[hsl(var(--dark-muted))] mb-2">Inscritos ativos</p>
            {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> :
              !subs.length ? <p className="text-xs text-[hsl(var(--dark-muted))] text-center py-4">Ninguém inscrito ainda.</p> :
              <div className="space-y-1.5">
                {subs.map((s) => (
                  <div key={s.id} className="flex items-center gap-2 bg-[hsl(var(--dark-bg))] rounded-lg p-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold truncate">{s.name ?? s.phone}</p>
                      <p className="text-[10px] text-[hsl(var(--dark-muted))]">Dia {s.current_day} · {s.phone}</p>
                    </div>
                    <button onClick={() => toggleActive(s)} className={`text-[10px] px-2 py-1 rounded ${s.active ? "bg-green-500/20 text-green-400" : "bg-[hsl(var(--dark-card))] text-[hsl(var(--dark-muted))]"}`}>{s.active ? "ativo" : "pausado"}</button>
                    <button onClick={() => removeSub(s.id)} className="text-red-400 p-1"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                ))}
              </div>}
          </div>
        </div>
      </div>
      <style>{`.input-atis{height:36px;padding:0 10px;border-radius:8px;background:hsl(var(--dark-card));color:hsl(var(--dark-text));border:1px solid hsl(var(--dark-card-hover));font-size:12px}`}</style>
    </div>
  );
};

export default AtisSeries;