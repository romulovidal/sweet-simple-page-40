import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { evolutionSendText, firstName, brDateParts } from '../_shared/atis-evolution.ts';

const APP_URL = 'https://biblia.atalaias.online';

function buildText(planTitle: string, reading: any, nome: string, day: number, total: number | null): string {
  const rangeStr = reading.verse_start
    ? `${reading.book_abbrev} ${reading.chapter}:${reading.verse_start}${reading.verse_end ? `-${reading.verse_end}` : ''}`
    : `${reading.book_abbrev} ${reading.chapter}`;
  const salut = nome ? `Olá, ${nome}!\n\n` : '';
  const totalStr = total ? `/${total}` : '';
  const title = reading.title ? `\n_${reading.title}_` : '';
  return `${salut}📖 *${planTitle}* — Dia ${day}${totalStr}${title}\n\n👉 Leitura de hoje: *${rangeStr}*\n\nAbra no app: ${APP_URL}\n\n— Bíblia Atalaia`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { dateKey, timeKey } = brDateParts();

  const { data: subs } = await admin
    .from('atis_plan_subscribers')
    .select('*')
    .eq('active', true);

  if (!subs?.length) return new Response(JSON.stringify({ skipped: true, reason: 'no-subs' }), { headers: corsHeaders });

  const planCache = new Map<string, any>();
  const readingsCache = new Map<string, any[]>();
  const results: any[] = [];

  for (const sub of subs) {
    if ((sub.send_time ?? '07:00') !== timeKey) continue;
    if (sub.last_sent_date === dateKey) continue;

    let plan = planCache.get(sub.plan_id);
    if (!plan) {
      const { data } = await admin.from('admin_plans').select('id,title,total_days,is_active').eq('id', sub.plan_id).maybeSingle();
      plan = data; planCache.set(sub.plan_id, data);
    }
    if (!plan || plan.is_active === false) {
      await admin.from('atis_plan_subscribers').update({ active: false }).eq('id', sub.id);
      continue;
    }

    let readings = readingsCache.get(sub.plan_id);
    if (!readings) {
      const { data } = await admin
        .from('admin_plan_readings')
        .select('day_number,book_abbrev,chapter,verse_start,verse_end,title')
        .eq('plan_id', sub.plan_id)
        .order('day_number');
      readings = data ?? []; readingsCache.set(sub.plan_id, readings);
    }
    if (!readings.length) continue;

    const day = sub.current_day ?? 1;
    const total = plan.total_days ?? readings.length;
    const reading = readings.find((r: any) => r.day_number === day);
    if (!reading) {
      await admin.from('atis_plan_subscribers').update({ active: false }).eq('id', sub.id);
      continue;
    }

    const nome = firstName(sub.name);
    const text = buildText(plan.title, reading, nome, day, total);
    const r = await evolutionSendText(sub.phone, text);
    await admin.from('atis_messages_log').insert({
      direction: 'outbound', wa_to: sub.phone, body: text,
      command: 'plan-reading', status: r.ok ? 'sent' : 'error',
      raw: { plan_id: sub.plan_id, day, http: r.status },
    });
    if (r.ok) {
      const nextDay = day + 1;
      const done = nextDay > total;
      await admin.from('atis_plan_subscribers').update({
        current_day: done ? day : nextDay,
        last_sent_date: dateKey,
        active: !done,
      }).eq('id', sub.id);
    }
    results.push({ plan_id: sub.plan_id, phone: sub.phone, day, ok: r.ok });
  }

  return new Response(JSON.stringify({ ok: true, processed: results.length, results }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});