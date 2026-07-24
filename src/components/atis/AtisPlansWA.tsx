import { useEffect, useState } from "react";
import { atisDb } from "./atisDb";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Users, X, UserPlus, Trash2, BookOpen, Send, RefreshCw } from "lucide-react";

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
  const [busyId, setBusyId] = useState<string | null>(null);
  const totalDays = plan.total_days ?? null;

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

  const patchSub = async (id: string, patch: Partial<Sub>) => {
    const prev = subs;
    setSubs((cur) => cur.map((s) => (s.id === id ? { ...s, ...patch } : s)));
    const { error } = await atisDb.from("atis_plan_subscribers").update(patch).eq("id", id);
    if (error) { setSubs(prev); toast.error(error.message); }
  };

  const sendNow = async (s: Sub) => {
    setBusyId(s.id);
    try {
      const { data, error } = await supabase.functions.invoke("atis-plans-runner", {
        method: "POST",
        // encode sub id in URL via body-less GET-style path
      } as any);
      // fallback: call via fetch to preserve query params
      const url = `https://hvdmobypsqksgkfrzhzf.supabase.co/functions/v1/atis-plans-runner?sub=${s.id}`;
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token;
      const res = await fetch(url, { method: "POST", headers: token ? { Authorization: `Bearer ${token}` } : {} });
      const j = await res.json().catch(() => null);
      if (!res.ok) throw new Error(j?.error || `HTTP ${res.status}`);
      const r = (j?.results ?? [])[0];
      if (r?.ok) toast.success(`Dia ${r.day} enviado (${r.parts} msg)`);
      else toast.error("Falha ao enviar");
      load();
      void data; void error;
    } catch (e: any) {
      toast.error("Erro: " + (e?.message ?? e));
    } finally { setBusyId(null); }
  };

  const resendToday = async (s: Sub) => {
    await patchSub(s.id, { last_sent_date: null } as any);
    await sendNow(s);
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-3 pb-[calc(env(safe-area-inset-bottom)+5rem)] sm:pb-3">
      <div className="bg-[hsl(var(--dark-card))] rounded-2xl w-full max-w-xl max-h-[85vh] sm:max-h-[90vh] overflow-y-auto overscroll-contain">
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
              <div className="space-y-2">
                {subs.map((s) => {
                  const pct = totalDays ? Math.min(100, Math.round(((s.current_day - 1) / totalDays) * 100)) : 0;
                  return (
                    <div key={s.id} className="bg-[hsl(var(--dark-bg))] rounded-lg p-2.5 space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold truncate">{s.name ?? s.phone}</p>
                          <p className="text-[10px] text-[hsl(var(--dark-muted))]">
                            {s.phone} {s.last_sent_date ? `· último: ${s.last_sent_date}` : "· nunca enviado"}
                          </p>
                        </div>
                        <button onClick={() => toggle(s)} className={`text-[10px] px-2 py-1 rounded ${s.active ? "bg-green-500/20 text-green-400" : "bg-[hsl(var(--dark-card))] text-[hsl(var(--dark-muted))]"}`}>{s.active ? "ativo" : "pausado"}</button>
                        <button onClick={() => remove(s.id)} className="text-red-400 p-1" title="Remover"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>

                      {totalDays && (
                        <div className="h-1.5 rounded-full bg-[hsl(var(--dark-card))] overflow-hidden">
                          <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-2">
                        <label className="flex flex-col gap-0.5">
                          <span className="text-[9px] uppercase tracking-wide text-[hsl(var(--dark-muted))]">Dia atual{totalDays ? ` / ${totalDays}` : ""}</span>
                          <input
                            type="number" min={1} max={totalDays ?? undefined}
                            value={s.current_day}
                            onChange={(e) => {
                              const v = Math.max(1, parseInt(e.target.value || "1", 10));
                              patchSub(s.id, { current_day: v });
                            }}
                            className="h-8 rounded bg-[hsl(var(--dark-card))] px-2 text-xs"
                          />
                        </label>
                        <label className="flex flex-col gap-0.5">
                          <span className="text-[9px] uppercase tracking-wide text-[hsl(var(--dark-muted))]">Horário (Fortaleza)</span>
                          <input
                            type="time"
                            value={s.send_time}
                            onChange={(e) => patchSub(s.id, { send_time: e.target.value })}
                            className="h-8 rounded bg-[hsl(var(--dark-card))] px-2 text-xs"
                          />
                        </label>
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={() => sendNow(s)}
                          disabled={busyId === s.id}
                          className="flex-1 h-8 rounded-lg bg-primary text-primary-foreground text-[11px] font-semibold inline-flex items-center justify-center gap-1 disabled:opacity-60"
                        >
                          {busyId === s.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />} Enviar dia {s.current_day}
                        </button>
                        {s.last_sent_date && (
                          <button
                            onClick={() => resendToday(s)}
                            disabled={busyId === s.id}
                            className="h-8 px-2 rounded-lg bg-[hsl(var(--dark-card))] text-[hsl(var(--dark-muted))] text-[11px] font-semibold inline-flex items-center gap-1"
                            title="Reenviar (limpa último envio)"
                          >
                            <RefreshCw className="w-3 h-3" /> Reenviar
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AtisPlansWA;