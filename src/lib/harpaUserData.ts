// Persistência local de favoritos e histórico da Harpa Cristã.
// Tudo em localStorage — 100% offline, sem backend.

const FAV_KEY = "harpa:favorites";
const HIST_KEY = "harpa:history";
const HIST_LIMIT = 30;

export interface HarpaHistoryEntry {
  number: number;
  at: number; // epoch ms
}

function readSet(): Set<number> {
  try {
    const raw = localStorage.getItem(FAV_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return new Set();
    return new Set(arr.filter((n) => typeof n === "number"));
  } catch {
    return new Set();
  }
}

export function getFavorites(): number[] {
  return Array.from(readSet()).sort((a, b) => a - b);
}

export function isFavorite(n: number): boolean {
  return readSet().has(n);
}

export function toggleFavorite(n: number): boolean {
  const s = readSet();
  if (s.has(n)) s.delete(n);
  else s.add(n);
  try {
    localStorage.setItem(FAV_KEY, JSON.stringify(Array.from(s)));
  } catch {}
  window.dispatchEvent(new Event("harpa:favorites-changed"));
  return s.has(n);
}

export function getHistory(): HarpaHistoryEntry[] {
  try {
    const raw = localStorage.getItem(HIST_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.filter(
      (e) => e && typeof e.number === "number" && typeof e.at === "number"
    );
  } catch {
    return [];
  }
}

export function pushHistory(n: number) {
  const list = getHistory().filter((e) => e.number !== n);
  list.unshift({ number: n, at: Date.now() });
  const trimmed = list.slice(0, HIST_LIMIT);
  try {
    localStorage.setItem(HIST_KEY, JSON.stringify(trimmed));
  } catch {}
  window.dispatchEvent(new Event("harpa:history-changed"));
}

export function clearHistory() {
  try {
    localStorage.removeItem(HIST_KEY);
  } catch {}
  window.dispatchEvent(new Event("harpa:history-changed"));
}