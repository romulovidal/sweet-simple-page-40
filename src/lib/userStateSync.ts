import { supabase } from "@/integrations/supabase/client";
import { emitLocalDataChanged, readJsonStorage, writeJsonStorage } from "@/lib/localData";
import type {
  DailyVerseEntry,
  HighlightedVerse,
  ReadingProgress,
  SavedVerse,
  StreakData,
} from "@/hooks/useLocalStorage";

export interface LocalPlanProgress {
  planId: string;
  completedDays: number[];
  startedAt: string;
}

export interface LocalAppState {
  savedVerses: SavedVerse[];
  highlightedVerses: HighlightedVerse[];
  readingProgress: ReadingProgress | null;
  streak: StreakData;
  planProgress: LocalPlanProgress[];
  dailyVerseHistory: DailyVerseEntry[];
  selectedPlan: string | null;
  bibleVersion: string;
}

export const LOCAL_APP_STATE_KEYS = {
  savedVerses: "saved-verses",
  highlightedVerses: "highlighted-verses",
  readingProgress: "reading-progress",
  streak: "streak",
  planProgress: "plan-progress",
  dailyVerseHistory: "daily-verse-history",
  selectedPlan: "selected-plan",
  bibleVersion: "bible-version",
} as const;

const DEFAULT_STATE: LocalAppState = {
  savedVerses: [],
  highlightedVerses: [],
  readingProgress: null,
  streak: { current: 0, lastDate: "", history: [] },
  planProgress: [],
  dailyVerseHistory: [],
  selectedPlan: null,
  bibleVersion: "nvi",
};

function uniqStrings(values: string[]) {
  return [...new Set(values)].filter(Boolean).sort();
}

function computeCurrentStreak(history: string[], lastDate: string) {
  if (!lastDate) return 0;

  const uniqueHistory = new Set(history);
  let current = 0;
  const cursor = new Date(`${lastDate}T00:00:00`);

  while (true) {
    const key = cursor.toISOString().split("T")[0];
    if (!uniqueHistory.has(key)) break;
    current += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return current;
}

function mergeSavedVerses(local: SavedVerse[], remote: SavedVerse[]) {
  const merged = new Map<string, SavedVerse>();

  for (const verse of [...remote, ...local]) {
    const current = merged.get(verse.reference);
    if (!current) {
      merged.set(verse.reference, verse);
      continue;
    }

    const currentTime = Date.parse(current.savedAt || "");
    const nextTime = Date.parse(verse.savedAt || "");
    const useNext = Number.isNaN(currentTime) || (!Number.isNaN(nextTime) && nextTime >= currentTime);

    merged.set(verse.reference, {
      ...(useNext ? current : verse),
      ...(useNext ? verse : current),
      highlightColor: verse.highlightColor || current.highlightColor,
    });
  }

  return [...merged.values()].sort((a, b) => b.savedAt.localeCompare(a.savedAt));
}

function mergeHighlights(local: HighlightedVerse[], remote: HighlightedVerse[]) {
  const merged = new Map<string, HighlightedVerse>();

  for (const highlight of remote) {
    merged.set(highlight.reference, highlight);
  }

  for (const highlight of local) {
    merged.set(highlight.reference, highlight);
  }

  return [...merged.values()];
}

function mergeReadingProgress(local: ReadingProgress | null, remote: ReadingProgress | null) {
  if (!local) return remote;
  if (!remote) return local;

  const localTime = Date.parse(local.lastRead || "");
  const remoteTime = Date.parse(remote.lastRead || "");
  if (Number.isNaN(remoteTime)) return local;
  if (Number.isNaN(localTime)) return remote;

  return localTime >= remoteTime ? local : remote;
}

function mergePlanProgress(local: LocalPlanProgress[], remote: LocalPlanProgress[]) {
  const merged = new Map<string, LocalPlanProgress>();

  for (const item of [...remote, ...local]) {
    const current = merged.get(item.planId);
    if (!current) {
      merged.set(item.planId, {
        planId: item.planId,
        completedDays: [...new Set(item.completedDays)].sort((a, b) => a - b),
        startedAt: item.startedAt,
      });
      continue;
    }

    merged.set(item.planId, {
      planId: item.planId,
      completedDays: [...new Set([...current.completedDays, ...item.completedDays])].sort((a, b) => a - b),
      startedAt: current.startedAt && item.startedAt
        ? (Date.parse(current.startedAt) <= Date.parse(item.startedAt) ? current.startedAt : item.startedAt)
        : current.startedAt || item.startedAt,
    });
  }

  return [...merged.values()];
}

function mergeDailyVerseHistory(local: DailyVerseEntry[], remote: DailyVerseEntry[]) {
  const merged = new Map<string, DailyVerseEntry>();

  for (const item of [...remote, ...local]) {
    merged.set(item.date, item);
  }

  return [...merged.values()].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 180);
}

