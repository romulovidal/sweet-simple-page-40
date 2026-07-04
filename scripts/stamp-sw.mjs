#!/usr/bin/env node
// Substitui __BUILD_VERSION__ no service worker gerado por um valor único a cada build.
// Assim o navegador detecta mudança em /sw.js e dispara o fluxo de auto-update.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const target = resolve(process.cwd(), "dist/sw.js");

if (!existsSync(target)) {
  console.warn("[stamp-sw] dist/sw.js não encontrado — pulando.");
  process.exit(0);
}

const version = `v-${Date.now()}`;
const source = readFileSync(target, "utf8");

if (!source.includes("__BUILD_VERSION__")) {
  console.warn("[stamp-sw] placeholder __BUILD_VERSION__ ausente — sw.js já está estampado?");
  process.exit(0);
}

const stamped = source.replaceAll("__BUILD_VERSION__", version);
writeFileSync(target, stamped, "utf8");
console.log(`[stamp-sw] sw.js estampado com ${version}`);