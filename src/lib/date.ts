export const BRAZIL_TIME_ZONE = "America/Sao_Paulo";

function getDatePartsInTimeZone(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value ?? "0000";
  const month = parts.find((part) => part.type === "month")?.value ?? "00";
  const day = parts.find((part) => part.type === "day")?.value ?? "00";

  return { year, month, day };
}

export function getBrazilDateKey(date = new Date()): string {
  const { year, month, day } = getDatePartsInTimeZone(date, BRAZIL_TIME_ZONE);
  return `${year}-${month}-${day}`;
}

export function addDaysToDateKey(dateKey: string, days: number): string {
  const match = dateKey.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return dateKey;

  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + days, 12));
  return date.toISOString().slice(0, 10);
}

export function getBrazilYesterdayDateKey(date = new Date()): string {
  return addDaysToDateKey(getBrazilDateKey(date), -1);
}

export function parseDateKeyAtNoon(dateKey: string): Date | null {
  const match = dateKey.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12, 0, 0, 0);
  if (
    date.getFullYear() !== Number(match[1]) ||
    date.getMonth() !== Number(match[2]) - 1 ||
    date.getDate() !== Number(match[3])
  ) {
    return null;
  }

  return date;
}