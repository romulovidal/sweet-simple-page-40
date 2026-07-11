import fs from "node:fs/promises";
import path from "node:path";

const OUT = "/dev-server/public/metarguem";
const ACF_PATH = "/dev-server/public/biblias/ACF.json";

// Ordem canônica idêntica ao ACF (66 livros)
const APIABBR = [
  "gn","ex","lv","nm","dt","js","jz","rt",
  "1sm","2sm","1rs","2rs","1cr","2cr","ed","ne","et","job","sl","pv","ec","ct",
  "is","jr","lm","ez","dn","os","jl","am","ob","jn","mq","na","hc","sf","ag","zc","ml",
  "mt","mc","lc","jo","at","rm","1co","2co","gl","ef","fp","cl","1ts","2ts",
  "1tm","2tm","tt","fm","hb","tg","1pe","2pe","1jo","2jo","3jo","jd","ap",
];

const acf = JSON.parse(await fs.readFile(ACF_PATH, "utf8"));
let written = 0, unmatched = 0;

for (let i = 0; i < acf.length; i++) {
  const abbr = APIABBR[i];
  const book = acf[i];
  const dir = path.join(OUT, abbr);
  try { await fs.access(dir); } catch { continue; }
  for (let ch = 1; ch <= book.chapters.length; ch++) {
    const fp = path.join(dir, `${ch}.json`);
    let data;
    try { data = JSON.parse(await fs.readFile(fp, "utf8")); } catch { continue; }
    const acfVerses = book.chapters[ch - 1]; // array de strings, índice = versículo-1
    const merged = data.verses.map(v => {
      const pt = acfVerses[v.number - 1];
      if (!pt) unmatched++;
      return { ...v, literalPt: pt ? String(pt).trim() : null };
    });
    const out = {
      ...data,
      verses: merged,
      literalPtSource: "ACF",
    };
    await fs.writeFile(fp, JSON.stringify(out));
    written++;
  }
}
console.log(`arquivos atualizados: ${written} | versículos sem correspondência: ${unmatched}`);
