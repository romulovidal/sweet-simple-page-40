import { useEffect, useRef } from "react";

/**
 * Intercepts the device/browser back button while `active` is true.
 * Pushes a sentinel history state when activated and consumes it on popstate,
 * calling `onBack` instead of letting the browser navigate away.
 *
 * Behavior mimics native apps: the most recently activated handler runs first (LIFO).
 *
 * Usage:
 *   useBackHandler(isOpen, () => setIsOpen(false));
 */
export function useBackHandler(active: boolean, onBack: () => void) {
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;

  useEffect(() => {
    if (!active) return;
    if (typeof window === "undefined") return;

    // Push a sentinel state so the next "back" pops THIS state instead of leaving the page.
    const stateId = `__bh_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    window.history.pushState({ __backHandler: stateId }, "");

    let consumed = false;

    const handlePop = () => {
      if (consumed) return;
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
      // If we still have our sentinel on the stack (component unmounted while open),
      // remove it so the user's history isn't polluted.
      if (!consumed && window.history.state?.__backHandler === stateId) {
        consumed = true;
        window.history.back();
      }
    };
  }, [active]);
}
