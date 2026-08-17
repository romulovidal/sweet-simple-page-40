from pathlib import Path


def replace_once(path: str, old: str, new: str):
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f"Expected block not found in {path}: {old[:160]!r}")
    p.write_text(text.replace(old, new, 1))


# 1) Add daily devotional as a schedulable ATIS automation for every destination.
path = "supabase/functions/atis-destination-settings/index.ts"
replace_once(path, '''const AUTOMATION_CATALOG: CatalogItem[] = [
  {
    kind: "automation",
    key: "birthdays",
    label: "Aniversariantes do dia",
    description: "Envia ao grupo a mensagem com os aniversariantes cadastrados para aquele dia.",
    destinations: ["group"],
    systemBehavior: "O padrão atual do ATIS é enviar assim que o aniversário do dia for detectado.",
  },
];''', '''const AUTOMATION_CATALOG: CatalogItem[] = [
  {
    kind: "automation",
    key: "daily_devotional",
    label: "Reflexão devocional diária",
    description: "Gera uma reflexão a partir do Versículo do Dia já existente no app e envia pelo WhatsApp.",
    systemBehavior: "Segue o horário padrão do Versículo do Dia configurado no app.",
  },
  {
    kind: "automation",
    key: "birthdays",
    label: "Aniversariantes do dia",
    description: "Envia ao grupo a mensagem com os aniversariantes cadastrados para aquele dia.",
    destinations: ["group"],
    systemBehavior: "Envia assim que o aniversário do dia for detectado.",
  },
];''')

# 2) Destination settings: mobile-first bottom sheet and clearer automation wording.
path = "src/components/admin/atis/AtisDestinationSettings.tsx"
replace_once(path,
'''    <div className="fixed inset-0 z-[90] bg-black/70 backdrop-blur-sm px-3 py-5 sm:px-4 sm:py-8 overflow-y-auto">
      <div className="w-full max-w-2xl mx-auto rounded-2xl bg-[hsl(var(--dark-card))] border border-[hsl(var(--dark-card-hover))] shadow-2xl overflow-hidden">''',
'''    <div className="fixed inset-0 z-[90] bg-black/70 backdrop-blur-sm flex items-end sm:items-start sm:justify-center sm:px-4 sm:py-8 overflow-hidden">
      <div className="w-full max-w-2xl max-h-[92dvh] sm:max-h-[calc(100vh-4rem)] overflow-y-auto rounded-t-3xl sm:rounded-2xl bg-[hsl(var(--dark-card))] border border-[hsl(var(--dark-card-hover))] shadow-2xl">''')
replace_once(path,
'''            {renderScheduledSection("Automações ATIS", "Automações próprias do ATIS também obedecem ativação e horário por destinatário.", automations, "cake")}''',
'''            {renderScheduledSection("Conteúdos e automações ATIS", "Conteúdos automáticos do ATIS também têm ativação e horário exclusivos para este destinatário. A Reflexão Devocional usa o Versículo do Dia e o motor devocional já existentes no app.", automations, "cake")}''')

# 3) Dashboard: allow route-driven connection view and hide local tabs on mobile.
path = "src/components/admin/atis/AdminAtis.tsx"
replace_once(path,
'''const AdminAtis = () => {
  const navigate = useNavigate();
  const [view, setView] = useState<"overview" | "connection">("overview");''',
'''type AdminAtisProps = { initialView?: "overview" | "connection" };

const AdminAtis = ({ initialView = "overview" }: AdminAtisProps) => {
  const navigate = useNavigate();
  const [view, setView] = useState<"overview" | "connection">(initialView);''')
replace_once(path,
'''  useEffect(() => { mounted.current = true; void load(); return () => { mounted.current = false; }; }, [load]);''',
'''  useEffect(() => { mounted.current = true; void load(); return () => { mounted.current = false; }; }, [load]);
  useEffect(() => { setView(initialView); }, [initialView]);''')
