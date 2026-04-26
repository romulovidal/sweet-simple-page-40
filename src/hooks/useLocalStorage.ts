 import { useCallback, useEffect, useRef, useState } from "react";
 import { LOCAL_DATA_CHANGED_EVENT, readJsonStorage, writeJsonStorage } from "@/lib/localData";
 import { supabase } from "@/integrations/supabase/client";
 import { toast } from "sonner";

function readLocalStorageValue<T>(key: string, initialValue: T): T {
  return readJsonStorage(key, initialValue);
}

export function useLocalStorage<T>(key: string, initialValue: T) {
  const initialValueRef = useRef(initialValue);
  const readValue = useCallback(() => readLocalStorageValue(key, initialValueRef.current), [key]);
  const [storedValue, setStoredValue] = useState<T>(readValue);

  const setValue = useCallback(
    (value: T | ((val: T) => T)) => {
      setStoredValue((currentValue) => {
        const valueToStore = value instanceof Function ? value(currentValue) : value;
        writeJsonStorage(key, valueToStore);
        return valueToStore;
      });
    },
    [key]
  );

  useEffect(() => {
    setStoredValue(readValue());
  }, [readValue]);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key && event.key !== key) return;
      setStoredValue(readValue());
    };

    const handleLocalDataChange = (event: Event) => {
      const detail = (event as CustomEvent<{ key?: string }>).detail;
      if (detail?.key && detail.key !== key) return;
      setStoredValue(readValue());
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener(LOCAL_DATA_CHANGED_EVENT, handleLocalDataChange as EventListener);

    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(LOCAL_DATA_CHANGED_EVENT, handleLocalDataChange as EventListener);
    };
  }, [key, readValue]);

  return [storedValue, setValue] as const;
}

export interface SavedVerse {
  text: string;
  reference: string;
  savedAt: string;
  highlightColor?: string;
}

export interface HighlightedVerse {
  reference: string;
  color: string;
}

export interface DailyVerseEntry {
  date: string;
  text: string;
  ref: string;
}

export interface ReadingProgress {
  bookAbbrev: string;
  bookName: string;
  chapter: number;
  lastRead: string;
}

export interface StreakData {
  current: number;
  lastDate: string;
  history: string[];
}

export function getToday(): string {
  return new Date().toISOString().split("T")[0];
}

/** Returns the display streak: 0 if user hasn't read today or yesterday */
export function getDisplayStreak(streak: StreakData): number {
  const today = getToday();
  if (streak.lastDate === today) return streak.current;

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split("T")[0];

  if (streak.lastDate === yesterdayStr) return streak.current;

  // Check if there are any activities in history for today or yesterday
  const hasActivityTodayOrYesterday = streak.history.some(date => date === today || date === yesterdayStr);
  
  // If we have activity today or yesterday, keep the current count.
  // If lastDate was more than 1 day ago, the streak is broken (0).
  return hasActivityTodayOrYesterday ? streak.current : 0;
}

export function updateStreak(streak: StreakData): StreakData {
  const today = getToday();
  // If already registered activity today, do nothing
  if (streak.history.includes(today)) return streak;

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split("T")[0];

  // Consecutive if the last activity in history was yesterday
  // We check the last item of history array as it's sorted by date
  const lastActivityDate = streak.history.length > 0 
    ? streak.history[streak.history.length - 1] 
    : null;
  
  const isConsecutive = lastActivityDate === yesterdayStr;
  const history = [...streak.history, today].slice(-365);

  return {
    current: isConsecutive ? streak.current + 1 : 1,
    lastDate: today,
    history,
  };
}
