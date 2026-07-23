// Shared Evolution API helper for the Atis bot.
// Provides text sending with BR 9th-digit retry.

const EVO_URL = (Deno.env.get('EVOLUTION_API_URL') ?? '').replace(/\/$/, '');
const EVO_KEY = Deno.env.get('EVOLUTION_API_KEY') ?? '';
const INSTANCE = 'atis';

export function phoneVariants(to: string): string[] {
  if (!to) return [];
  if (to.includes('@')) return [to];
  const digits = to.replace(/\D/g, '');
  if (!digits) return [];
  const withCountry = digits.startsWith('55') ? digits : `55${digits}`;
  const ddd = withCountry.slice(2, 4);
  const rest = withCountry.slice(4);
  const variants = new Set<string>();
  variants.add(withCountry);
  if (rest.length === 9 && rest.startsWith('9')) variants.add(`55${ddd}${rest.slice(1)}`);
  else if (rest.length === 8) variants.add(`55${ddd}9${rest}`);
  return [...variants].map((n) => `${n}@s.whatsapp.net`);
}

export type SendResult = { ok: boolean; status: number; body: any; jid: string | null };

export async function evolutionSendText(to: string, text: string): Promise<SendResult> {
  if (!EVO_URL || !EVO_KEY) return { ok: false, status: 0, body: 'evolution-not-configured', jid: null };
  const attempts = phoneVariants(to);
  let last: SendResult = { ok: false, status: 0, body: 'no-attempts', jid: null };
  for (const jid of attempts) {
    try {
      const res = await fetch(`${EVO_URL}/message/sendText/${INSTANCE}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: EVO_KEY },
        body: JSON.stringify({ number: jid, text }),
      });
      const raw = await res.text().catch(() => '');
      let body: any = raw;
      try { body = raw ? JSON.parse(raw) : null; } catch { /* keep raw */ }
      last = { ok: res.ok, status: res.status, body, jid };
      if (res.ok) return last;
      const notExists = JSON.stringify(body ?? '').includes('"exists":false');
      if (!notExists) return last;
    } catch (e) {
      last = { ok: false, status: 0, body: String((e as Error).message ?? e), jid };
    }
  }
  return last;
}

export type ReplyButton = { id: string; displayText: string };

// Envia mensagem com botões de resposta rápida via Evolution API.
// Faz fallback automático para texto simples se o provedor rejeitar o formato de botões.
export async function evolutionSendButtons(
  to: string,
  body: string,
  buttons: ReplyButton[],
  opts?: { title?: string; footer?: string },
): Promise<SendResult> {
  if (!EVO_URL || !EVO_KEY) return { ok: false, status: 0, body: 'evolution-not-configured', jid: null };
  const attempts = phoneVariants(to);
  let last: SendResult = { ok: false, status: 0, body: 'no-attempts', jid: null };
  for (const jid of attempts) {
    try {
      const payload = {
        number: jid,
        title: opts?.title ?? '',
        description: body,
        footer: opts?.footer ?? '',
        buttons: buttons.map((b) => ({ type: 'reply', displayText: b.displayText, id: b.id })),
      };
      const res = await fetch(`${EVO_URL}/message/sendButtons/${INSTANCE}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: EVO_KEY },
        body: JSON.stringify(payload),
      });
      const raw = await res.text().catch(() => '');
      let parsed: any = raw;
      try { parsed = raw ? JSON.parse(raw) : null; } catch { /* keep raw */ }
      last = { ok: res.ok, status: res.status, body: parsed, jid };
      if (res.ok) return last;
      const notExists = JSON.stringify(parsed ?? '').includes('"exists":false');
      if (!notExists) break; // erro de formato — não adianta tentar outra variação de número
    } catch (e) {
      last = { ok: false, status: 0, body: String((e as Error).message ?? e), jid };
    }
  }
  // Fallback: envia como texto para nunca perder o alerta.
  const fallback = await evolutionSendText(to, body);
  return { ...fallback, body: { fallback_from_buttons: last.body, text_result: fallback.body } };
}

export function firstName(n: string | null | undefined): string {
  if (!n) return 'irmão(ã)';
  return String(n).trim().split(/\s+/)[0] || 'irmão(ã)';
}

export function brDateParts(): { dateKey: string; timeKey: string; period: string } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Fortaleza',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(new Date());
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  const dateKey = `${g('year')}-${g('month')}-${g('day')}`;
  const timeKey = `${g('hour')}:${g('minute')}`;
  const hour = parseInt(g('hour'), 10);
  const period = hour >= 5 && hour < 12 ? 'manhã'
    : hour >= 12 && hour < 18 ? 'tarde'
    : hour >= 18 ? 'noite' : 'madrugada';
  return { dateKey, timeKey, period };
}