replace_once(path,
'''    setInstance(result.instance); setQr(result.connection?.qr ?? null); setPairingCode(result.connection?.pairing_code ?? null); setView("connection");''',
'''    setInstance(result.instance); setQr(result.connection?.qr ?? null); setPairingCode(result.connection?.pairing_code ?? null); setView("connection"); navigate("/atis/conexao");''')
replace_once(path,
'''      <div className="flex gap-2">
        <button onClick={() => setView("overview")}''',
'''      <div className="hidden md:flex gap-2">
        <button onClick={() => setView("overview")}''')
replace_once(path,
'''      <div className="rounded-2xl p-5 bg-gradient-to-br''',
'''      <div className="rounded-2xl p-4 sm:p-5 bg-gradient-to-br''')

# 4) Standalone ATIS shell: mobile bottom navigation, desktop top navigation.
Path("src/pages/AtisPage.tsx").write_text(r'''import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Cake,
  ContactRound,
  History,
  LayoutDashboard,
  Loader2,
  MessageCircle,
  MoreHorizontal,
  Send,
  ShieldAlert,
  Smartphone,
  WandSparkles,
  X,
} from "lucide-react";
import AdminAtis from "@/components/admin/atis/AdminAtis";
import AtisRecipients from "@/components/admin/atis/AtisRecipients";
import AtisBirthdays from "@/components/admin/atis/AtisBirthdays";
import { useAuth } from "@/hooks/useAuth";
import { useIsAdmin } from "@/hooks/useIsAdmin";

const AtisPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: roleLoading } = useIsAdmin();
  const [moreOpen, setMoreOpen] = useState(false);

  const recipients = location.pathname.startsWith("/atis/destinatarios");
  const birthdays = location.pathname.startsWith("/atis/aniversariantes");
  const connection = location.pathname.startsWith("/atis/conexao");
  const dashboard = location.pathname === "/atis";

  useEffect(() => {
    setMoreOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!authLoading && !user) navigate("/admin", { replace: true });
  }, [authLoading, user, navigate]);

  if (authLoading || roleLoading || !user) {
    return (
      <div className="min-h-screen bg-[hsl(var(--dark-bg))] flex items-center justify-center px-5">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
          <p className="text-sm text-[hsl(var(--dark-muted))] mt-3">Validando acesso ao ATIS...</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-[hsl(var(--dark-bg))] flex items-center justify-center px-5">
        <div className="w-full max-w-sm rounded-2xl bg-[hsl(var(--dark-card))] border border-[hsl(var(--dark-card-hover))] p-6 text-center">
          <span className="w-14 h-14 mx-auto rounded-2xl grid place-items-center bg-destructive/10 text-destructive"><ShieldAlert className="w-7 h-7" /></span>
          <h1 className="text-lg font-bold text-[hsl(var(--dark-text))] mt-4">Acesso restrito</h1>
          <p className="text-sm text-[hsl(var(--dark-muted))] mt-2">O painel ATIS está disponível somente para administradores.</p>
          <button onClick={() => navigate("/admin", { replace: true })} className="mt-5 h-11 px-5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold">Voltar ao Admin</button>
        </div>
      </div>
    );
  }

  const navButton = (active: boolean) => active
    ? "text-primary"
    : "text-[hsl(var(--dark-muted))]";

  return (
    <div className="min-h-screen bg-[hsl(var(--dark-bg))] text-[hsl(var(--dark-text))]">
      <header className="sticky top-0 z-40 bg-[hsl(var(--dark-bg))]/95 backdrop-blur-xl border-b border-[hsl(var(--dark-card))]">
        <div className="max-w-5xl mx-auto px-3 sm:px-6 h-15 min-h-[60px] flex items-center gap-3">
          <button onClick={() => navigate("/admin")} aria-label="Voltar ao painel administrativo" className="w-10 h-10 rounded-2xl grid place-items-center bg-[hsl(var(--dark-card))] active:scale-95 hover:bg-[hsl(var(--dark-card-hover))] text-[hsl(var(--dark-text))] transition shrink-0">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <span className="w-10 h-10 rounded-2xl grid place-items-center bg-primary/15 text-primary shrink-0"><MessageCircle className="w-5 h-5" /></span>
          <div className="min-w-0 flex-1">
            <p className="text-[9px] uppercase tracking-[0.18em] text-[hsl(var(--dark-muted))]">Painel independente</p>
            <h1 className="text-sm sm:text-base font-bold truncate">ATIS WhatsApp</h1>
          </div>
          <button onClick={() => navigate("/admin")} className="hidden md:inline-flex h-9 items-center px-4 rounded-xl bg-[hsl(var(--dark-card))] hover:bg-[hsl(var(--dark-card-hover))] text-xs font-semibold transition-colors">Painel Admin</button>
        </div>

        <div className="hidden md:flex max-w-5xl mx-auto px-6 pb-3 gap-2 overflow-x-auto">
          <button onClick={() => navigate("/atis")} className={`h-9 px-4 rounded-xl shrink-0 text-xs font-bold flex items-center gap-2 ${dashboard ? "bg-primary text-primary-foreground" : "bg-[hsl(var(--dark-card))] text-[hsl(var(--dark-muted))]"}`}><LayoutDashboard className="w-4 h-4" /> Painel</button>
          <button onClick={() => navigate("/atis/destinatarios")} className={`h-9 px-4 rounded-xl shrink-0 text-xs font-bold flex items-center gap-2 ${recipients ? "bg-primary text-primary-foreground" : "bg-[hsl(var(--dark-card))] text-[hsl(var(--dark-muted))]"}`}><ContactRound className="w-4 h-4" /> Destinatários</button>
          <button onClick={() => navigate("/atis/aniversariantes")} className={`h-9 px-4 rounded-xl shrink-0 text-xs font-bold flex items-center gap-2 ${birthdays ? "bg-primary text-primary-foreground" : "bg-[hsl(var(--dark-card))] text-[hsl(var(--dark-muted))]"}`}><Cake className="w-4 h-4" /> Aniversariantes</button>
          <button onClick={() => navigate("/atis/conexao")} className={`h-9 px-4 rounded-xl shrink-0 text-xs font-bold flex items-center gap-2 ${connection ? "bg-primary text-primary-foreground" : "bg-[hsl(var(--dark-card))] text-[hsl(var(--dark-muted))]"}`}><Smartphone className="w-4 h-4" /> Conexão</button>
          <span className="h-9 px-4 rounded-xl shrink-0 grid place-items-center text-xs font-semibold bg-[hsl(var(--dark-card))]/60 text-[hsl(var(--dark-muted))]/50">Enviar</span>
          <span className="h-9 px-4 rounded-xl shrink-0 grid place-items-center text-xs font-semibold bg-[hsl(var(--dark-card))]/60 text-[hsl(var(--dark-muted))]/50">Automações</span>
          <span className="h-9 px-4 rounded-xl shrink-0 grid place-items-center text-xs font-semibold bg-[hsl(var(--dark-card))]/60 text-[hsl(var(--dark-muted))]/50">Histórico</span>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-3 sm:px-6 py-4 sm:py-7 pb-[calc(6.5rem+env(safe-area-inset-bottom))] md:pb-10">
        {recipients ? <AtisRecipients /> : birthdays ? <AtisBirthdays /> : connection ? <AdminAtis initialView="connection" /> : <AdminAtis initialView="overview" />}
      </main>

      {moreOpen && (
        <div className="md:hidden fixed inset-0 z-[55] bg-black/55 backdrop-blur-[2px]" onClick={() => setMoreOpen(false)}>
          <div className="absolute left-3 right-3 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] rounded-3xl bg-[hsl(var(--dark-card))] border border-[hsl(var(--dark-card-hover))] shadow-2xl p-3" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between px-2 py-1.5">
              <div><p className="text-[10px] uppercase tracking-[0.18em] text-primary">ATIS</p><p className="text-sm font-bold mt-0.5">Mais opções</p></div>
              <button onClick={() => setMoreOpen(false)} className="w-9 h-9 rounded-xl grid place-items-center bg-[hsl(var(--dark-bg))] text-[hsl(var(--dark-muted))]"><X className="w-4 h-4" /></button>
            </div>
            <div className="grid grid-cols-3 gap-2 mt-2">
              {[
                ["Enviar", Send, "Em breve"],
                ["Automações", WandSparkles, "Em breve"],
                ["Histórico", History, "Em breve"],
              ].map(([label, Icon, status]: any) => (
                <div key={label} className="rounded-2xl bg-[hsl(var(--dark-bg))] p-3 min-h-[92px] flex flex-col items-center justify-center text-center opacity-55">
                  <Icon className="w-5 h-5 text-primary" />
                  <p className="text-[11px] font-bold mt-2">{label}</p>
                  <p className="text-[9px] text-[hsl(var(--dark-muted))] mt-0.5">{status}</p>
                </div>
              ))}
            </div>
            <button onClick={() => navigate("/admin")} className="w-full h-11 mt-3 rounded-2xl bg-[hsl(var(--dark-bg))] text-xs font-semibold">Abrir Painel Admin</button>
          </div>
        </div>
      )}

      <nav className="md:hidden fixed bottom-0 inset-x-0 z-[60] bg-[hsl(var(--dark-card))]/96 backdrop-blur-xl border-t border-[hsl(var(--dark-card-hover))] pb-[env(safe-area-inset-bottom)] shadow-[0_-10px_30px_rgba(0,0,0,0.18)]">
        <div className="grid grid-cols-5 h-16 max-w-lg mx-auto px-1">
          <button onClick={() => navigate("/atis")} className={`flex flex-col items-center justify-center gap-1 active:scale-95 transition ${navButton(dashboard)}`} aria-current={dashboard ? "page" : undefined}><LayoutDashboard className="w-5 h-5" /><span className="text-[9px] font-bold">Painel</span></button>
          <button onClick={() => navigate("/atis/destinatarios")} className={`flex flex-col items-center justify-center gap-1 active:scale-95 transition ${navButton(recipients)}`} aria-current={recipients ? "page" : undefined}><ContactRound className="w-5 h-5" /><span className="text-[9px] font-bold">Destinos</span></button>
          <button onClick={() => navigate("/atis/aniversariantes")} className={`flex flex-col items-center justify-center gap-1 active:scale-95 transition ${navButton(birthdays)}`} aria-current={birthdays ? "page" : undefined}><Cake className="w-5 h-5" /><span className="text-[9px] font-bold">Anivers.</span></button>
          <button onClick={() => navigate("/atis/conexao")} className={`flex flex-col items-center justify-center gap-1 active:scale-95 transition ${navButton(connection)}`} aria-current={connection ? "page" : undefined}><Smartphone className="w-5 h-5" /><span className="text-[9px] font-bold">Conexão</span></button>
          <button onClick={() => setMoreOpen((value) => !value)} className={`flex flex-col items-center justify-center gap-1 active:scale-95 transition ${moreOpen ? "text-primary" : "text-[hsl(var(--dark-muted))]"}`} aria-expanded={moreOpen}><MoreHorizontal className="w-5 h-5" /><span className="text-[9px] font-bold">Mais</span></button>
        </div>
      </nav>
    </div>
  );
};

export default AtisPage;
''')

