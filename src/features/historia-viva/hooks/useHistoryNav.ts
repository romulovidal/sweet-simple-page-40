import { useCallback, useState } from "react";
import type { EntityRef } from "../types";

export function useHistoryNav(initial?: EntityRef) {
  const [stack, setStack] = useState<EntityRef[]>(initial ? [initial] : []);
  const push = useCallback((ref: EntityRef) => setStack((s) => [...s, ref]), []);
  const back = useCallback(() => setStack((s) => s.slice(0, -1)), []);
  const reset = useCallback((ref?: EntityRef) => setStack(ref ? [ref] : []), []);
  const current = stack[stack.length - 1];
  return { stack, current, push, back, reset, canBack: stack.length > 1 };
}
