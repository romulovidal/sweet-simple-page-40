/**
 * Returns a foreground color (HSL) with good contrast against a background HSL triplet.
 * Accepts strings like "217 91% 60%".
 */
export function textOn(color: string): string {
  const m = color.match(/(\d+(?:\.\d+)?)%\s*$/);
  const l = m ? parseFloat(m[1]) : 50;
  // Lighter backgrounds → dark text; darker backgrounds → light text.
  return l > 62 ? "hsl(220 40% 8%)" : "hsl(0 0% 100%)";
}