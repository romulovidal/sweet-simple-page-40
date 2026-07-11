// Gera arquivos offline do Modo Metarguem em public/metarguem/{apiAbbrev}/{chapter}.json
//
// Uso:
//   SUPABASE_URL=... SUPABASE_ANON_KEY=... node scripts/generate-metarguem.mjs [--only=jo] [--from=1] [--to=999] [--force]
//
// - Pula capítulos que já existem (a menos que --force).
// - Faz backoff em 429 e continua após erros isolados.
// - Pode rodar em várias sessões: cada capítulo salvo é definitivo.

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, "..", "public", "metarguem");

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const ANON = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
if (!SUPABASE_URL || !ANON) {
  console.error("Defina SUPABASE_URL e SUPABASE_ANON_KEY no ambiente.");
  process.exit(1);
}

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? true];
  })
);
const ONLY = typeof args.only === "string" ? args.only.toLowerCase() : null;
const FROM = args.from ? Number(args.from) : 1;
const TO = args.to ? Number(args.to) : 9999;
const FORCE = !!args.force;

// Espelho enxuto de src/data/bible.ts (só o necessário para gerar).
const BOOKS = [
  ["gn",50],["ex",40],["lv",27],["nm",36],["dt",34],["js",24],["jz",21],["rt",4],
  ["1sm",31],["2sm",24],["1rs",22],["2rs",25],["1cr",29],["2cr",36],["ed",10],["ne",13],
  ["et",10],["job",42],["sl",150],["pv",31],["ec",12],["ct",8],["is",66],["jr",52],
  ["lm",5],["ez",48],["dn",12],["os",14],["jl",3],["am",9],["ob",1],["jn",4],["mq",7],
  ["na",3],["hc",3],["sf",3],["ag",2],["zc",14],["ml",4],
  ["mt",28],["mc",16],["lc",24],["jo",21],["at",28],["rm",16],["1co",16],["2co",13],
  ["gl",6],["ef",6],["fp",4],["cl",4],["1ts",5],["2ts",3],["1tm",6],["2tm",4],["tt",3],
  ["fm",1],["hb",13],["tg",5],["1pe",5],["2pe",3],["1jo",5],["2jo",1],["3jo",1],["jd",1],["ap",22],
];

async function loadChapterVerses(apiAbbrev, chapter) {
  // Usa a ARC estática do próprio app.
  const p = path.resolve(__dirname, "..", "public", "biblias", "ARC.json");
  const raw = JSON.parse(await fs.readFile(p, "utf8"));
  const book = raw.find((b) => b.abbrev?.pt === apiAbbrev || b.abbrev === apiAbbrev);
  if (!book) throw new Error(`Livro ${apiAbbrev} não achado em ARC.json`);
  const ch = book.chapters?.[chapter - 1];
  if (!ch) throw new Error(`Cap ${chapter} não achado em ${apiAbbrev}`);
  return ch.map((text, i) => ({ number: i + 1, text }));
}

async function callTargum(bookName, chapter, verses) {
  const numbers = verses.map((v) => v.number);
  const payloadText =
    `Referência: ${bookName} ${chapter}\n` +
    `Versículos solicitados (números): ${numbers.join(", ")}\n\n` +
    `Texto em português (apenas para orientação — devolva original + transliteração + literal):\n` +
    verses.map((v) => `${v.number} ${v.text}`).join("\n");

  const res = await fetch(`${SUPABASE_URL}/functions/v1/ai-tools`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: ANON,
      Authorization: `Bearer ${ANON}`,
    },
    body: JSON.stringify({ tool: "targum", reference: `${bookName} ${chapter}`, text: payloadText }),
  });
  if (res.status === 429) {
    const retry = Number(res.headers.get("retry-after") || 30);
    throw Object.assign(new Error("rate_limited"), { retry });
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  const j = await res.json();
  const raw = j.result || "{}";
  const parsed = safeJson(raw);
  const list = Array.isArray(parsed?.verses) ? parsed.verses : [];
  if (list.length === 0) throw new Error("Zero versículos retornados");
  return { verses: list };
}

