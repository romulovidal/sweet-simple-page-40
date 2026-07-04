import { useCallback, useEffect, useState } from "react";
import type { EntityKind, EntityRef } from "../types";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "./useCloudSync";

const KEY = "historia_viva_favs_v1";
type FavMap = Record<string, true>;
const k = (kind: EntityKind, id: string) => `${kind}:${id}`;

function readLocal(): FavMap {
  try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch { return {}; }
}
function writeLocal(f: FavMap) {
  try { localStorage.setItem(KEY, JSON.stringify(f)); } catch {}
}

export function useFavorites() {
  const userId = useSession();
  const [favs, setFavs] = useState<FavMap>({});

  // Load
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!userId) { setFavs(readLocal()); return; }
      // Migrate local → cloud one-shot
      const local = readLocal();
      const localKeys = Object.keys(local);
      if (localKeys.length) {
        const rows = localKeys.map((key) => {
          const [kind, ...rest] = key.split(":");
          return { user_id: userId, kind, ref_id: rest.join(":") };
        });
        await supabase.from("historia_favorites").upsert(rows, { onConflict: "user_id,kind,ref_id" });
        try { localStorage.removeItem(KEY); } catch {}
      }
      const { data } = await supabase.from("historia_favorites").select("kind, ref_id").eq("user_id", userId);
      if (cancelled) return;
      const m: FavMap = {};
      (data ?? []).forEach((r: any) => { m[k(r.kind, r.ref_id)] = true; });
      setFavs(m);
    })();
    return () => { cancelled = true; };
  }, [userId]);

  const isFav = useCallback((kind: EntityKind, id: string) => !!favs[k(kind, id)], [favs]);

  const toggle = useCallback(async (kind: EntityKind, id: string) => {
    const key = k(kind, id);
    const currentlyFav = !!favs[key];
    // Optimistic
    setFavs((prev) => {
      const next = { ...prev };
      if (currentlyFav) delete next[key]; else next[key] = true;
      if (!userId) writeLocal(next);
      return next;
    });
    if (!userId) return;
    if (currentlyFav) {
      await supabase.from("historia_favorites").delete().eq("user_id", userId).eq("kind", kind).eq("ref_id", id);
    } else {
      await supabase.from("historia_favorites").insert({ user_id: userId, kind, ref_id: id });
    }
  }, [favs, userId]);

  const list = useCallback((): EntityRef[] => {
    return Object.keys(favs).map((key) => {
      const [kind, ...rest] = key.split(":");
      return { kind: kind as EntityKind, id: rest.join(":") };
    });
  }, [favs]);

  return { isFav, toggle, favs, list, isSignedIn: !!userId };
}
