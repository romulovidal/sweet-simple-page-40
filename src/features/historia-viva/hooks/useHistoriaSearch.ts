import { useMemo } from "react";
import { CHARACTERS } from "../data/characters";
import { EVENTS } from "../data/events";
import { PLACES } from "../data/places";
import { BOOKS } from "../data/books";
import type { EntityKind } from "../types";

export interface SearchHit {
  kind: EntityKind;
  id: string;
  label: string;
  sub?: string;
  icon?: string;
  score: number;
}

function norm(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function useHistoriaSearch(query: string, filters: string[] = []) {
  return useMemo<SearchHit[]>(() => {
    const q = norm(query.trim());
    if (!q) return [];
    const hits: SearchHit[] = [];
    for (const c of CHARACTERS) {
      if (filters.length && !c.tags.some((t) => filters.includes(t))) continue;
      const hay = norm(`${c.name} ${c.meaning ?? ""} ${c.bio}`);
      if (hay.includes(q)) hits.push({ kind: "character", id: c.id, label: c.name, sub: c.meaning, icon: c.icon, score: hay.startsWith(q) ? 3 : 2 });
    }
    if (!filters.length) {
      for (const e of EVENTS) {
        const hay = norm(`${e.name} ${e.description}`);
        if (hay.includes(q)) hits.push({ kind: "event", id: e.id, label: e.name, sub: e.description, icon: e.icon, score: hay.startsWith(q) ? 3 : 2 });
      }
      for (const p of PLACES) {
        const hay = norm(`${p.name} ${p.region ?? ""}`);
        if (hay.includes(q)) hits.push({ kind: "place", id: p.id, label: p.name, sub: p.region, icon: "📍", score: 1 });
      }
      for (const b of BOOKS) {
        const hay = norm(`${b.name} ${b.abbrev}`);
        if (hay.includes(q)) hits.push({ kind: "book", id: b.id, label: b.name, sub: b.theme, icon: "📖", score: 1 });
      }
    }
    return hits.sort((a, b) => b.score - a.score).slice(0, 40);
  }, [query, filters]);
}
