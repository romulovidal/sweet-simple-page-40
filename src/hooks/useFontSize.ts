import { useLocalStorage } from "@/hooks/useLocalStorage";

const MIN_SIZE = 12;
const MAX_SIZE = 24;
const STEP = 2;

export function useFontSize() {
  const [fontSize, setFontSize] = useLocalStorage<number>("reader-font-size", 16);

  const increase = () => setFontSize((prev) => Math.min((prev ?? 16) + STEP, MAX_SIZE));
  const decrease = () => setFontSize((prev) => Math.max((prev ?? 16) - STEP, MIN_SIZE));
  const canIncrease = (fontSize ?? 16) < MAX_SIZE;
  const canDecrease = (fontSize ?? 16) > MIN_SIZE;

  return { fontSize: fontSize ?? 16, increase, decrease, canIncrease, canDecrease };
}
