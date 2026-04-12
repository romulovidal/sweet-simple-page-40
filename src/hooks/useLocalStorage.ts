import { useCallback, useEffect, useRef, useState } from "react";

function readLocalStorageValue<T>(key: string, initialValue: T): T {
  try {
    const item = window.localStorage.getItem(key);
    return item ? (JSON.parse(item) as T) : initialValue;
  } catch {
    return initialValue;
  }
}

export function useLocalStorage<T>(key: string, initialValue: T) {
  const initialValueRef = useRef(initialValue);
  const readValue = useCallback(() => readLocalStorageValue(key, initialValueRef.current), [key]);
  const [storedValue, setStoredValue] = useState<T>(readValue);

  const setValue = useCallback(
    (value: T | ((val: T) => T)) => {
      setStoredValue((currentValue) => {
        const valueToStore = value instanceof Function ? value(currentValue) : value;
        window.localStorage.setItem(key, JSON.stringify(valueToStore));
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

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
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

export function updateStreak(streak: StreakData): StreakData {
  const today = getToday();
  if (streak.lastDate === today) return streak;

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split("T")[0];

  const isConsecutive = streak.lastDate === yesterdayStr;
  const history = streak.history.includes(today)
    ? streak.history
    : [...streak.history, today].slice(-365);

  return {
    current: isConsecutive ? streak.current + 1 : 1,
    lastDate: today,
    history,
  };
}
