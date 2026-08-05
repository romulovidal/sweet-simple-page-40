// Camada anti-banimento do Atis.
// Todo envio do robô deve passar por aqui. Aplica: opt-out, horário de silêncio,
// aquecimento (warmup), limites diários, deduplicação, pausa em cascata de erros,
// pacing humano (digitando + intervalos aleatórios) e variação de texto.

import { createClient } from 'npm:@supabase/supabase-js@2';
import { evolutionSendText, type SendResult } from './atis-evolution.ts';

const EVO_URL = (Deno.env.get('EVOLUTION_API_URL') ?? '').replace(/\/$/, '');
const EVO_KEY = Deno.env.get('EVOLUTION_API_KEY') ?? '';
const INSTANCE = 'atis';
const TZ = 'America/Fortaleza';

export type SendKind = 'reply' | 'bulk' | 'transactional';

export interface GuardConfig {
  enabled: boolean;
  warmup_start_date: string | null; // YYYY-MM-DD do dia em que o número foi conectado
  quiet_start: number;              // hora BR a partir da qual não envia (ex.: 21)
  quiet_end: number;                // hora BR antes da qual não envia (ex.: 7)
  daily_global_cap: number;         // teto absoluto por dia (fora warmup)
  daily_recipient_cap: number;      // máximo de mensagens por contato/dia
  hourly_cap: number;               // teto de envios em massa por hora
  daily_group_cap: number;          // máximo de mensagens por grupo/dia
  dedupe_hours: number;
  min_gap_ms: number;               // intervalo mínimo entre envios em massa
  max_gap_ms: number;
  typing_ms_per_char: number;
  typing_max_ms: number;
  batch_pause_every: number;        // a cada N envios, pausa longa
  batch_pause_ms: number;
  variation: boolean;               // pequenas variações no texto
  optout_footer: boolean;           // rodapé "responda SAIR"
  error_circuit: number;            // nº de falhas seguidas que pausa o robô
  paused_until: string | null;      // ISO
  consecutive_errors: number;
  jitter_max_ms: number;            // atraso aleatório antes de cada envio
  read_before_reply: boolean;       // marcar como lido antes de responder
  link_guard: boolean;              // no máximo 1 link por mensagem em massa
  max_chars: number;                // corta mensagens muito longas
}

export const DEFAULT_GUARD: GuardConfig = {
  enabled: true,
  warmup_start_date: null,
  quiet_start: 21,
  quiet_end: 8,
  daily_global_cap: 120,
  daily_recipient_cap: 2,
  hourly_cap: 20,
  daily_group_cap: 3,
  dedupe_hours: 20,
  min_gap_ms: 25000,
  max_gap_ms: 95000,
  typing_ms_per_char: 45,
  typing_max_ms: 12000,
  batch_pause_every: 8,
  batch_pause_ms: 300000,
  variation: true,
  optout_footer: true,
  error_circuit: 3,
  paused_until: null,
  consecutive_errors: 0,
  jitter_max_ms: 9000,
  read_before_reply: true,
  link_guard: true,
  max_chars: 900,
};

export const GUARD_KEY = 'atis_antiban';

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, Math.max(0, ms)));
const rand = (a: number, b: number) => a + Math.random() * (b - a);

export function brNowParts() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(new Date());
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return { date: `${g('year')}-${g('month')}-${g('day')}`, hour: parseInt(g('hour'), 10) };
}

export async function loadGuard(admin: any): Promise<GuardConfig> {
  try {
    const { data } = await admin.from('admin_settings').select('value').eq('key', GUARD_KEY).maybeSingle();
    return { ...DEFAULT_GUARD, ...((data?.value ?? {}) as Partial<GuardConfig>) };
  } catch { return { ...DEFAULT_GUARD }; }
}

async function saveGuard(admin: any, patch: Partial<GuardConfig>, current: GuardConfig) {
  try {
    await admin.from('admin_settings').upsert(
      { key: GUARD_KEY, value: { ...current, ...patch } }, { onConflict: 'key' },
    );
  } catch { /* noop */ }
}

