import { useEffect, useState } from "react";
import { atisDb } from "./atisDb";
import { toast } from "sonner";
import { Loader2, Users, X, UserPlus, Trash2, BookOpen } from "lucide-react";

type Plan = { id: string; title: string; description: string | null; total_days: number | null; is_active: boolean };
type Sub = { id: string; plan_id: string; phone: string; name: string | null; current_day: number; send_time: string; active: boolean; last_sent_date: string | null };

const AtisPlansWA = () => {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [subsFor, setSubsFor] = useState<Plan | null>(null);

  const load = async () => {
    setLoading(true);
    const [{ data: p }, { data: s }] = await Promise.all([
      atisDb.from("admin_plans").select("id,title,description,total_days,is_active").eq("is_active", true).order("sort_order"),
      atisDb.from("atis_plan_subscribers").select("plan_id,active"),
    ]);
    setPlans((p as Plan[]) ?? []);
    const c: Record<string, number> = {};
    for (const row of (s as any[]) ?? []) if (row.active) c[row.plan_id] = (c[row.plan_id] ?? 0) + 1;
    setCounts(c);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold">Planos no WhatsApp</h2>
        <p className="text-sm text-[hsl(var(--dark-muted))]">Inscritos recebem a leitura do dia via mensagem direta.</p>
      </div>

      {loading ? <Loader2 className="w-6 h-6 animate-spin mx-auto mt-8 text-primary" /> :
        !plans.length ? (
          <div className="bg-[hsl(var(--dark-card))] rounded-2xl p-8 text-center">
            <BookOpen className="w-10 h-10 text-[hsl(var(--dark-muted))] mx-auto mb-2" />
            <p className="text-sm text-[hsl(var(--dark-muted))]">Nenhum plano ativo. Cadastre planos no painel do admin.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {plans.map((p) => (
              <div key={p.id} className="bg-[hsl(var(--dark-card))] rounded-2xl p-4 flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-bold truncate">{p.title}</p>
                  {p.description && <p className="text-xs text-[hsl(var(--dark-muted))] mt-0.5 line-clamp-2">{p.description}</p>}
                  <p className="text-[11px] text-[hsl(var(--dark-muted))] mt-1">
                    {p.total_days ? `${p.total_days} dias` : "Sem duração definida"} · <span className="text-primary font-semibold">{counts[p.id] ?? 0} inscritos</span>
                  </p>
                </div>
                <button onClick={() => setSubsFor(p)} className="inline-flex items-center gap-1 bg-primary/20 text-primary rounded-lg px-2.5 py-1.5 text-xs font-semibold">
                  <Users className="w-3.5 h-3.5" /> Inscritos
                </button>
              </div>
            ))}
          </div>
        )}

      {subsFor && <PlanSubs plan={subsFor} onClose={() => { setSubsFor(null); load(); }} />}
    </div>
  );
};