function safeJson(s) {
  s = String(s).trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  const a = s.indexOf("{"), b = s.lastIndexOf("}");
  if (a >= 0 && b > a) s = s.slice(a, b + 1);
  try { return JSON.parse(s); } catch {}
  const cleaned = s.replace(/,\s*}/g, "}").replace(/,\s*]/g, "]").replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "");
  try { return JSON.parse(cleaned); } catch {}
  let f = cleaned;
  f += "]".repeat(Math.max(0, ((f.match(/\[/g)||[]).length) - ((f.match(/\]/g)||[]).length)));
  f += "}".repeat(Math.max(0, ((f.match(/\{/g)||[]).length) - ((f.match(/\}/g)||[]).length)));
  return JSON.parse(f);
}

function displayName(apiAbbrev) {
  const NAMES = {
    gn:"Gênesis",ex:"Êxodo",lv:"Levítico",nm:"Números",dt:"Deuteronômio",js:"Josué",jz:"Juízes",rt:"Rute",
    "1sm":"1 Samuel","2sm":"2 Samuel","1rs":"1 Reis","2rs":"2 Reis","1cr":"1 Crônicas","2cr":"2 Crônicas",
    ed:"Esdras",ne:"Neemias",et:"Ester",job:"Jó",sl:"Salmos",pv:"Provérbios",ec:"Eclesiastes",ct:"Cantares",
    is:"Isaías",jr:"Jeremias",lm:"Lamentações",ez:"Ezequiel",dn:"Daniel",os:"Oséias",jl:"Joel",am:"Amós",
    ob:"Obadias",jn:"Jonas",mq:"Miquéias",na:"Naum",hc:"Habacuque",sf:"Sofonias",ag:"Ageu",zc:"Zacarias",ml:"Malaquias",
    mt:"Mateus",mc:"Marcos",lc:"Lucas",jo:"João",at:"Atos",rm:"Romanos","1co":"1 Coríntios","2co":"2 Coríntios",
    gl:"Gálatas",ef:"Efésios",fp:"Filipenses",cl:"Colossenses","1ts":"1 Tessalonicenses","2ts":"2 Tessalonicenses",
    "1tm":"1 Timóteo","2tm":"2 Timóteo",tt:"Tito",fm:"Filemom",hb:"Hebreus",tg:"Tiago","1pe":"1 Pedro","2pe":"2 Pedro",
    "1jo":"1 João","2jo":"2 João","3jo":"3 João",jd:"Judas",ap:"Apocalipse",
  };
  return NAMES[apiAbbrev] || apiAbbrev;
}

async function main() {
  let done = 0, skipped = 0, failed = 0;
  for (const [abbr, chapters] of BOOKS) {
    if (ONLY && ONLY !== abbr) continue;
    const dir = path.join(OUT_DIR, abbr);
    await fs.mkdir(dir, { recursive: true });
    for (let ch = 1; ch <= chapters; ch++) {
      if (ch < FROM || ch > TO) continue;
      const out = path.join(dir, `${ch}.json`);
      if (!FORCE) {
        try { await fs.access(out); skipped++; continue; } catch {}
      }
      const bookName = displayName(abbr);
      process.stdout.write(`→ ${bookName} ${ch} ... `);
      let attempt = 0;
      while (true) {
        try {
          const verses = await loadChapterVerses(abbr, ch);
          const data = await callTargum(bookName, ch, verses);
          await fs.writeFile(out, JSON.stringify(data));
          done++;
          console.log(`ok (${data.verses.length}v)`);
          break;
        } catch (e) {
          attempt++;
          if (e.message === "rate_limited" && attempt < 6) {
            const wait = (e.retry || 30) * 1000;
            console.log(`rate limit, aguardando ${wait/1000}s`);
            await new Promise((r) => setTimeout(r, wait));
            continue;
          }
          if (attempt < 3) {
            console.log(`erro (${e.message}), retry`);
            await new Promise((r) => setTimeout(r, 5000));
            continue;
          }
          failed++;
          console.log(`FALHOU: ${e.message}`);
          break;
        }
      }
      // Pequeno delay entre chamadas para não estourar rate limit
      await new Promise((r) => setTimeout(r, 1500));
    }
  }
  console.log(`\nConcluído: ${done} gerados, ${skipped} pulados, ${failed} falhas.`);
}

main().catch((e) => { console.error(e); process.exit(1); });