/** Limite diário efetivo considerando o aquecimento do chip. */
export function warmupCap(cfg: GuardConfig): number {
  if (!cfg.warmup_start_date) return Math.min(cfg.daily_global_cap, 15);
  const start = new Date(`${cfg.warmup_start_date}T00:00:00-03:00`).getTime();
  const days = Math.floor((Date.now() - start) / 86400000);
  // rampa lenta (21 dias) — quanto mais devagar, menor o risco de bloqueio
  const ramp = [5, 8, 10, 14, 18, 22, 26, 32, 38, 44, 52, 60, 68, 76, 84, 92, 100, 108, 114, 118, 120];
  const v = days < ramp.length ? ramp[Math.max(0, days)] : cfg.daily_global_cap;
  return Math.min(v, cfg.daily_global_cap);
}

export function isQuietHour(cfg: GuardConfig, hour = brNowParts().hour): boolean {
  const { quiet_start: s, quiet_end: e } = cfg;
  return s > e ? (hour >= s || hour < e) : (hour >= s && hour < e);
}

async function hash(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

const ZW = '\u200b';
/** Variações imperceptíveis para que não saiam N mensagens byte-a-byte idênticas. */
function humanize(text: string, on: boolean): string {
  if (!on) return text;
  const tail = ['', ' ', '\u00a0', ZW][Math.floor(Math.random() * 4)];
  const lines = text.split('\n');
  const i = Math.floor(Math.random() * lines.length);
  if (Math.random() < 0.4 && lines[i]) lines[i] = lines[i] + '';
  return lines.join('\n') + tail;
}

const OPTOUT_FOOTER = '\n\n_Para não receber mais estas mensagens, responda SAIR._';

async function setPresence(jid: string, state: 'composing' | 'paused') {
  if (!EVO_URL || !EVO_KEY) return;
  try {
    await fetch(`${EVO_URL}/chat/sendPresence/${INSTANCE}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: EVO_KEY },
      body: JSON.stringify({ number: jid, presence: state, delay: 0 }),
    });
  } catch { /* opcional */ }
}

/** Marca o chat como lido — comportamento típico de humano antes de responder. */
export async function markChatRead(remoteJid: string, messageId?: string) {
  if (!EVO_URL || !EVO_KEY || !remoteJid) return;
  try {
    await fetch(`${EVO_URL}/chat/markMessageAsRead/${INSTANCE}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: EVO_KEY },
      body: JSON.stringify({ readMessages: [{ remoteJid, fromMe: false, id: messageId ?? '' }] }),
    });
  } catch { /* opcional */ }
}

/** Mantém no máximo 1 link e evita mensagens gigantes (padrões típicos de spam). */
function sanitizeBulk(text: string, cfg: GuardConfig): string {
  let out = text;
  if (cfg.link_guard) {
    let seen = 0;
    out = out.replace(/https?:\/\/\S+/g, (m) => (++seen === 1 ? m : ''));
  }
  if (cfg.max_chars > 0 && out.length > cfg.max_chars) {
    out = out.slice(0, cfg.max_chars).replace(/\s+\S*$/, '') + '…';
  }
  return out.replace(/\n{3,}/g, '\n\n').trim();
}

/** Envios em massa na última hora (freio adicional ao teto diário). */
async function hourlyCount(admin: any): Promise<number> {
  try {
    const { count } = await admin
      .from('atis_send_ledger')
      .select('id', { count: 'exact', head: true })
      .neq('kind', 'reply')
      .gt('created_at', new Date(Date.now() - 3600000).toISOString());
    return count ?? 0;
  } catch { return 0; }
}

export function normalizeRecipient(to: string): { key: string; isGroup: boolean } {
  const isGroup = to.includes('@g.us');
  if (isGroup) return { key: to, isGroup: true };
  const digits = (to.includes('@') ? to.split('@')[0] : to).replace(/\D/g, '');
  const withCountry = digits.startsWith('55') ? digits : `55${digits}`;
  return { key: withCountry, isGroup: false };
}

export interface SafeSendOptions {
  kind?: SendKind;              // 'reply' = resposta a mensagem recebida (isenta de limites)
  mentionsEveryOne?: boolean;
  skipTyping?: boolean;
  noFooter?: boolean;
  bypassQuietHours?: boolean;
}

export interface SafeSendResult extends SendResult {
  skipped?: boolean;
  reason?: string;
}

/**
 * Envio seguro. Retorna { ok, skipped, reason } — nunca lança.
 */
