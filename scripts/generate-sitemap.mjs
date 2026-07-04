#!/usr/bin/env node
// Gera public/sitemap.xml dinamicamente a partir de src/data/bible.ts.
// Executado no prebuild.

import { writeFileSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const SITE = process.env.SITE_URL || "https://biblia.atalaias.online";

// Parse leve do arquivo TS — extrai apiAbbrev e chapters sem precisar de TS runtime.
const src = readFileSync(resolve(ROOT, "src/data/bible.ts"), "utf8");
const bookRe = /apiAbbrev:\s*"([^"]+)",\s*chapters:\s*(\d+)/g;
const books = [];
let m;
while ((m = bookRe.exec(src)) !== null) {
  books.push({ abbrev: m[1], chapters: Number(m[2]) });
}

if (books.length === 0) {
  console.error("[sitemap] Nenhum livro extraído de src/data/bible.ts — abortando.");
  process.exit(1);
}

const today = new Date().toISOString().slice(0, 10);

const staticRoutes = [
  { path: "/", changefreq: "daily", priority: "1.0" },
  { path: "/biblia", changefreq: "daily", priority: "0.9" },
  { path: "/planos", changefreq: "weekly", priority: "0.8" },
  { path: "/descubra", changefreq: "weekly", priority: "0.8" },
  { path: "/manual", changefreq: "monthly", priority: "0.6" },
];

const urls = [];

for (const r of staticRoutes) {
  urls.push(`  <url>
    <loc>${SITE}${r.path}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${r.changefreq}</changefreq>
    <priority>${r.priority}</priority>
  </url>`);
}

// Uma URL por livro (capítulo 1) — prioridade média
for (const b of books) {
  urls.push(`  <url>
    <loc>${SITE}/biblia?book=${b.abbrev}&amp;chapter=1</loc>
    <lastmod>${today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>`);
}

// Uma URL por capítulo — prioridade menor
for (const b of books) {
  for (let c = 1; c <= b.chapters; c++) {
    urls.push(`  <url>
    <loc>${SITE}/biblia?book=${b.abbrev}&amp;chapter=${c}</loc>
    <changefreq>monthly</changefreq>
    <priority>0.5</priority>
  </url>`);
  }
}

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join("\n")}
</urlset>
`;

writeFileSync(resolve(ROOT, "public/sitemap.xml"), xml, "utf8");
console.log(`[sitemap] Gerado com ${urls.length} URLs (${books.length} livros).`);