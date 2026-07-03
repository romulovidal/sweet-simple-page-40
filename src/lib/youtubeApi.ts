// Loads the YouTube IFrame Player API once and exposes a shared promise.
// Using `any` to avoid needing @types/youtube.

let readyPromise: Promise<any> | null = null;

export function loadYouTubeApi(): Promise<any> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("SSR: no window"));
  }

  const w = window as any;
  if (w.YT && w.YT.Player) return Promise.resolve(w.YT);
  if (readyPromise) return readyPromise;

  readyPromise = new Promise((resolve) => {
    const prev = w.onYouTubeIframeAPIReady;
    w.onYouTubeIframeAPIReady = () => {
      if (typeof prev === "function") {
        try {
          prev();
        } catch {
          /* noop */
        }
      }
      resolve(w.YT);
    };

    if (!document.querySelector('script[data-yt-iframe-api="1"]')) {
      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      script.async = true;
      script.dataset.ytIframeApi = "1";
      document.head.appendChild(script);
    }
  });

  return readyPromise;
}

const PROGRESS_PREFIX = "video-progress-";

export type VideoProgress = { t: number; d?: number; at: string };

export function getVideoProgress(videoId: string): VideoProgress | null {
  try {
    const raw = localStorage.getItem(PROGRESS_PREFIX + videoId);
    return raw ? (JSON.parse(raw) as VideoProgress) : null;
  } catch {
    return null;
  }
}

export function saveVideoProgress(videoId: string, t: number, d?: number) {
  try {
    if (!Number.isFinite(t) || t < 3) return;
    // Don't persist positions right at the end
    if (d && d > 0 && t >= d - 10) {
      clearVideoProgress(videoId);
      return;
    }
    const payload: VideoProgress = { t: Math.floor(t), d, at: new Date().toISOString() };
    localStorage.setItem(PROGRESS_PREFIX + videoId, JSON.stringify(payload));
  } catch {
    /* noop */
  }
}

export function clearVideoProgress(videoId: string) {
  try {
    localStorage.removeItem(PROGRESS_PREFIX + videoId);
  } catch {
    /* noop */
  }
}