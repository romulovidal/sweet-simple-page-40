// Fortaleza-CE não observa horário de verão (UTC-3 o ano todo).
// Usamos America/Fortaleza para garantir o fuso correto mesmo se algum dia
// o Brasil voltar a adotar horário de verão em outras regiões.
export const BRAZIL_TIME_ZONE = "America/Fortaleza";

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

/**
 * Formata uma data/ISO string em horário do Brasil (Fortaleza, UTC-3, sem horário de verão).
 */
export function formatBrazilDateTime(
  input: string | number | Date,
  options: Intl.DateTimeFormatOptions = { dateStyle: "short", timeStyle: "short" },
): string {
  const date = input instanceof Date ? input : new Date(input);
  if (isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("pt-BR", { timeZone: BRAZIL_TIME_ZONE, ...options }).format(date);
}

export function formatBrazilDate(
  input: string | number | Date,
  options: Intl.DateTimeFormatOptions = { day: "2-digit", month: "2-digit", year: "numeric" },
): string {
  return formatBrazilDateTime(input, options);
}

export function formatBrazilTime(
  input: string | number | Date,
  options: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit" },
): string {
  return formatBrazilDateTime(input, options);
}