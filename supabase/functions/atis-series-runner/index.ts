import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { evolutionSendText, firstName, brDateParts } from '../_shared/atis-evolution.ts';

type SeriesItem = { day: number; title?: string; verse_ref?: string; verse_text?: string; body: string };

function buildText(seriesName: string, item: SeriesItem, nome: string, total: number): string {
  const header = `📚 *${seriesName}* — Dia ${item.day}/${total}`;
  const title = item.title ? `\n*${item.title}*` : '';
  const verse = item.verse_ref
    ? `\n\n📖 *${item.verse_ref}*${item.verse_text ? `\n"${item.verse_text}"` : ''}`
    : '';
  const body = item.body ? `\n\n${item.body}` : '';
  const salut = nome ? `Olá, ${nome}!\n\n` : '';
  return `${salut}${header}${title}${verse}${body}\n\n— Bíblia Atalaia`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { dateKey, timeKey } = brDateParts();

  const { data: series } = await admin.from('atis_series').select('*').eq('active', true);
  if (!series?.length) return new Response(JSON.stringify({ skipped: true, reason: 'no-active-series' }), { headers: corsHeaders });

  const results: any[] = [];
  for (const s of series) {
    if ((s.send_time ?? '07:00') !== timeKey) continue;
    const items = Array.isArray(s.items) ? (s.items as SeriesItem[]) : [];
    if (!items.length) continue;
    const total = items.length;

    const { data: subs } = await admin
      .from('atis_series_subscribers')
      .select('*')
      .eq('series_id', s.id)
      .eq('active', true);

    for (const sub of subs ?? []) {
      if (sub.last_sent_date === dateKey) continue;
      const day = sub.current_day ?? 1;
      const item = items.find((it) => Number(it.day) === Number(day));
      if (!item) {
        await admin.from('atis_series_subscribers').update({ active: false }).eq('id', sub.id);
        continue;
      }
      const nome = firstName(sub.name);
      const text = buildText(s.name, item, nome, total);
      const r = await evolutionSendText(sub.phone, text);
      await admin.from('atis_messages_log').insert({
        direction: 'outbound', wa_to: sub.phone, body: text,
        command: 'series', status: r.ok ? 'sent' : 'error',
        raw: { series_id: s.id, day, http: r.status },
      });
      if (r.ok) {
        const nextDay = day + 1;
        const done = nextDay > total;
        await admin.from('atis_series_subscribers').update({
          current_day: done ? day : nextDay,
          last_sent_date: dateKey,
          active: !done,
        }).eq('id', sub.id);
      }
      results.push({ series_id: s.id, phone: sub.phone, day, ok: r.ok });
    }
  }

  return new Response(JSON.stringify({ ok: true, processed: results.length, results }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});