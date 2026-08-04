import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { evolutionSendText, firstName, brDateParts } from '../_shared/atis-evolution.ts';
import { safeSend, loadGuard, humanGap, shuffle } from '../_shared/atis-antiban.ts';
import { aiGenerateText, hasAnyAiKey } from '../_shared/ai-fetch.ts';

const DEFAULT_REFLECTION_PROMPT =
  'Você é um pastor devocional escrevendo por WhatsApp. A partir do versículo dado, escreva 1 parágrafo curto (2-3 frases, máximo 350 caracteres) de reflexão calorosa e prática — sem repetir o versículo. Português brasileiro, tom acolhedor.';

async function generateShortReflection(admin: any, verseRef: string, verseText: string): Promise<string> {
  if (!hasAnyAiKey()) return '';
  try {
    let systemPrompt = DEFAULT_REFLECTION_PROMPT;
    const { data: promptsRow } = await admin
      .from('admin_settings').select('value').eq('key', 'ai_tool_prompts').maybeSingle();
    const custom = (promptsRow?.value as Record<string, string> | null)?.devotional;
    if (typeof custom === 'string' && custom.trim().length > 0) {
      systemPrompt = custom + '\n\nAdapte para máximo 350 caracteres, 1 parágrafo, sem repetir o versículo.';
    }
    let text = await aiGenerateText({
      system: systemPrompt,
      user: `**${verseRef}**\n\n"${verseText}"`,
      temperature: 0.9,
      maxTokens: 512,
    });
    if (!text) return '';
    text = text.replace(/^#{1,6}\s+/gm, '').replace(/\*\*(.+?)\*\*/g, '*$1*').trim();
    return text.slice(0, 500);
  } catch { return ''; }
}

function buildMessage(nome: string, verseRef: string, verseText: string, reflection: string, period: string): string {
  const saud = period === 'manhã' ? '☀️ Bom dia' : period === 'tarde' ? '🌤️ Boa tarde' : period === 'noite' ? '🌙 Boa noite' : '✨ Paz do Senhor';
  const nomeStr = nome ? `, ${nome}` : '';
  let text = `${saud}${nomeStr}!\n\n📖 *${verseRef}*\n"${verseText}"`;
  if (reflection) text += `\n\n💜 ${reflection}`;
  text += `\n\n— Bíblia Atalaia`;
  return text;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const body = await req.json().catch(() => ({} as any));
  const force = body?.force === true;

  const { data: settingRow } = await admin.from('admin_settings').select('value').eq('key', 'atis_daily_verse_dm').maybeSingle();
  const cfg = (settingRow?.value ?? {}) as {
    enabled?: boolean; time?: string; include_reflection?: boolean;
    target?: 'profiles' | 'contacts' | 'both'; last_sent_date?: string;
  };

  const { dateKey, timeKey, period } = brDateParts();

  if (!force) {
    if (!cfg.enabled) return new Response(JSON.stringify({ skipped: true, reason: 'disabled' }), { headers: corsHeaders });
    if ((cfg.time ?? '07:00') !== timeKey) return new Response(JSON.stringify({ skipped: true, reason: 'not-time', now: timeKey }), { headers: corsHeaders });
    if (cfg.last_sent_date === dateKey) return new Response(JSON.stringify({ skipped: true, reason: 'already-sent-today' }), { headers: corsHeaders });
  }

  const { data: qv } = await admin
    .from('daily_verse_queue')
    .select('verse_text, verse_ref')
    .eq('scheduled_date', dateKey)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!qv?.verse_ref) return new Response(JSON.stringify({ skipped: true, reason: 'no-verse-scheduled', dateKey }), { headers: corsHeaders });

  const reflection = cfg.include_reflection !== false ? await generateShortReflection(admin, qv.verse_ref, qv.verse_text) : '';

  const target = cfg.target ?? 'both';
  const recipients = new Map<string, { name: string | null }>();

  if (target === 'profiles' || target === 'both') {
    const { data: profs } = await admin
      .from('profiles')
      .select('display_name, whatsapp, whatsapp_opt_in')
      .eq('whatsapp_opt_in', true)
      .not('whatsapp', 'is', null);
    for (const p of profs ?? []) {
      const phone = String((p as any).whatsapp ?? '').replace(/\D/g, '');
      if (phone) recipients.set(phone, { name: (p as any).display_name ?? null });
    }
  }
  if (target === 'contacts' || target === 'both') {
    const { data: contacts } = await admin
      .from('atis_contacts')
      .select('name, phone, opt_in')
      .eq('opt_in', true);
    for (const c of contacts ?? []) {
      const phone = String((c as any).phone ?? '').replace(/\D/g, '');
      if (phone) recipients.set(phone, { name: (c as any).name ?? null });
    }
  }

  if (!recipients.size) return new Response(JSON.stringify({ skipped: true, reason: 'no-recipients' }), { headers: corsHeaders });

  let ok = 0, fail = 0;
  const errors: string[] = [];
  const guard = await loadGuard(admin);
  let idx = 0;
  for (const [phone, meta] of shuffle([...recipients.entries()])) {
    await humanGap(guard, idx++);
    const nome = firstName(meta.name);
    const text = buildMessage(nome, qv.verse_ref, qv.verse_text, reflection, period);
    const r = await safeSend(admin, phone, text, { kind: 'bulk' });
    if (r.ok) ok++; else { fail++; errors.push(`${phone}:${(r as any).skipped ? (r as any).reason : r.status}`); }
    if ((r as any).skipped) continue;
    await admin.from('atis_messages_log').insert({
      direction: 'outbound',
      wa_to: phone,
      body: text,
      command: 'daily-verse-dm',
      status: r.ok ? 'sent' : 'error',
      raw: { auto: !force, verse_ref: qv.verse_ref, http: r.status },
    });
  }

  if (!force) {
    await admin.from('admin_settings').upsert(
      { key: 'atis_daily_verse_dm', value: { ...cfg, last_sent_date: dateKey } },
      { onConflict: 'key' },
    );
  }

  return new Response(JSON.stringify({ ok: true, sent: ok, failed: fail, total: recipients.size, errors: errors.slice(0, 10) }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});