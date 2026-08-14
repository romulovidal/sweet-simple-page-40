import { createClient } from 'npm:@supabase/supabase-js@2';
import { normalizeRecipient } from './atis-recipient-resolver.ts';

const EVO_URL = (Deno.env.get('EVOLUTION_API_URL') ?? '').replace(/\/$/, '');
const EVO_KEY = Deno.env.get('EVOLUTION_API_KEY') ?? '';
const INSTANCE = 'atis';

export type SendResult = { 
  ok: boolean; 
  status: number; 
  body: any; 
  jid: string | null;
  skipped?: boolean;
  reason?: string;
};

/**
 * Variantes de telefone para lidar com o 9º dígito no Brasil.
 */
export function phoneVariants(to: string): string[] {
  if (!to) return [];
  const { key, isGroup } = normalizeRecipient(to);
  if (isGroup) return [key];
  
  const digits = key.split('@')[0];
  const variants = new Set<string>();
  variants.add(digits);
  
  if (digits.startsWith('55')) {
    const ddd = digits.slice(2, 4);
    const rest = digits.slice(4);
    if (rest.length === 9 && rest.startsWith('9')) {
      variants.add(`55${ddd}${rest.slice(1)}`);
    } else if (rest.length === 8) {
      variants.add(`55${ddd}9${rest}`);
    }
  }
  
  return [...variants].map((n) => `${n}@s.whatsapp.net`);
}

/**
 * Helper central de comunicação com a Evolution API.
 */
export async function evolutionFetch(path: string, method = 'POST', body?: any): Promise<SendResult> {
  if (!EVO_URL || !EVO_KEY) {
    return { ok: false, status: 0, body: 'evolution-not-configured', jid: null };
  }

  try {
    const res = await fetch(`${EVO_URL}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        apikey: EVO_KEY,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    
    const raw = await res.text().catch(() => '');
    let parsed: any = raw;
    try { parsed = raw ? JSON.parse(raw) : null; } catch { /* keep raw */ }
    
    return { 
      ok: res.ok, 
      status: res.status, 
      body: parsed, 
      jid: body?.number || null 
    };
  } catch (e) {
    return { ok: false, status: 0, body: String((e as Error).message ?? e), jid: body?.number || null };
  }
}

/**
 * Envio de texto unificado com suporte a múltiplas variantes de JID.
 */
export async function evolutionSendText(to: string, text: string, opts?: { mentionsEveryOne?: boolean }): Promise<SendResult> {
  const attempts = phoneVariants(to);
  let last: SendResult = { ok: false, status: 0, body: 'no-attempts', jid: null };
  
  for (const jid of attempts) {
    const payload: any = { number: jid, text, linkPreview: true };
    if (opts?.mentionsEveryOne && jid.includes('@g.us')) {
      payload.mentionsEveryOne = true;
    }
    
    last = await evolutionFetch(`/message/sendText/${INSTANCE}`, 'POST', payload);
    if (last.ok) return last;
    
    // Se o erro indicar que o número não existe, tenta a próxima variante
    const notExists = JSON.stringify(last.body ?? '').includes('"exists":false');
    if (!notExists) break;
  }
  
  return last;
}

/**
 * Envia uma enquete (fallback para botões).
 */
export async function evolutionSendPoll(to: string, name: string, options: string[]): Promise<SendResult> {
  const attempts = phoneVariants(to);
  let last: SendResult = { ok: false, status: 0, body: 'no-attempts', jid: null };
  
  for (const jid of attempts) {
    const payload = {
      number: jid,
      name,
      selectableCount: 1,
      values: options,
    };
    
    last = await evolutionFetch(`/message/sendPoll/${INSTANCE}`, 'POST', payload);
    if (last.ok) return last;
    
    const notExists = JSON.stringify(last.body ?? '').includes('"exists":false');
    if (!notExists) break;
  }
  
  return last;
}

export function firstName(n: string | null | undefined): string {
  if (!n) return 'irmão(ã)';
  return String(n).trim().split(/\s+/)[0] || 'irmão(ã)';
}
