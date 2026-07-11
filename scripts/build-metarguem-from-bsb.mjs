import fs from "node:fs/promises";
import path from "node:path";
import readline from "node:readline";
import { createReadStream } from "node:fs";

const TSV = "/tmp/bsb.tsv";
const OUT = "/dev-server/public/metarguem";

const MAP = {
  "Genesis":"gn","Exodus":"ex","Leviticus":"lv","Numbers":"nm","Deuteronomy":"dt",
  "Joshua":"js","Judges":"jz","Ruth":"rt",
  "1 Samuel":"1sm","2 Samuel":"2sm","1 Kings":"1rs","2 Kings":"2rs",
  "1 Chronicles":"1cr","2 Chronicles":"2cr","Ezra":"ed","Nehemiah":"ne","Esther":"et",
  "Job":"job","Psalm":"sl","Psalms":"sl","Proverbs":"pv","Ecclesiastes":"ec",
  "Song of Solomon":"ct","Song of Songs":"ct",
  "Isaiah":"is","Jeremiah":"jr","Lamentations":"lm","Ezekiel":"ez","Daniel":"dn",
  "Hosea":"os","Joel":"jl","Amos":"am","Obadiah":"ob","Jonah":"jn","Micah":"mq",
  "Nahum":"na","Habakkuk":"hc","Zephaniah":"sf","Haggai":"ag","Zechariah":"zc","Malachi":"ml",
  "Matthew":"mt","Mark":"mc","Luke":"lc","John":"jo","Acts":"at","Romans":"rm",
  "1 Corinthians":"1co","2 Corinthians":"2co","Galatians":"gl","Ephesians":"ef",
  "Philippians":"fp","Colossians":"cl","1 Thessalonians":"1ts","2 Thessalonians":"2ts",
  "1 Timothy":"1tm","2 Timothy":"2tm","Titus":"tt","Philemon":"fm","Hebrews":"hb",
  "James":"tg","1 Peter":"1pe","2 Peter":"2pe","1 John":"1jo","2 John":"2jo","3 John":"3jo",
  "Jude":"jd","Revelation":"ap",
};

function cleanLiteral(s) {
  return s
    .replace(/\bvvv\b/gi, "")               // marcador BSB de adição
    .replace(/[\[\]⧼⧽〈〉‹›\{\}]/g, "")      // colchetes editoriais
    .replace(/\s+-\s+/g, " ")                // hífens isolados
    .replace(/^\s*-\s*/, "")
    .replace(/\s*-\s*$/, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}
function cleanOriginal(s) {
  return s.replace(/[\[\]⧼⧽〈〉‹›\{\}]/g, "").replace(/\s{2,}/g," ").trim();
}

// chapters key -> Map<verseNum, Array<{sort, orig, tr, lit}>>
const chapters = new Map();

const rl = readline.createInterface({ input: createReadStream(TSV), crlfDelay: Infinity });
let header = null, idxHeb, idxGrk, idxLang, idxOrig, idxTr, idxVerseId, idxBsb;
let currentRef = null;

for await (const line of rl) {
  const cols = line.split("\t");
  if (!header) {
    header = cols.map(s=>s.trim());
    idxHeb = header.indexOf("Heb Sort");
    idxGrk = header.indexOf("Greek Sort");
    idxLang = header.indexOf("Language");
    idxOrig = header.findIndex(h => h.startsWith("WLC / Nestle Base TR RP WH NE NA SBL"));
    idxTr = header.indexOf("Translit");
    idxVerseId = header.indexOf("VerseId");
    idxBsb = header.findIndex(h => h.trim() === "BSB version");
    continue;
  }
  const verseId = (cols[idxVerseId]||"").trim();
  const lang = (cols[idxLang]||"").trim();
  const orig = (cols[idxOrig]||"").trim();
  const tr = (cols[idxTr]||"").trim();
  const bsb = (cols[idxBsb]||"").trim();
  const hebSort = Number(cols[idxHeb]||0);
  const grkSort = Number(cols[idxGrk]||0);
  const sort = (lang === "Greek") ? grkSort : hebSort;

  if (verseId) {
    const m = verseId.match(/^(.+?)\s+(\d+):(\d+)$/);
    if (!m) { currentRef = null; continue; }
    const abbr = MAP[m[1]];
    if (!abbr) { currentRef = null; continue; }
    currentRef = { abbr, ch: Number(m[2]), v: Number(m[3]) };
  }
  if (!currentRef) continue;
  const key = `${currentRef.abbr}/${currentRef.ch}`;
  let chMap = chapters.get(key);
  if (!chMap) { chMap = new Map(); chapters.set(key, chMap); }
  let arr = chMap.get(currentRef.v);
  if (!arr) { arr = []; chMap.set(currentRef.v, arr); }
  arr.push({ sort, orig, tr, lit: bsb });
}

let written = 0;
for (const [key, chMap] of chapters) {
  const [abbr, ch] = key.split("/");
  const verses = [];
  for (const [num, arr] of [...chMap.entries()].sort((a,b)=>a[0]-b[0])) {
    // Original + transliteration: ordem hebraica/grega (sort asc)
    const bySort = [...arr].sort((a,b)=>a.sort-b.sort);
    const original = cleanOriginal(bySort.map(x=>x.orig).filter(Boolean).join(" "));
    const translit = bySort.map(x=>x.tr).filter(Boolean).join(" ").replace(/\s+/g," ").trim();
    // Literal: ordem BSB (ordem de leitura em inglês, como veio)
    const literal = cleanLiteral(arr.map(x=>x.lit).filter(Boolean).join(" "));
    verses.push({ number: num, original, transliteration: translit, literal });
  }
  const dir = path.join(OUT, abbr);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, `${ch}.json`), JSON.stringify({ verses, source: "BSB" }));
  written++;
}
console.log("JSONs escritos:", written);
