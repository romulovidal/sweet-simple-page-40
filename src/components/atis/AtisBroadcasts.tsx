import { useEffect, useMemo, useState } from "react";
import { atisDb } from "./atisDb";
import { toast } from "sonner";
import { Plus, Trash2, Loader2, CalendarClock, Sparkles, CheckCircle2, XCircle, Clock, AlertCircle } from "lucide-react";

type BC = { id: string; title: string; body: string; target_type: string; target_ref: string | null; scheduled_at: string | null; recurrence: string | null; status: string; content_type: string; created_at?: string };
type Group = { id: string; wa_group_id: string; name: string };

const PRESETS: { key: string; label: string; icon: string; apply: (base: string) => Partial<FormState> }[] = [
  {
    key: "verse",
    label: "Versículo do dia",
    icon: "📖",
    apply: () => ({ title: "Versículo do dia", body: "Bom dia, {nome}! 🌅\n\nO versículo de hoje:\n{versiculo_do_dia}\n\n_Que Deus abençoe seu dia._", content_type: "verse", recurrence: "daily", scheduled_at: nextTimeToday(6, 10) }),
  },
  {
    key: "culto",
    label: "Lembrete de culto",
    icon: "⛪",
    apply: () => ({ title: "Lembrete de culto", body: "Paz do Senhor, {nome}! 🙌\n\nHoje temos culto na igreja. Te esperamos com alegria!\n\n_Igreja Atalaia_", content_type: "text", recurrence: "weekly", scheduled_at: nextTimeToday(17, 0) }),
  },
  {
    key: "aniv",
    label: "Aniversariantes",
    icon: "🎂",
    apply: () => ({ title: "Aniversariantes do dia", body: "🎉 Aniversariantes de hoje:\n{aniversariantes_hoje}\n\nParabéns e muitas bênçãos!", content_type: "text", recurrence: "daily", scheduled_at: nextTimeToday(8, 0) }),
  },
  {
    key: "devo",
    label: "Devocional IA",
    icon: "✨",
    apply: () => ({ title: "Devocional do dia", body: "Bom dia! ☀️\nDevocional de hoje gerado pelo Atis:\n\n{devocional_ia}", content_type: "devotional", recurrence: "daily", scheduled_at: nextTimeToday(6, 30) }),
  },
];

type FormState = {
  title: string;
  body: string;
  target_type: string;
  target_ref: string;
  scheduled_at: string;
  recurrence: string;
  content_type: string;
};

const EMPTY: FormState = { title: "", body: "", target_type: "all", target_ref: "", scheduled_at: "", recurrence: "once", content_type: "text" };