export async function safeSend(
  admin: any,
  to: string,
  text: string,
  opts: SafeSendOptions = {},
): Promise<SafeSendResult> {
  const kind: SendKind = opts.kind ?? 'bulk';
  const cfg = await loadGuard(admin);
  const { key, isGroup } = normalizeRecipient(to);

  if (!cfg.enabled) return { ok: false, status: 0, body: null, jid: null, skipped: true, reason: 'guard_disabled' };

  // Circuito aberto após erros em cascata (sinal típico de bloqueio/desconexão)
  if (cfg.paused_until && new Date(cfg.paused_until).getTime() > Date.now()) {
    return { ok: false, status: 0, body: null, jid: null, skipped: true, reason: 'circuit_paused' };
  }

  if (kind !== 'reply' && !opts.bypassQuietHours && isQuietHour(cfg)) {
    return { ok: false, status: 0, body: null, jid: null, skipped: true, reason: 'quiet_hours' };
  }

  const bodyHash = await hash(`${key}|${text.slice(0, 400)}`);
  let allowed = true; let reason = '';
  try {
    const { data } = await admin.rpc('atis_guard_check', {
      _recipient: key,
      _is_group: isGroup,
      _kind: kind,
      _body_hash: bodyHash,
      _daily_global_cap: warmupCap(cfg),
      _daily_recipient_cap: cfg.daily_recipient_cap,
      _dedupe_hours: cfg.dedupe_hours,
    });
    allowed = (data as any)?.allowed !== false;
    reason = (data as any)?.reason ?? '';
  } catch { /* se o guard falhar, segue o envio */ }
  if (!allowed) return { ok: false, status: 0, body: null, jid: null, skipped: true, reason };

  let out = text;
  if (kind === 'bulk' && !isGroup && cfg.optout_footer && !opts.noFooter && !/responda SAIR/i.test(text)) {
    out += OPTOUT_FOOTER;
  }
  out = humanize(out, cfg.variation);

  // Pacing humano: "digitando..." proporcional ao tamanho do texto
  if (!opts.skipTyping) {
    const jid = isGroup ? key : `${key}@s.whatsapp.net`;
    const typing = Math.min(cfg.typing_max_ms, 800 + out.length * cfg.typing_ms_per_char * rand(0.7, 1.3));
    await setPresence(jid, 'composing');
    await sleep(typing);
    await setPresence(jid, 'paused');
    await sleep(rand(200, 900));
  }

  const res = await evolutionSendText(to, out, { mentionsEveryOne: opts.mentionsEveryOne });

  // Circuit breaker
  if (res.ok) {
    if (cfg.consecutive_errors) await saveGuard(admin, { consecutive_errors: 0, paused_until: null }, cfg);
  } else {
    const errs = (cfg.consecutive_errors ?? 0) + 1;
    const trip = errs >= cfg.error_circuit;
    await saveGuard(admin, {
      consecutive_errors: errs,
      paused_until: trip ? new Date(Date.now() + 30 * 60000).toISOString() : cfg.paused_until,
    }, cfg);
  }

  return res;
}

/** Intervalo aleatório entre destinatários de uma campanha. */
export async function humanGap(cfg: GuardConfig, index: number) {
  if (index <= 0) return;
  if (cfg.batch_pause_every > 0 && index % cfg.batch_pause_every === 0) {
    await sleep(cfg.batch_pause_ms * rand(0.8, 1.2));
    return;
  }
  await sleep(rand(cfg.min_gap_ms, cfg.max_gap_ms));
}

/** Embaralha a lista para não seguir sempre a mesma ordem/padrão. */
export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const OPTOUT_WORDS = ['sair', 'parar', 'pare', 'stop', 'cancelar', 'descadastrar', 'nao quero mais', 'não quero mais', 'remover'];
export const OPTIN_WORDS = ['voltar', 'quero receber', 'reativar', 'retornar mensagens'];

export function isOptOutMessage(text: string): boolean {
  const t = text.trim().toLowerCase().replace(/[.!]/g, '');
  return OPTOUT_WORDS.includes(t);
}
export function isOptInMessage(text: string): boolean {
  const t = text.trim().toLowerCase().replace(/[.!]/g, '');
  return OPTIN_WORDS.includes(t);
}

export function serviceClient() {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
}
