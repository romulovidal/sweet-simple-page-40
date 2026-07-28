// Persistência local de favoritos e histórico de Cânticos (mesmo padrão da Harpa).
const FAV_KEY = "canticos:favorites";
const HIST_KEY = "canticos:history";
const HIST_LIMIT = 30;

export interface CanticoHistoryEntry { id: string; at: number }

function readSet(): Set<string> {
  try {
    const raw = localStorage.getItem(FAV_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return new Set();
    return new Set(arr.filter((s) => typeof s === "string"));
  } catch { return new Set(); }
}

export function getFavorites(): string[] {
  return Array.from(readSet());
}
export function isFavorite(id: string): boolean {
  return readSet().has(id);
}
export function toggleFavorite(id: string): boolean {
  const s = readSet();
  if (s.has(id)) s.delete(id); else s.add(id);
  try { localStorage.setItem(FAV_KEY, JSON.stringify(Array.from(s))); } catch {}
  window.dispatchEvent(new Event("canticos:favorites-changed"));
  return s.has(id);
}

export function getHistory(): CanticoHistoryEntry[] {
  try {
    const raw = localStorage.getItem(HIST_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.filter((e) => e && typeof e.id === "string" && typeof e.at === "number");
  } catch { return []; }
}
export function pushHistory(id: string) {
  const list = getHistory().filter((e) => e.id !== id);
  list.unshift({ id, at: Date.now() });
  try { localStorage.setItem(HIST_KEY, JSON.stringify(list.slice(0, HIST_LIMIT))); } catch {}
  window.dispatchEvent(new Event("canticos:history-changed"));
}