function normalizeState(raw: unknown): LocalAppState {
  const state = raw && typeof raw === "object" ? (raw as Partial<LocalAppState>) : {};

  return {
    savedVerses: Array.isArray(state.savedVerses) ? state.savedVerses as SavedVerse[] : DEFAULT_STATE.savedVerses,
    highlightedVerses: Array.isArray(state.highlightedVerses) ? state.highlightedVerses as HighlightedVerse[] : DEFAULT_STATE.highlightedVerses,
    readingProgress: state.readingProgress && typeof state.readingProgress === "object"
      ? state.readingProgress as ReadingProgress
      : DEFAULT_STATE.readingProgress,
    streak: state.streak && typeof state.streak === "object"
      ? {
          current: Number((state.streak as StreakData).current || 0),
          lastDate: (state.streak as StreakData).lastDate || "",
          history: Array.isArray((state.streak as StreakData).history) ? (state.streak as StreakData).history : [],
        }
      : DEFAULT_STATE.streak,
    planProgress: Array.isArray(state.planProgress) ? state.planProgress as LocalPlanProgress[] : DEFAULT_STATE.planProgress,
    dailyVerseHistory: Array.isArray(state.dailyVerseHistory) ? state.dailyVerseHistory as DailyVerseEntry[] : DEFAULT_STATE.dailyVerseHistory,
    selectedPlan: typeof state.selectedPlan === "string" || state.selectedPlan === null ? state.selectedPlan ?? null : DEFAULT_STATE.selectedPlan,
    bibleVersion: typeof state.bibleVersion === "string" ? state.bibleVersion : DEFAULT_STATE.bibleVersion,
  };
}

export function readLocalAppState(): LocalAppState {
  return {
    savedVerses: readJsonStorage(LOCAL_APP_STATE_KEYS.savedVerses, DEFAULT_STATE.savedVerses),
    highlightedVerses: readJsonStorage(LOCAL_APP_STATE_KEYS.highlightedVerses, DEFAULT_STATE.highlightedVerses),
    readingProgress: readJsonStorage(LOCAL_APP_STATE_KEYS.readingProgress, DEFAULT_STATE.readingProgress),
    streak: readJsonStorage(LOCAL_APP_STATE_KEYS.streak, DEFAULT_STATE.streak),
    planProgress: readJsonStorage(LOCAL_APP_STATE_KEYS.planProgress, DEFAULT_STATE.planProgress),
    dailyVerseHistory: readJsonStorage(LOCAL_APP_STATE_KEYS.dailyVerseHistory, DEFAULT_STATE.dailyVerseHistory),
    selectedPlan: readJsonStorage(LOCAL_APP_STATE_KEYS.selectedPlan, DEFAULT_STATE.selectedPlan),
    bibleVersion: readJsonStorage(LOCAL_APP_STATE_KEYS.bibleVersion, DEFAULT_STATE.bibleVersion),
  };
}

export function writeLocalAppState(state: LocalAppState) {
  writeJsonStorage(LOCAL_APP_STATE_KEYS.savedVerses, state.savedVerses, false);
  writeJsonStorage(LOCAL_APP_STATE_KEYS.highlightedVerses, state.highlightedVerses, false);
  writeJsonStorage(LOCAL_APP_STATE_KEYS.readingProgress, state.readingProgress, false);
  writeJsonStorage(LOCAL_APP_STATE_KEYS.streak, state.streak, false);
  writeJsonStorage(LOCAL_APP_STATE_KEYS.planProgress, state.planProgress, false);
  writeJsonStorage(LOCAL_APP_STATE_KEYS.dailyVerseHistory, state.dailyVerseHistory, false);
  writeJsonStorage(LOCAL_APP_STATE_KEYS.selectedPlan, state.selectedPlan, false);
  writeJsonStorage(LOCAL_APP_STATE_KEYS.bibleVersion, state.bibleVersion, false);
  emitLocalDataChanged({ source: "hydrate" });
}

export function mergeLocalAppState(local: LocalAppState, remote: LocalAppState): LocalAppState {
  const mergedHistory = uniqStrings([...remote.streak.history, ...local.streak.history]);
  const lastDate = [local.streak.lastDate, remote.streak.lastDate].filter(Boolean).sort().at(-1) || "";

  return {
    savedVerses: mergeSavedVerses(local.savedVerses, remote.savedVerses),
    highlightedVerses: mergeHighlights(local.highlightedVerses, remote.highlightedVerses),
    readingProgress: mergeReadingProgress(local.readingProgress, remote.readingProgress),
    streak: {
      history: mergedHistory,
      lastDate,
      current: computeCurrentStreak(mergedHistory, lastDate),
    },
    planProgress: mergePlanProgress(local.planProgress, remote.planProgress),
    dailyVerseHistory: mergeDailyVerseHistory(local.dailyVerseHistory, remote.dailyVerseHistory),
    selectedPlan: local.selectedPlan ?? remote.selectedPlan,
    bibleVersion: local.bibleVersion || remote.bibleVersion || DEFAULT_STATE.bibleVersion,
  };
}

export async function loadRemoteUserState(userId: string): Promise<LocalAppState | null> {
  const { data, error } = await supabase
    .from("user_sync_state")
    .select("state")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data?.state) return null;
  return normalizeState(data.state);
}

export async function saveRemoteUserState(userId: string, snapshot = readLocalAppState()) {
  const { error } = await supabase
    .from("user_sync_state")
    .upsert(
      {
        user_id: userId,
        state: snapshot,
      },
      { onConflict: "user_id" }
    );

  if (error) throw error;
}

export async function hydrateAndSyncUserState(userId: string) {
  const local = readLocalAppState();
  const remote = (await loadRemoteUserState(userId)) ?? DEFAULT_STATE;
  const merged = mergeLocalAppState(local, remote);

  writeLocalAppState(merged);

  if (navigator.onLine) {
    await saveRemoteUserState(userId, merged);
  }

  return merged;
}
