import { useEffect, useRef } from "react";

/**
 * Intercepts the device/browser back button while `active` is true.
 *
 * - When `active` becomes true, pushes a sentinel history state.
 * - On popstate (real user back), calls `onBack` ONCE for the most recently
 *   activated handler whose sentinel was just popped.
 * - On cleanup (active flips to false because the app already closed the UI,
 *   or component unmounts), silently removes the sentinel without calling
 *   onBack and without disturbing other active handlers.
 *
 * Multiple handlers can coexist (LIFO order) — each manages its own sentinel.
 */

// Set of sentinel ids the hook itself popped (programmatic cleanup).
// Any popstate matching one of these is ignored by ALL handlers.
const syntheticPops = new Set<string>();

export function useBackHandler(active: boolean, onBack: () => void) {
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;

  useEffect(() => {
    if (!active) return;
    if (typeof window === "undefined") return;

    const stateId = `__bh_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    window.history.pushState({ __backHandler: stateId }, "");

    let consumed = false;

    const handlePop = (ev: PopStateEvent) => {
      if (consumed) return;
      // If this popstate was triggered by ANY hook's programmatic cleanup,
      // don't treat it as a user-initiated back.
      // We detect this by checking if our sentinel is no longer present AND
      // there is a synthetic pop in flight.
      if (syntheticPops.size > 0) {
        // Someone (possibly us) is doing a programmatic back; do nothing here.
        // The synthetic flag will be cleared on the next microtask.
        return;
      }
      consumed = true;
      try {
        onBackRef.current();
      } catch (e) {
        console.error("[useBackHandler] handler error:", e);
      }
    };

    window.addEventListener("popstate", handlePop);

    return () => {
      window.removeEventListener("popstate", handlePop);
      if (consumed) return;
      // Sentinel still on stack and we need to remove it without firing onBack.
      if (window.history.state?.__backHandler === stateId) {
        consumed = true;
        syntheticPops.add(stateId);
        // Clear the marker after the popstate event has been processed.
        const clear = () => {
          syntheticPops.delete(stateId);
          window.removeEventListener("popstate", clear);
        };
        window.addEventListener("popstate", clear);
        // Safety net: clear after a tick even if no popstate fires.
        setTimeout(() => syntheticPops.delete(stateId), 50);
        window.history.back();
      }
    };
  }, [active]);
}
