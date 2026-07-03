import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { readJsonStorage, writeJsonStorage } from "@/lib/localData";
import {
  getToday,
  updateStreak,
  type StreakData,
} from "@/hooks/useLocalStorage";

const DEVICE_ID_KEY = "device-id";
const STREAK_KEY = "streak";
const LAST_MARK_KEY = "streak-last-mark";

function getOrCreateDeviceId(): string {
  let id = readJsonStorage<string | null>(DEVICE_ID_KEY, null);
  if (!id) {
    id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `dev-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    writeJsonStorage(DEVICE_ID_KEY, id);
  }
  return id;
}

async function markLoggedUser(userId: string, streak: StreakData) {
  try {
    await supabase.from("user_streaks").upsert(
      {
        user_id: userId,
        current_streak: streak.current,
        last_read_date: streak.lastDate || null,
        history: streak.history,
      },
      { onConflict: "user_id" }
    );
  } catch (e) {
    console.error("[streak] upsert user_streaks failed", e);
  }
}

async function markDevice(deviceId: string, streak: StreakData) {
  try {
    await supabase.from("device_streaks").upsert(
      {
        device_id: deviceId,
        current_streak: streak.current,
        last_seen_date: streak.lastDate || null,
        history: streak.history,
        user_agent:
          typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 250) : null,
      },
      { onConflict: "device_id" }
    );
  } catch (e) {
    console.error("[streak] upsert device_streaks failed", e);
  }
}

async function runMark() {
  const today = getToday();
  const lastMark = readJsonStorage<string>(LAST_MARK_KEY, "");
  const current = readJsonStorage<StreakData>(STREAK_KEY, {
    current: 0,
    lastDate: "",
    history: [],
  });

  // Always update local streak (idempotent — updateStreak no-ops if today already in history)
  const next = updateStreak(current);
  writeJsonStorage(STREAK_KEY, next);
  writeJsonStorage(LAST_MARK_KEY, today);

  // Sync to backend (skip if we already synced today AND streak didn't change)
  const alreadySyncedToday = lastMark === today && next.history.length === current.history.length;

  const { data } = await supabase.auth.getSession();
  const userId = data.session?.user?.id ?? null;

  if (userId) {
    if (!alreadySyncedToday) await markLoggedUser(userId, next);
  } else {
    const deviceId = getOrCreateDeviceId();
    if (!alreadySyncedToday) await markDevice(deviceId, next);
  }
}

/**
 * Marks the current day as an "app open" for streak tracking.
 * - Logged in → upserts `user_streaks`
 * - Anonymous → upserts `device_streaks` using a locally-stored device id
 * Runs once on mount and again whenever the tab becomes visible.
 */
export function useDailyOpenTracker() {
  useEffect(() => {
    void runMark();

    const onVisibility = () => {
      if (document.visibilityState === "visible") void runMark();
    };
    const onAuth = supabase.auth.onAuthStateChange(() => {
      void runMark();
    });

    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      onAuth.data.subscription.unsubscribe();
    };
  }, []);
}