function nextTimeToday(h: number, m: number) {
  const d = new Date();
  d.setHours(h, m, 0, 0);
  if (d < new Date()) d.setDate(d.getDate() + 1);
  // datetime-local input expects local time formatted without timezone
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const STATUS_META: Record<string, { label: string; color: string; icon: any }> = {
  pending: { label: "Pendente", color: "text-yellow-500 bg-yellow-500/10", icon: Clock },
  scheduled: { label: "Agendado", color: "text-blue-400 bg-blue-500/10", icon: CalendarClock },
  sent: { label: "Enviado", color: "text-green-500 bg-green-500/10", icon: CheckCircle2 },
  failed: { label: "Falhou", color: "text-red-500 bg-red-500/10", icon: XCircle },
  cancelled: { label: "Cancelado", color: "text-[hsl(var(--dark-muted))] bg-[hsl(var(--dark-card-hover))]", icon: AlertCircle },
};

const AtisBroadcasts = () => {
  const [items, setItems] = useState<BC[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [filter, setFilter] = useState<string>("all");

  const load = async () => {
    setLoading(true);
    const [b, g] = await Promise.all([
      atisDb.from("atis_broadcasts").select("*").order("scheduled_at", { ascending: true, nullsFirst: false }),
      atisDb.from("atis_groups").select("id,wa_group_id,name").eq("active", true).order("name"),
    ]);
    setItems((b.data ?? []) as BC[]);
    setGroups((g.data ?? []) as Group[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    if (filter === "all") return items;
    return items.filter((i) => i.status === filter);
  }, [items, filter]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: items.length };
    for (const i of items) c[i.status] = (c[i.status] ?? 0) + 1;
    return c;
  }, [items]);

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
      status: form.scheduled_at ? "scheduled" : "pending",
    };
    const { error } = await atisDb.from("atis_broadcasts").insert(payload);
    if (error) toast.error(error.message);
    else { toast.success(form.scheduled_at ? "Envio agendado" : "Envio criado"); setForm(EMPTY); load(); }
  };

  const applyPreset = (p: typeof PRESETS[number]) => {
    setForm({ ...EMPTY, ...p.apply("") } as FormState);
    toast.success(`Modelo "${p.label}" carregado — ajuste e salve`);
  };

  const remove = async (id: string) => {
    if (!confirm("Cancelar/remover envio?")) return;
    await atisDb.from("atis_broadcasts").delete().eq("id", id);
    load();
  };

  const showRef = form.target_type !== "all" && form.target_type !== "group";

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-[hsl(var(--dark-card))] p-4 space-y-3">
        <p className="text-sm font-bold flex items-center gap-2"><Sparkles className="w-4 h-4 text-primary" /> Modelos rápidos</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {PRESETS.map((p) => (
            <button key={p.key} onClick={() => applyPreset(p)} className="rounded-xl bg-[hsl(var(--dark-bg))] hover:bg-[hsl(var(--dark-card-hover))] p-3 text-left transition-colors">
              <p className="text-lg leading-none">{p.icon}</p>
              <p className="text-xs font-semibold mt-1.5">{p.label}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-2xl bg-[hsl(var(--dark-card))] p-4 space-y-3">
        <p className="text-sm font-bold flex items-center gap-2"><Plus className="w-4 h-4" /> Novo envio</p>
        <input className="input" placeholder="Título interno" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
        <textarea className="input" style={{ height: 100, padding: 10 }} placeholder="Mensagem (use {nome}, {versiculo_do_dia}, {aniversariantes_hoje}, {devocional_ia})" value={form.body} onChange={e => setForm({ ...form, body: e.target.value })} />

        <div className="grid md:grid-cols-3 gap-2">
          <div>
            <label className="text-[10px] font-semibold text-[hsl(var(--dark-muted))] uppercase">Destino</label>
            <select className="input" value={form.target_type} onChange={e => setForm({ ...form, target_type: e.target.value, target_ref: "" })}>
              <option value="all">Todos os contatos</option>
              <option value="group">Grupo</option>
              <option value="tag">Por tag</option>
              <option value="contact">Contato específico</option>
            </select>
          </div>
          {form.target_type === "group" ? (
            <div>
              <label className="text-[10px] font-semibold text-[hsl(var(--dark-muted))] uppercase">Grupo</label>
              <select className="input" value={form.target_ref} onChange={e => setForm({ ...form, target_ref: e.target.value })}>
                <option value="">— selecione —</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.wa_group_id}>{g.name}</option>
                ))}
              </select>
            </div>
          ) : showRef ? (
            <div>
              <label className="text-[10px] font-semibold text-[hsl(var(--dark-muted))] uppercase">Referência</label>
              <input className="input" placeholder={form.target_type === "tag" ? "ex: membros" : "telefone com DDD"} value={form.target_ref} onChange={e => setForm({ ...form, target_ref: e.target.value })} />
            </div>
          ) : (
            <div>
              <label className="text-[10px] font-semibold text-[hsl(var(--dark-muted))] uppercase">Contatos</label>
              <div className="input flex items-center text-[hsl(var(--dark-muted))]">Todos ativos</div>
            </div>
          )}
          <div>
            <label className="text-[10px] font-semibold text-[hsl(var(--dark-muted))] uppercase">Tipo de conteúdo</label>
            <select className="input" value={form.content_type} onChange={e => setForm({ ...form, content_type: e.target.value })}>
              <option value="text">Texto</option>
              <option value="verse">Versículo</option>
              <option value="hino">Hino Harpa</option>
              <option value="study">Estudo</option>
              <option value="devotional">Devocional</option>
            </select>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] font-semibold text-[hsl(var(--dark-muted))] uppercase">Quando (Fortaleza-CE)</label>
            <input className="input" type="datetime-local" value={form.scheduled_at} onChange={e => setForm({ ...form, scheduled_at: e.target.value })} />
          </div>
          <div>
            <label className="text-[10px] font-semibold text-[hsl(var(--dark-muted))] uppercase">Recorrência</label>
            <select className="input" value={form.recurrence} onChange={e => setForm({ ...form, recurrence: e.target.value })}>
              <option value="once">Uma vez</option>
              <option value="daily">Diário</option>
              <option value="weekly">Semanal</option>
              <option value="monthly">Mensal</option>
            </select>
          </div>
        </div>

        <button onClick={add} className="w-full h-11 rounded-xl bg-primary text-primary-foreground font-semibold text-sm">
          {form.scheduled_at ? "Agendar envio" : "Salvar envio"}
        </button>
      </div>

      <div className="rounded-2xl bg-[hsl(var(--dark-card))] p-4">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-2 -mx-1 px-1">
          {["all", "pending", "scheduled", "sent", "failed", "cancelled"].map((k) => {
            const meta = k === "all" ? { label: "Todos", color: "text-[hsl(var(--dark-text))] bg-[hsl(var(--dark-card-hover))]" } : STATUS_META[k];
            return (
              <button key={k} onClick={() => setFilter(k)}
                className={`shrink-0 text-[11px] font-semibold px-2.5 py-1 rounded-full transition-colors ${filter === k ? "bg-primary text-primary-foreground" : meta.color}`}>
                {meta.label} · {counts[k] ?? 0}
              </button>
            );
          })}
        </div>

        {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto my-4" /> : filtered.length === 0 ? (
          <p className="text-center text-sm text-[hsl(var(--dark-muted))] py-6">Nenhum envio nessa categoria</p>
        ) : (
          <ul className="divide-y divide-[hsl(var(--dark-card-hover))]">
            {filtered.map(b => {
              const meta = STATUS_META[b.status] ?? STATUS_META.pending;
              const StatusIcon = meta.icon;
              const groupName = b.target_type === "group" && b.target_ref ? (groups.find(g => g.wa_group_id === b.target_ref)?.name ?? b.target_ref) : null;
              return (
                <li key={b.id} className="py-3 flex items-start gap-3">
                  <span className={`w-9 h-9 rounded-full grid place-items-center mt-0.5 ${meta.color}`}><StatusIcon className="w-4 h-4" /></span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold truncate">{b.title}</p>
                      <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${meta.color}`}>{meta.label}</span>
                    </div>
                    <p className="text-xs text-[hsl(var(--dark-muted))] line-clamp-2 mt-0.5">{b.body}</p>
                    <p className="text-[10px] text-[hsl(var(--dark-muted))] mt-1">
                      {b.scheduled_at ? new Date(b.scheduled_at).toLocaleString("pt-BR", { timeZone: "America/Fortaleza" }) : "sem data"} · {b.recurrence ?? "once"} · {groupName ? `grupo: ${groupName}` : b.target_type}{!groupName && b.target_ref ? ` (${b.target_ref})` : ""}
                    </p>
                  </div>
                  <button onClick={() => remove(b.id)} className="p-1.5 text-destructive hover:bg-destructive/10 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <style>{`.input{width:100%;height:42px;padding:0 12px;border-radius:12px;background:hsl(var(--dark-bg));color:hsl(var(--dark-text));border:1px solid hsl(var(--dark-card-hover));font-size:14px}`}</style>
    </div>
  );
};

export default AtisBroadcasts;