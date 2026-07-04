import { supabase } from "@/integrations/supabase/client";
import { readJsonStorage, writeJsonStorage } from "@/lib/localData";

const DEVICE_ID_KEY = "device-id";
const QUEUE_KEY = "analytics-queue";
const FLUSH_INTERVAL_MS = 4000;
const MAX_BATCH = 15;

export type AnalyticsEventName =
  | "page_view"
  | "chapter_view"
  | "search"
  | "verse_save"
  | "verse_share"
  | "plan_start"
  | "plan_day_complete"
  | "ai_use"
  | "install_prompt_shown"
  | "install_prompt_accepted";

interface QueuedEvent {
  event: AnalyticsEventName;
  props?: Record<string, unknown>;
  path?: string;
  device_id: string;
  ts: number;
}

let queue: QueuedEvent[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let started = false;

function getDeviceId(): string {
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

function loadPersistedQueue() {
  const stored = readJsonStorage<QueuedEvent[]>(QUEUE_KEY, []);
  if (Array.isArray(stored) && stored.length > 0) {
    queue = [...stored, ...queue].slice(-100);
    writeJsonStorage(QUEUE_KEY, []);
  }
}

function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flush();
  }, FLUSH_INTERVAL_MS);
}

async function flush() {
  if (queue.length === 0) return;
  const batch = queue.splice(0, MAX_BATCH);
  try {
    const { error } = await supabase.functions.invoke("track-event", {
      body: { events: batch.map(({ ts: _ts, ...e }) => e) },
    });
    if (error) {
      // Reenfileira e persiste para próxima carga
      queue.unshift(...batch);
      writeJsonStorage(QUEUE_KEY, queue.slice(0, 100));
    } else if (queue.length > 0) {
      scheduleFlush();
    }
  } catch {
    queue.unshift(...batch);
    writeJsonStorage(QUEUE_KEY, queue.slice(0, 100));
  }
}

function ensureStarted() {
  if (started || typeof window === "undefined") return;
  started = true;
  loadPersistedQueue();
  if (queue.length > 0) scheduleFlush();

  window.addEventListener("beforeunload", () => {
    if (queue.length > 0) writeJsonStorage(QUEUE_KEY, queue.slice(0, 100));
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden" && queue.length > 0) {
      writeJsonStorage(QUEUE_KEY, queue.slice(0, 100));
    } else if (document.visibilityState === "visible") {
      loadPersistedQueue();
      if (queue.length > 0) scheduleFlush();
    }
  });
}

/**
 * Enfileira um evento para envio em lote via edge function `track-event`.
 * Falhas ficam persistidas em localStorage e são retentadas na próxima carga.
 */
export function trackEvent(
  event: AnalyticsEventName,
  props?: Record<string, unknown>,
  path?: string,
) {
  try {
    ensureStarted();
    queue.push({
      event,
      props,
      path: path ?? (typeof window !== "undefined" ? window.location.pathname : undefined),
      device_id: getDeviceId(),
      ts: Date.now(),
    });
    if (queue.length >= MAX_BATCH) void flush();
    else scheduleFlush();
  } catch {
    /* silencia — analytics nunca deve derrubar a UI */
  }
}

/** Envia page_view para a rota atual. Ideal para roteador SPA. */
export function trackPageView(path: string) {
  trackEvent("page_view", undefined, path);
}