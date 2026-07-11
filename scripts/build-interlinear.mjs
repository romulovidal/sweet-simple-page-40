import fs from 'node:fs';
import path from 'node:path';

const STEP_TO_APP = {
  Gen:'gn',Exo:'ex',Lev:'lv',Num:'nm',Deu:'dt',Jos:'js',Jdg:'jz',Rut:'rt',
  '1Sa':'1sm','2Sa':'2sm','1Ki':'1rs','2Ki':'2rs','1Ch':'1cr','2Ch':'2cr',
  Ezr:'ed',Neh:'ne',Est:'et',Job:'job',Psa:'sl',Pro:'pv',Ecc:'ec',Sng:'ct',
  Isa:'is',Jer:'jr',Lam:'lm',Ezk:'ez',Dan:'dn',Hos:'os',Jol:'jl',Amo:'am',
  Oba:'ob',Jon:'jn',Mic:'mq',Nam:'na',Hab:'hc',Zep:'sf',Hag:'ag',Zec:'zc',Mal:'ml',
  Mat:'mt',Mrk:'mc',Luk:'lc',Jhn:'jo',Act:'at',Rom:'rm',
  '1Co':'1co','2Co':'2co',Gal:'gl',Eph:'ef',Php:'fp',Col:'cl',
  '1Th':'1ts','2Th':'2ts','1Ti':'1tm','2Ti':'2tm',Tit:'tt',Phm:'fm',
  Heb:'hb',Jas:'tg','1Pe':'1pe','2Pe':'2pe','1Jn':'1jo','2Jn':'2jo','3Jn':'3jo',
  Jud:'jd',Rev:'ap'
};

const strongsPt = JSON.parse(fs.readFileSync('/tmp/interlinear/strong-pt.json','utf8'));

// Extract short PT gloss from full definition
function shortPt(entry) {
  if (!entry) return '';
  const d = entry.d || '';
  // Prefer the gloss list after "--" (traditional Strong's format)
  let m = d.match(/--\s*(.+?)(?:\.|$)/);
  if (m) {
    return m[1].split(/[,;]/).map(s=>s.replace(/\[.*?\]/g,'').trim())
      .filter(s=>s && s.length<40).slice(0,3).join(', ');
  }
  // Fallback: last "; something" clause
  const parts = d.split(/[;:]/).map(s=>s.trim()).filter(Boolean);
  return (parts[parts.length-1] || d).slice(0,80);
}

function cleanStrong(raw) {
  if (!raw) return null;
  const m = raw.match(/\{([HG])(\d+)[A-Za-z]?\}/) || raw.match(/([HG])(\d+)/);
  if (!m) return null;
  // Strip leading zeros: H0430 -> H430
  return m[1] + String(parseInt(m[2], 10));
}

function parseFile(filePath, testament) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const chapters = {}; // key: `${app}/${chap}` -> {verses: Map<n, words[]>}
  
  for (const line of lines) {
    if (!line || line.startsWith('#') || line.startsWith('Eng')) continue;
    const cols = line.split('\t');
    if (cols.length < 6) continue;
    const ref = cols[0]; // e.g. Gen.1.1#01=L
    const refMatch = ref.match(/^([1-3]?[A-Za-z]+)\.(\d+)\.(\d+)#/);
    if (!refMatch) continue;
    const [, book, chap, verse] = refMatch;
    const app = STEP_TO_APP[book];
    if (!app) continue;
    
    const original = cols[1]?.replace(/\\.*$/,'').trim();
    const translit = cols[2]?.trim();
    const glossEn = cols[3]?.trim();
    const strong = cleanStrong(cols[4]);
    const grammar = cols[5]?.trim();
    
    if (!original) continue;
    
    const entry = strong ? strongsPt[strong] : null;
    const pt = entry ? shortPt(entry) : '';
    const lemma = entry?.l || '';
    
    const word = { o: original, t: translit, g: glossEn, s: strong || '', pt, l: lemma, m: grammar };
    
    const key = `${app}/${chap}`;
    if (!chapters[key]) chapters[key] = {};
    if (!chapters[key][verse]) chapters[key][verse] = [];
    chapters[key][verse].push(word);
  }
  
  return chapters;
}

const files = [
  '/tmp/interlinear/TAHOT1.txt','/tmp/interlinear/TAHOT2.txt',
  '/tmp/interlinear/TAHOT3.txt','/tmp/interlinear/TAHOT4.txt',
  '/tmp/interlinear/TAGNT1.txt','/tmp/interlinear/TAGNT2.txt'
];

const outDir = 'public/interlinear';
fs.mkdirSync(outDir, { recursive: true });

let totalChapters = 0, totalVerses = 0, totalWords = 0;

for (const f of files) {
  console.log('Parsing', path.basename(f));
  const chapters = parseFile(f);
  for (const [key, verses] of Object.entries(chapters)) {
    const [app, chap] = key.split('/');
    const bookDir = path.join(outDir, app);
    fs.mkdirSync(bookDir, { recursive: true });
    const versesArr = Object.keys(verses).sort((a,b)=>+a-+b).map(n => ({
      n: +n,
      w: verses[n]
    }));
    fs.writeFileSync(path.join(bookDir, `${chap}.json`), JSON.stringify({ verses: versesArr }));
    totalChapters++;
    totalVerses += versesArr.length;
    totalWords += versesArr.reduce((s,v)=>s+v.w.length,0);
  }
}

console.log(`\nDone: ${totalChapters} chapters, ${totalVerses} verses, ${totalWords} words`);
