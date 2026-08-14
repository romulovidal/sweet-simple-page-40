import { createClient } from 'npm:@supabase/supabase-js@2';
import { evolutionSendText, type SendResult, firstName } from './atis-evolution.ts';
import { normalizeRecipient } from './atis-recipient-resolver.ts';

/**
 * Camada anti-banimento do Atis V2.
 * Unifica lógica de limites, horário de silêncio e pacing.
 */

export interface GuardConfig {
  enabled: boolean;
  quiet_hours_enabled: boolean;
  quiet_hours_start: string;
  quiet_hours_end: string;
  daily_global_cap: number;
  daily_recipient_cap: number;
  daily_group_cap: number;
  hourly_cap: number;
  min_gap_ms: number;
  max_gap_ms: number;
  jitter_max_ms: number;
  paused_until?: string | null;
  consecutive_errors?: number;
  max_chars?: number;
}


export async function loadGuard(supabase: any): Promise<GuardConfig> {
  const { data } = await supabase
    .from('atis_automation_settings')
    .select('*')
    .eq('id', 1)
    .maybeSingle();

  return {
    enabled: data?.global_enabled !== false,
    quiet_hours_enabled: data?.quiet_hours_enabled !== false,
    quiet_hours_start: data?.quiet_hours_start || '21:00',
    quiet_hours_end: data?.quiet_hours_end || '07:00',
    daily_global_cap: data?.daily_global_cap ?? 120,
    daily_recipient_cap: data?.daily_recipient_cap ?? 2,
    daily_group_cap: data?.daily_group_cap ?? 3,
    hourly_cap: data?.hourly_cap ?? 20,
    min_gap_ms: data?.min_gap_ms ?? 25000,
    max_gap_ms: data?.max_gap_ms ?? 95000,
    jitter_max_ms: data?.jitter_max_ms ?? 9000,
    max_chars: data?.max_chars ?? 1500
  };

}

export function isQuietHour(cfg: GuardConfig): boolean {
  if (!cfg.quiet_hours_enabled) return false;
  
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Fortaleza',
    hour: '2-digit', minute: '2-digit',
    hour12: false
  });
  const parts = formatter.formatToParts(now);
  const hour = parseInt(parts.find(p => p.type === 'hour')?.value ?? '0');
  
  const start = parseInt(cfg.quiet_hours_start.split(':')[0]);
  const end = parseInt(cfg.quiet_hours_end.split(':')[0]);
  
  if (start > end) {
    return hour >= start || hour < end;
  }
  return hour >= start && hour < end;
}

/**
 * Envio seguro centralizado.
 */
export async function safeSend(
  supabase: any,
  to: string,
  text: string,
  opts: { 
    kind?: 'bulk' | 'transactional' | 'reply'; 
    noFooter?: boolean;
    mentionsEveryOne?: boolean;
    isManual?: boolean;
  } = {}
): Promise<SendResult> {
  const cfg = await loadGuard(supabase);
  const { key, isGroup } = normalizeRecipient(to);
  const kind = opts.kind ?? 'bulk';
  const isManual = opts.isManual === true;

  // 1. Verificações Básicas
  if (!cfg.enabled && kind !== 'reply' && !isManual) {
    return { ok: false, status: 0, body: 'bot-disabled', jid: key, skipped: true, reason: 'global_disabled' };
  }

  if (kind !== 'reply' && !isManual && isQuietHour(cfg)) {
    return { ok: false, status: 0, body: 'quiet-hours', jid: key, skipped: true, reason: 'quiet_hours' };
  }

  // TODO: Validar caps diários via atis_send_ledger ou nova tabela logs V2
  
  // 2. Pacing Humano (Jitter)
  if (kind === 'bulk' && cfg.jitter_max_ms > 0) {
    await new Promise(r => setTimeout(r, Math.random() * cfg.jitter_max_ms));
  }

  // 3. Envio Real via Evolution (com suporte a truncamento de segurança se necessário)
  const safeText = cfg.max_chars ? text.slice(0, cfg.max_chars) : text;
  const result = await evolutionSendText(key, safeText, { mentionsEveryOne: opts.mentionsEveryOne });


  // 4. Registro no Ledger (Legado para compatibilidade de caps se necessário)
  if (result.ok) {
    const today = new Date().toISOString().split('T')[0];
    await supabase.from('atis_send_ledger').insert({
      recipient: key,
      day: today,
      kind: kind,
      body_hash: 'v2-engine'
    });
  }

  return result;
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
export const rand = (a: number, b: number) => a + Math.random() * (b - a);

export async function humanGap(cfg: GuardConfig, index: number) {
  if (index <= 0) return;
  await sleep(rand(cfg.min_gap_ms, cfg.max_gap_ms));
}