const PlanSubs = ({ plan, onClose }: { plan: Plan; onClose: () => void }) => {
  const [subs, setSubs] = useState<Sub[]>([]);
  const [loading, setLoading] = useState(true);
  const [contacts, setContacts] = useState<Array<{ id: string; name: string; phone: string }>>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [manualPhone, setManualPhone] = useState("");
  const [manualName, setManualName] = useState("");
  const [time, setTime] = useState("07:00");

  const load = async () => {
    setLoading(true);
    const [{ data: s }, { data: c }] = await Promise.all([
      atisDb.from("atis_plan_subscribers").select("*").eq("plan_id", plan.id).order("created_at", { ascending: false }),
      atisDb.from("atis_contacts").select("id,name,phone").eq("opt_in", true).order("name"),
    ]);
    setSubs((s as Sub[]) ?? []); setContacts((c as any) ?? []); setLoading(false);
  };
  useEffect(() => { load(); }, [plan.id]);

  const add = async () => {
    const chosen = contacts.filter((c) => selected[c.id]);
    const rows: any[] = chosen.map((c) => ({ plan_id: plan.id, phone: c.phone.replace(/\D/g, ""), name: c.name, contact_id: c.id, send_time: time }));
    if (manualPhone) {
      const ph = manualPhone.replace(/\D/g, "");
      if (ph.length >= 10) rows.push({ plan_id: plan.id, phone: ph, name: manualName || null, send_time: time });
    }
    if (!rows.length) return;
    const { error } = await atisDb.from("atis_plan_subscribers").upsert(rows, { onConflict: "plan_id,phone" });
    if (error) toast.error(error.message);
    else { toast.success(`${rows.length} inscrito(s)`); setSelected({}); setManualPhone(""); setManualName(""); load(); }
  };

  const remove = async (id: string) => {
    const { error } = await atisDb.from("atis_plan_subscribers").delete().eq("id", id);
    if (error) toast.error(error.message); else load();
  };
  const toggle = async (s: Sub) => {
    await atisDb.from("atis_plan_subscribers").update({ active: !s.active }).eq("id", s.id);
    load();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-3">
      <div className="bg-[hsl(var(--dark-card))] rounded-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-[hsl(var(--dark-card))] p-4 border-b border-[hsl(var(--dark-bg))] flex items-center justify-between">
          <div>
            <p className="font-bold truncate">{plan.title}</p>
            <p className="text-xs text-[hsl(var(--dark-muted))]">{subs.length} inscritos</p>
          </div>
          <button onClick={onClose}><X className="w-5 h-5" /></button>
        </div>

        <div className="p-4 space-y-4">
          <div className="bg-[hsl(var(--dark-bg))] rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-wide text-[hsl(var(--dark-muted))]">Adicionar</p>
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-[hsl(var(--dark-muted))]">Horário</span>
                <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="bg-[hsl(var(--dark-card))] rounded px-2 py-1 text-[11px]" />
              </div>
            </div>
            <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
              {contacts.map((c) => (
                <label key={c.id} className="flex items-center gap-2 text-sm p-1.5 rounded hover:bg-[hsl(var(--dark-card))] cursor-pointer">
                  <input type="checkbox" checked={!!selected[c.id]} onChange={(e) => setSelected({ ...selected, [c.id]: e.target.checked })} />
                  <span className="flex-1 truncate">{c.name}</span>
                  <span className="text-[10px] text-[hsl(var(--dark-muted))]">{c.phone}</span>
                </label>
              ))}
            </div>
            <div className="flex gap-2">
              <input placeholder="Nome" value={manualName} onChange={(e) => setManualName(e.target.value)} className="flex-1 h-9 rounded bg-[hsl(var(--dark-card))] px-2 text-xs" />
              <input placeholder="55859..." value={manualPhone} onChange={(e) => setManualPhone(e.target.value)} inputMode="tel" className="flex-1 h-9 rounded bg-[hsl(var(--dark-card))] px-2 text-xs" />
            </div>
            <button onClick={add} className="w-full h-9 rounded-xl bg-primary text-primary-foreground font-semibold text-xs inline-flex items-center justify-center gap-1"><UserPlus className="w-3.5 h-3.5" /> Adicionar</button>
          </div>

          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-[hsl(var(--dark-muted))] mb-2">Inscritos</p>
            {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> :
              !subs.length ? <p className="text-xs text-[hsl(var(--dark-muted))] text-center py-4">Ninguém inscrito.</p> :
              <div className="space-y-1.5">
                {subs.map((s) => (
                  <div key={s.id} className="flex items-center gap-2 bg-[hsl(var(--dark-bg))] rounded-lg p-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold truncate">{s.name ?? s.phone}</p>
                      <p className="text-[10px] text-[hsl(var(--dark-muted))]">Dia {s.current_day} · {s.send_time} · {s.phone}</p>
                    </div>
                    <button onClick={() => toggle(s)} className={`text-[10px] px-2 py-1 rounded ${s.active ? "bg-green-500/20 text-green-400" : "bg-[hsl(var(--dark-card))] text-[hsl(var(--dark-muted))]"}`}>{s.active ? "ativo" : "pausado"}</button>
                    <button onClick={() => remove(s.id)} className="text-red-400 p-1"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                ))}
              </div>}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AtisPlansWA;