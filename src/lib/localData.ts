export const LOCAL_DATA_CHANGED_EVENT = "app-local-data-changed";

export interface LocalDataChangedDetail {
  key?: string;
  source?: "local-update" | "hydrate" | "cache";
}

export function emitLocalDataChanged(detail: LocalDataChangedDetail = {}) {
  window.dispatchEvent(
    new CustomEvent(LOCAL_DATA_CHANGED_EVENT, {
      detail,
    })
  );
}

export function readJsonStorage<T>(key: string, fallback: T): T {
  try {
    const item = window.localStorage.getItem(key);
    return item ? (JSON.parse(item) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function writeJsonStorage<T>(
  key: string,
  value: T,
  emitChange = true,
  source: LocalDataChangedDetail["source"] = "local-update"
) {
  window.localStorage.setItem(key, JSON.stringify(value));

  if (emitChange) {
    emitLocalDataChanged({ key, source });
  }
}

export function removeStorageKey(
  key: string,
  emitChange = true,
  source: LocalDataChangedDetail["source"] = "local-update"
) {
  window.localStorage.removeItem(key);

  if (emitChange) {
    emitLocalDataChanged({ key, source });
  }
}