# 5) Route for connection section.
path = "src/App.tsx"
replace_once(path,
'''            <Route path="/atis/aniversariantes" element={<AtisPage />} />''',
'''            <Route path="/atis/aniversariantes" element={<AtisPage />} />
            <Route path="/atis/conexao" element={<AtisPage />} />''')

# 6) Generic scheduled content runner. Today it powers the daily devotional and is ready for future ATIS content.
Path("supabase/functions/atis-content-runner").mkdir(parents=True, exist_ok=True)
Path("supabase/functions/atis-content-runner/index.ts").write_text(r'''import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { validateAdminAuth } from "../_shared/auth-utils.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { runAtisAssistant } from "../_shared/atis/assistant.ts";

type Json = Record<string, any>;
type DestinationType = "contact" | "individual" | "group";

type Schedule = {
  id: string;
  destination_type: DestinationType;
  contact_id?: string | null;
  individual_id?: string | null;
  group_id?: string | null;
  schedule_mode: "system" | "instant" | "custom_time";
  custom_time?: string | null;
  timezone?: string | null;
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

function firstString(...values: unknown[]) {
  for (const value of values) if (typeof value === "string" && value.trim()) return value.trim();
  return null;
}

function localParts(date: Date, timeZone: string) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date).map((part) => [part.type, part.value]));
  const year = String(parts.year ?? "0000");
  const month = String(parts.month ?? "00");
  const day = String(parts.day ?? "00");
  const hour = String(parts.hour ?? "00").padStart(2, "0");
  const minute = String(parts.minute ?? "00").padStart(2, "0");
  return { dateKey: `${year}-${month}-${day}`, hhmm: `${hour}:${minute}` };
}

function clockFromSetting(value: unknown, fallback = "06:00") {
  let current: unknown = value;
  for (let i = 0; i < 4; i++) {
    if (typeof current !== "string") break;
    const clean = current.trim().replace(/^"|"$/g, "");
    const match = clean.match(/^([01]\d|2[0-3]):([0-5]\d)/);
    if (match) return `${match[1]}:${match[2]}`;
    try { current = JSON.parse(current); } catch { break; }
  }
  return fallback;
}

function scheduleClock(value: unknown) {
  const raw = firstString(value);
  const match = raw?.match(/^([01]\d|2[0-3]):([0-5]\d)/);
  return match ? `${match[1]}:${match[2]}` : null;
}

function isDue(schedule: Schedule, localTime: string, systemTime: string) {
  if (schedule.schedule_mode === "instant") return true;
  const target = schedule.schedule_mode === "custom_time" ? scheduleClock(schedule.custom_time) : systemTime;
  if (!target) return false;
  return localTime >= target;
}

async function loadDefaultInstance(supabase: any) {
  const { data, error } = await supabase.from("atis_instances").select("id,status").eq("status", "connected").order("created_at", { ascending: true }).limit(1).maybeSingle();
  if (error) throw error;
  return data?.id ?? null;
}

async function resolveDestination(supabase: any, schedule: Schedule, defaultInstanceId: string | null) {
  if (schedule.destination_type === "contact") {
    if (!schedule.contact_id) return null;
    const { data, error } = await supabase.from("atis_contacts").select("id,name,phone_e164,is_active,whatsapp_opt_in,blocked").eq("id", schedule.contact_id).maybeSingle();
    if (error) throw error;
    if (!data || !data.is_active || !data.whatsapp_opt_in || data.blocked || !data.phone_e164 || !defaultInstanceId) return null;
    return { instanceId: defaultInstanceId, targetType: "contact", targetKey: `contact:${data.id}`, contactId: data.id, individualId: null, groupId: null, phone: data.phone_e164, providerTargetId: null, name: data.name ?? data.phone_e164 };
  }
  if (schedule.destination_type === "individual") {
    if (!schedule.individual_id) return null;
    const { data, error } = await supabase.from("atis_individuals").select("id,name,phone_e164,is_active,allow_messages,blocked").eq("id", schedule.individual_id).maybeSingle();
    if (error) throw error;
    if (!data || !data.is_active || !data.allow_messages || data.blocked || !data.phone_e164 || !defaultInstanceId) return null;
    return { instanceId: defaultInstanceId, targetType: "individual", targetKey: `individual:${data.id}`, contactId: null, individualId: data.id, groupId: null, phone: data.phone_e164, providerTargetId: null, name: data.name ?? data.phone_e164 };
  }
  if (!schedule.group_id) return null;
  const { data, error } = await supabase.from("atis_groups").select("id,name,provider_group_id,instance_id,is_active,provider_exists,allow_automations").eq("id", schedule.group_id).maybeSingle();
  if (error) throw error;
  if (!data || !data.is_active || data.provider_exists === false || !data.allow_automations || !data.provider_group_id) return null;
  const instanceId = data.instance_id ?? defaultInstanceId;
  if (!instanceId) return null;
  return { instanceId, targetType: "group", targetKey: `group:${data.id}`, contactId: null, individualId: null, groupId: data.id, phone: null, providerTargetId: data.provider_group_id, name: data.name ?? "Grupo" };
}

async function dailyDevotionalContent(supabase: any, dateKey: string, verseRef: string) {
  const { data: cached, error: cacheError } = await supabase.from("atis_settings").select("value").eq("key", "daily_devotional_cache").maybeSingle();
  if (cacheError) throw cacheError;
  const value = cached?.value ?? {};
  if (value.date === dateKey && value.reference === verseRef && typeof value.content === "string" && value.content.trim()) {
    return value.content.trim();
  }

  const result = await runAtisAssistant(
    supabase,
    `Faça uma reflexão devocional curta e prática sobre ${verseRef}. Use o texto bíblico do aplicativo como fonte.`,
    { allowedAiRoutes: ["devotional"] },
  );
  if (result.route !== "devotional" || !result.text.trim()) throw new Error("DEVOTIONAL_GENERATION_FAILED");
  const content = `🌿 *Reflexão devocional*\n📖 *${verseRef}*\n\n${result.text.trim()}`;
  const { error } = await supabase.from("atis_settings").upsert({
    key: "daily_devotional_cache",
    value: { date: dateKey, reference: verseRef, content, generated_at: new Date().toISOString(), source: "current_daily_verse+atis_devotional" },
    description: "Cache diário da reflexão devocional do ATIS, gerada a partir do Versículo do Dia do app.",
  }, { onConflict: "key" });
  if (error) throw error;
  return content;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405);

  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!url || !serviceKey) return json({ error: "SERVER_CONFIG_MISSING" }, 500);

  const auth = await validateAdminAuth(req, url, serviceKey);
  if (!auth.authorized) return json({ error: "UNAUTHORIZED", message: auth.error }, 401);
  if (auth.role !== "service_role") return json({ error: "SERVICE_ROLE_REQUIRED" }, 403);

  let input: Json = {};
  try { input = await req.json(); } catch { /* cron may send an empty body */ }
  const now = typeof input.now === "string" ? new Date(input.now) : new Date();
  if (Number.isNaN(now.getTime())) return json({ error: "INVALID_NOW" }, 400);

  const supabase = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

  try {
    const { data: schedules, error: scheduleError } = await supabase
      .from("atis_destination_feature_settings")
      .select("id,destination_type,contact_id,individual_id,group_id,schedule_mode,custom_time,timezone")
      .eq("feature_kind", "automation")
      .eq("feature_key", "daily_devotional")
      .eq("enabled", true);
    if (scheduleError) throw scheduleError;
    if (!schedules?.length) return json({ ok: true, skipped: true, reason: "NO_ENABLED_DESTINATIONS", queued: 0 });

    const { data: systemRow, error: systemError } = await supabase.from("admin_settings").select("value").eq("key", "daily_verse_push_time").maybeSingle();
    if (systemError) throw systemError;
    const systemTime = clockFromSetting(systemRow?.value, "06:00");

    const defaultInstanceId = await loadDefaultInstance(supabase);
    let queued = 0;
    let skipped = 0;
    let content: string | null = null;
    let contentDate = "";
    let contentReference = "";
    const results: Json[] = [];

    for (const raw of schedules as Schedule[]) {
      const timeZone = firstString(raw.timezone) ?? "America/Fortaleza";
      const local = localParts(now, timeZone);
      if (!isDue(raw, local.hhmm, systemTime)) {
        skipped++;
        results.push({ setting_id: raw.id, reason: "NOT_DUE" });
        continue;
      }

      const { data: verse, error: verseError } = await supabase
        .from("current_daily_verse")
        .select("verse_ref,verse_text,scheduled_date,created_at")
        .eq("scheduled_date", local.dateKey)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (verseError) throw verseError;
      if (!verse?.verse_ref) {
        skipped++;
        results.push({ setting_id: raw.id, reason: "DAILY_VERSE_NOT_READY" });
        continue;
      }

      const destination = await resolveDestination(supabase, raw, defaultInstanceId);
      if (!destination) {
        skipped++;
        results.push({ setting_id: raw.id, reason: "DESTINATION_NOT_ELIGIBLE" });
        continue;
      }

      const dedupeKey = `daily-devotional:${raw.destination_type}:${raw.contact_id ?? raw.individual_id ?? raw.group_id}:${local.dateKey}`;
      const { data: existing, error: existingError } = await supabase.from("atis_messages").select("id").eq("dedupe_key", dedupeKey).maybeSingle();
      if (existingError) throw existingError;
      if (existing) {
        skipped++;
        results.push({ setting_id: raw.id, reason: "ALREADY_QUEUED", message_id: existing.id });
        continue;
      }

      if (!content || contentDate !== local.dateKey || contentReference !== verse.verse_ref) {
        content = await dailyDevotionalContent(supabase, local.dateKey, verse.verse_ref);
        contentDate = local.dateKey;
        contentReference = verse.verse_ref;
      }

      const availableAt = now.toISOString();
      const { data: message, error: messageError } = await supabase.from("atis_messages").insert({
        instance_id: destination.instanceId,
        source_type: "automation",
        message_type: "text",
        content,
        status: "queued",
        priority: 8,
        scheduled_for: availableAt,
        available_at: availableAt,
        dedupe_key: dedupeKey,
        metadata: {
          automation_key: "daily_devotional",
          destination_feature_setting_id: raw.id,
          schedule_mode: raw.schedule_mode,
          custom_time: raw.custom_time,
          system_time: systemTime,
          timezone: timeZone,
          date_key: local.dateKey,
          verse_ref: verse.verse_ref,
          source: "current_daily_verse",
        },
        created_by: null,
      }).select("id").single();
      if (messageError) {
        if ((messageError as any).code === "23505") { skipped++; continue; }
        throw messageError;
      }

      const { error: targetError } = await supabase.from("atis_message_targets").insert({
        message_id: message.id,
        target_type: destination.targetType,
        target_key: destination.targetKey,
        contact_id: destination.contactId,
        individual_id: destination.individualId,
        group_id: destination.groupId,
        phone_e164: destination.phone,
        provider_target_id: destination.providerTargetId,
        display_name: destination.name,
        status: "pending",
        attempt_count: 0,
        max_attempts: 3,
        available_at: availableAt,
        metadata: { automation_key: "daily_devotional", date_key: local.dateKey, verse_ref: verse.verse_ref },
      });
      if (targetError) {
        await supabase.from("atis_messages").delete().eq("id", message.id);
        throw targetError;
      }

      queued++;
      results.push({ setting_id: raw.id, destination_type: raw.destination_type, destination_name: destination.name, queued: true, message_id: message.id });
    }

    return json({ ok: true, queued, skipped, destinations: schedules.length, system_time: systemTime, results });
  } catch (error) {
    const message = error instanceof Error ? error.message : "ATIS_CONTENT_RUNNER_ERROR";
    console.error("[atis-content-runner]", message);
    return json({ error: message, message }, 500);
  }
});
''')

# Remove one-off patch scaffolding from the resulting commit.
Path(".github/scripts/patch_atis_mobile_devotional.py").unlink(missing_ok=True)
Path(".github/workflows/patch-atis-mobile-devotional.yml").unlink(missing_ok=True)
