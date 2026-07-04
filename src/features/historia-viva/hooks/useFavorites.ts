import { useCallback, useEffect, useState } from "react";
import type { EntityKind } from "../types";

const KEY = "historia_viva_favs_v1";
type FavMap = Record<string, true>;

function read(): FavMap {
  try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch { return {}; }
}
function write(f: FavMap) {
  try { localStorage.setItem(KEY, JSON.stringify(f)); } catch {}
}

export function useFavorites() {
  const [favs, setFavs] = useState<FavMap>({});
  useEffect(() => setFavs(read()), []);
  const key = (k: EntityKind, id: string) => `${k}:${id}`;
  const isFav = useCallback((k: EntityKind, id: string) => !!favs[key(k, id)], [favs]);
  const toggle = useCallback((k: EntityKind, id: string) => {
    setFavs((prev) => {
      const next = { ...prev };
      const kk = key(k, id);
      if (next[kk]) delete next[kk]; else next[kk] = true;
      write(next);
      return next;
    });
  }, []);
  return { isFav, toggle, favs };
}
