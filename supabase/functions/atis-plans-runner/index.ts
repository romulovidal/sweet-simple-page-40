import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { evolutionSendText, firstName, brDateParts } from '../_shared/atis-evolution.ts';

const APP_URL = 'https://biblia.atalaias.online';
const WA_CHUNK = 3500;

// Ordem canônica dos livros — casa com posição no JSON de /biblias/ARC.json
const BOOK_API_ABBREV = [
  'gn','ex','lv','nm','dt','js','jz','rt','1sm','2sm',
  '1rs','2rs','1cr','2cr','ed','ne','et','job','sl','pv',
  'ec','ct','is','jr','lm','ez','dn','os','jl','am',
  'ob','jn','mq','na','hc','sf','ag','zc','ml',
  'mt','mc','lc','jo','at','rm','1co','2co','gl','ef',
  'fp','cl','1ts','2ts','1tm','2tm','tt','fm','hb','tg',
  '1pe','2pe','1jo','2jo','3jo','jd','ap',
];
const BOOK_NAMES = [
  'Gênesis','Êxodo','Levítico','Números','Deuteronômio','Josué','Juízes','Rute','1 Samuel','2 Samuel',
  '1 Reis','2 Reis','1 Crônicas','2 Crônicas','Esdras','Neemias','Ester','Jó','Salmos','Provérbios',
  'Eclesiastes','Cânticos','Isaías','Jeremias','Lamentações','Ezequiel','Daniel','Oséias','Joel','Amós',
  'Obadias','Jonas','Miquéias','Naum','Habacuque','Sofonias','Ageu','Zacarias','Malaquias',
  'Mateus','Marcos','Lucas','João','Atos','Romanos','1 Coríntios','2 Coríntios','Gálatas','Efésios',
  'Filipenses','Colossenses','1 Tessalonicenses','2 Tessalonicenses','1 Timóteo','2 Timóteo','Tito','Filemom','Hebreus','Tiago',
  '1 Pedro','2 Pedro','1 João','2 João','3 João','Judas','Apocalipse',
];

type BibleBook = { abbrev: string; name: string; chapters: string[][] };
let BIBLE_CACHE: BibleBook[] | null = null;

async function loadBible(): Promise<BibleBook[]> {
  if (BIBLE_CACHE) return BIBLE_CACHE;
  const r = await fetch(`${APP_URL}/biblias/ARC.json`);
  if (!r.ok) return [];
  BIBLE_CACHE = await r.json() as BibleBook[];
  return BIBLE_CACHE;
}

function findBookIdx(abbrev: string): number {
  const k = (abbrev || '').toLowerCase().replace(/\s+/g, '');
  return BOOK_API_ABBREV.indexOf(k);
}

function chunk(text: string, size: number): string[] {
  if (text.length <= size) return [text];
  const parts: string[] = [];
  const paragraphs = text.split(/\n(?=\*\d)/);
  let buf = '';
  for (const p of paragraphs) {
    const piece = (buf ? '\n' : '') + p;
    if ((buf + piece).length > size && buf) {
      parts.push(buf);
      buf = p;
    } else {
      buf += piece;
    }
  }
  if (buf) parts.push(buf);
  return parts;
}

async function buildMessages(
  planTitle: string,
  reading: any,
  nome: string,
  day: number,
  total: number | null,
): Promise<string[]> {
  const bible = await loadBible();
  const idx = findBookIdx(reading.book_abbrev);
  const book = idx >= 0 ? bible[idx] : null;
  const bookName = idx >= 0 ? BOOK_NAMES[idx] : (reading.book_abbrev || '').toUpperCase();
  const chapterArr = book?.chapters?.[reading.chapter - 1] ?? null;

  const vs = reading.verse_start ? Number(reading.verse_start) : null;
  const ve = reading.verse_end ? Number(reading.verse_end) : (vs ?? null);
  const rangeLabel = vs ? `${bookName} ${reading.chapter}:${vs}${ve && ve !== vs ? `-${ve}` : ''}` : `${bookName} ${reading.chapter}`;
  const salut = nome ? `Olá, ${nome}!` : '';
  const totalStr = total ? `/${total}` : '';
  const title = reading.title ? `\n_${reading.title}_` : '';
  const header = `${salut ? salut + '\n\n' : ''}📖 *${planTitle}* — Dia ${day}${totalStr}${title}\n\n👉 Leitura de hoje: *${rangeLabel}* _(ARC)_\n`;
  const footer = `\n\n🔗 Abra no app: ${APP_URL}\n— Bíblia Atalaia`;

  if (!chapterArr?.length) {
    return [header + footer];
  }
  const start = vs && vs >= 1 ? vs : 1;
  const end = ve && ve >= start && ve <= chapterArr.length ? ve : chapterArr.length;
  const versesText = [];
  for (let n = start; n <= end; n++) {
    const t = chapterArr[n - 1];
    if (!t) continue;
    versesText.push(`*${n}* ${t}`);
  }
  const body = versesText.join('\n');
  const parts = chunk(body, WA_CHUNK);
  const total_parts = parts.length;
  return parts.map((p, i) => {
    if (total_parts === 1) return `${header}\n${p}${footer}`;
    if (i === 0) return `${header}\n${p}\n\n_(parte 1/${total_parts})_`;
    if (i === total_parts - 1) return `_(parte ${i + 1}/${total_parts})_\n\n${p}${footer}`;
    return `_(parte ${i + 1}/${total_parts})_\n\n${p}`;
  });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { dateKey, timeKey } = brDateParts();
  const url = new URL(req.url);
  const force = url.searchParams.get('force') === '1';
  const onlySubId = url.searchParams.get('sub');

  const { data: subs } = await admin
    .from('atis_plan_subscribers')
    .select('*')
    .eq('active', true);

  if (!subs?.length) return new Response(JSON.stringify({ skipped: true, reason: 'no-subs' }), { headers: corsHeaders });

  const planCache = new Map<string, any>();
  const readingsCache = new Map<string, any[]>();
  const results: any[] = [];

  for (const sub of subs) {
    if (onlySubId && sub.id !== onlySubId) continue;
    if (!force && !onlySubId) {
      if ((sub.send_time ?? '07:00') !== timeKey) continue;
      if (sub.last_sent_date === dateKey) continue;
    }

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
    const messages = await buildMessages(plan.title, reading, nome, day, total);
    let allOk = true;
    let lastStatus = 0;
    for (let i = 0; i < messages.length; i++) {
      const r = await evolutionSendText(sub.phone, messages[i]);
      lastStatus = r.status;
      if (!r.ok) { allOk = false; }
      await admin.from('atis_messages_log').insert({
        direction: 'outbound', wa_to: sub.phone, body: messages[i],
        command: 'plan-reading', status: r.ok ? 'sent' : 'error',
        raw: { plan_id: sub.plan_id, day, part: i + 1, parts: messages.length, http: r.status },
      });
      if (i < messages.length - 1) await sleep(900);
    }
    if (allOk) {
      const nextDay = day + 1;
      const done = nextDay > total;
      await admin.from('atis_plan_subscribers').update({
        current_day: done ? day : nextDay,
        last_sent_date: dateKey,
        active: !done,
      }).eq('id', sub.id);
    }
    results.push({ plan_id: sub.plan_id, phone: sub.phone, day, ok: allOk, parts: messages.length, status: lastStatus });
  }

  return new Response(JSON.stringify({ ok: true, processed: results.length, results }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});