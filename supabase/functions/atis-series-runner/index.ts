import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { evolutionSendText, firstName, brDateParts } from '../_shared/atis-evolution.ts';
import { aiGenerateText } from '../_shared/ai-fetch.ts';

type SeriesItem = { day: number; title?: string; verse_ref?: string; verse_text?: string; body: string };

function buildText(seriesName: string, item: SeriesItem, nome: string, total: number, commentary?: string): string {
  const header = `📚 *${seriesName}* — Dia ${item.day}/${total}`;
  const title = item.title ? `\n*${item.title}*` : '';
  const verse = item.verse_ref
    ? `\n\n📖 *${item.verse_ref}*${item.verse_text ? `\n"${item.verse_text}"` : ''}`
    : '';
  const body = item.body ? `\n\n${item.body}` : '';
  const extra = commentary ? `\n\n✨ *Aprofundando*\n${commentary}` : '';
  const salut = nome ? `Olá, ${nome}!\n\n` : '';
  return `${salut}${header}${title}${verse}${body}${extra}\n\n— Bíblia Atalaia`;
}

async function generateCommentary(seriesName: string, item: SeriesItem): Promise<string> {
  const parts: string[] = [];
  if (item.title) parts.push(`Título: ${item.title}`);
  if (item.verse_ref) parts.push(`Versículo: ${item.verse_ref}${item.verse_text ? ` — "${item.verse_text}"` : ''}`);
  if (item.body) parts.push(`Reflexão do dia:\n${item.body}`);
  const user = `Série: "${seriesName}"\n\n${parts.join('\n\n')}\n\nComplemente com um comentário curto (máx 3 parágrafos) que dê profundidade ao tema deste dia — contexto bíblico, aplicação prática e um convite pastoral final. Não repita o versículo nem a reflexão; apenas aprofunde. Tom acolhedor, evangélico, sem clichês.`;
  const system = `Você é um pastor evangélico brasileiro que escreve devocionais curtos e profundos. Responda apenas com o texto do comentário (sem título, sem "Comentário:", sem markdown pesado).`;
  const out = await aiGenerateText({ system, user, temperature: 0.8, maxTokens: 500 });
  return out.trim();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { dateKey, timeKey } = brDateParts();

  const { data: series } = await admin.from('atis_series').select('*').eq('active', true);
  if (!series?.length) return new Response(JSON.stringify({ skipped: true, reason: 'no-active-series' }), { headers: corsHeaders });

  const results: any[] = [];
  for (const s of series) {
    const items = Array.isArray(s.items) ? (s.items as SeriesItem[]) : [];
    if (!items.length) continue;
    const total = items.length;
    const defaultTime = s.send_time ?? '07:00';

    // ---- Individual subscribers (use series default send_time) ----
    if (defaultTime === timeKey) {
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
      const commentary = s.ai_commentary ? await generateCommentary(s.name, item) : '';
      const text = buildText(s.name, item, nome, total, commentary);
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

    // ---- Linked WhatsApp groups (respect per-group time + notification_types) ----
    const groupIds: string[] = Array.isArray(s.group_ids) ? s.group_ids : [];
    if (groupIds.length) {
      const { data: groups } = await admin
        .from('atis_groups')
        .select('id, name, wa_group_id, active, forward_notifications, notification_types, notification_times')
        .in('id', groupIds);
      for (const g of groups ?? []) {
        if (!g.active || !g.forward_notifications || !g.wa_group_id) continue;
        const types: string[] = Array.isArray(g.notification_types) ? g.notification_types : [];
        if (types.length && !types.includes('series')) continue;
        const times = (g.notification_times && typeof g.notification_times === 'object') ? g.notification_times as Record<string, string> : {};
        const groupTime = times['series'] || defaultTime;
        if (groupTime !== timeKey) continue;

        const { data: prog } = await admin
          .from('atis_series_group_progress')
          .select('*')
          .eq('series_id', s.id)
          .eq('group_id', g.id)
          .maybeSingle();
        if (prog && !prog.active) continue;
        if (prog?.last_sent_date === dateKey) continue;
        const day = prog?.current_day ?? 1;
        const item = items.find((it) => Number(it.day) === Number(day));
        if (!item) {
          if (prog) await admin.from('atis_series_group_progress').update({ active: false }).eq('id', prog.id);
          continue;
        }
        const commentary = s.ai_commentary ? await generateCommentary(s.name, item) : '';
        const text = buildText(s.name, item, '', total, commentary);
        const r = await evolutionSendText(g.wa_group_id, text);
        await admin.from('atis_messages_log').insert({
          direction: 'outbound', wa_group_id: g.wa_group_id, body: text,
          command: 'series', status: r.ok ? 'sent' : 'error',
          raw: { series_id: s.id, group_id: g.id, day, http: r.status },
        });
        if (r.ok) {
          const nextDay = day + 1;
          const done = nextDay > total;
          if (prog) {
            await admin.from('atis_series_group_progress').update({
              current_day: done ? day : nextDay,
              last_sent_date: dateKey,
              active: !done,
            }).eq('id', prog.id);
          } else {
            await admin.from('atis_series_group_progress').insert({
              series_id: s.id, group_id: g.id,
              current_day: done ? day : nextDay,
              last_sent_date: dateKey,
              active: !done,
            });
          }
        }
        results.push({ series_id: s.id, group_id: g.id, day, ok: r.ok });
      }
    }
  }

  return new Response(JSON.stringify({ ok: true, processed: results.length, results }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});