import { useState, useCallback } from "react";

export function useLocalStorage<T>(key: string, initialValue: T) {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch {
      return initialValue;
    }
  });

  const setValue = useCallback(
    (value: T | ((val: T) => T)) => {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
    },
    [key, storedValue]
  );

  return [storedValue, setValue] as const;
}

// Saved verses
export interface SavedVerse {
  text: string;
  reference: string;
  savedAt: string;
}

// Reading progress
export interface ReadingProgress {
  bookAbbrev: string;
  bookName: string;
  chapter: number;
  lastRead: string;
}

// Streak data
export interface StreakData {
  current: number;
  lastDate: string; // YYYY-MM-DD
  history: string[]; // dates read
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
  return {
    current: isConsecutive ? streak.current + 1 : 1,
    lastDate: today,
    history: [...streak.history, today].slice(-365),
  };
}
