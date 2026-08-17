import type { AtisConversationMessage, AtisAssistantRoute } from "./assistant.ts";
import { isMinistryRelationIntent } from "./ministry-intelligence.ts";

const TZ = "America/Fortaleza";
const CANTICO_OFFSET = 100000;
const MAX_CONTEXT_ITEMS = 30;

type SongReference = { kind: "harpa" | "cantico"; number: number };

export type MinistryReference =
  | { kind: "culto"; date: string }
  | { kind: "songs"; date: string | null; items: SongReference[]; selected?: SongReference | null };

export type MinistryFollowup = {
  route: AtisAssistantRoute;
  message: string;
  carryReference: string | null;
};

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[.!?]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function todayKey() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function addDays(iso: string, days: number) {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y, (m || 1) - 1, d || 1, 12));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function isSunday(iso: string) {
  return new Date(`${iso}T12:00:00Z`).getUTCDay() === 0;
}

function validIsoDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

function songToken(item: SongReference) {
  return `${item.kind === "harpa" ? "h" : "c"}${item.number}`;
}

function parseSongToken(token: string): SongReference | null {
  const match = /^([hc])(\d+)$/.exec(token);
  if (!match) return null;
  const number = Number(match[2]);
  if (!Number.isInteger(number) || number <= 0) return null;
  return { kind: match[1] === "h" ? "harpa" : "cantico", number };
}

export function encodeCultoReference(date: string) {
  const valid = validIsoDate(date);
  return valid ? `ctx:culto:${valid}` : null;
}

export function encodeSongsReference(date: string | null, items: SongReference[], selected: SongReference | null = null) {
  const cleanItems = items
    .filter((item) => Number.isInteger(item.number) && item.number > 0)
    .slice(0, MAX_CONTEXT_ITEMS);
  if (!cleanItems.length) return null;
  const encoded = cleanItems.map(songToken);
  const selectedToken = selected && cleanItems.some((item) => item.kind === selected.kind && item.number === selected.number)
    ? `;s=${songToken(selected)}`
    : "";
  return `ctx:songs:${validIsoDate(date ?? "") ?? "-"}:${encoded.join(",")}${selectedToken}`;
}

export function parseMinistryReference(reference: string | null | undefined): MinistryReference | null {
  const raw = String(reference ?? "").trim();
  const culto = /^ctx:culto:(\d{4}-\d{2}-\d{2})$/.exec(raw);
  if (culto) return { kind: "culto", date: culto[1] };

  const songs = /^ctx:songs:(\d{4}-\d{2}-\d{2}|-):([hc]\d+(?:,[hc]\d+)*)(?:;s=([hc]\d+))?$/.exec(raw);
  if (!songs) return null;
  const items = songs[2].split(",").map(parseSongToken).filter(Boolean) as SongReference[];
  if (!items.length) return null;
  const selected = songs[3] ? parseSongToken(songs[3]) : null;
  const validSelected = selected && items.some((item) => item.kind === selected.kind && item.number === selected.number)
    ? selected
    : null;
  return { kind: "songs", date: songs[1] === "-" ? null : songs[1], items, selected: validSelected };
}

function ordinalPosition(message: string) {
  const q = normalize(message);
  const words: Array<[RegExp, number]> = [
    [/\b(primeiro|primeira)\b/, 1],
    [/\b(segundo|segunda)\b/, 2],
    [/\b(terceiro|terceira)\b/, 3],
    [/\b(quarto|quarta)\b/, 4],
    [/\b(quinto|quinta)\b/, 5],
    [/\b(sexto|sexta)\b/, 6],
    [/\b(setimo|setima)\b/, 7],
    [/\b(oitavo|oitava)\b/, 8],
    [/\b(nono|nona)\b/, 9],
    [/\b(decimo|decima)\b/, 10],
  ];
  for (const [pattern, position] of words) if (pattern.test(q)) return position;
  const numeric = q.match(/(?:^|\s)(\d{1,2})(?:º|ª|o|a)?(?:\s|$)/);
  if (numeric) {
    const position = Number(numeric[1]);
    if (position >= 1 && position <= MAX_CONTEXT_ITEMS) return position;
  }
  return null;
}

function cultoSongsFollowup(q: string) {
  return /\b(cantico|canticos|hino|hinos|louvor|louvores|programacao|sequencia|lista)\b/.test(q);
}

function cultoDetailFollowup(q: string) {
  return /quem.+(prega|vai pregar|ministra|vai ministrar)|\b(pregador|ministro|dirigente)\b/.test(q)
    || /\b(tema|assunto da mensagem)\b/.test(q)
    || /que horas|qual horario|\bhorario\b|hora do culto/.test(q)
    || /\b(onde|local|endereco)\b/.test(q)
    || /texto[- ]?base|referencia biblica|passagem base|qual (e|é) o texto/.test(q);
}

function selectedSongFollowup(q: string) {
  return /\b(ultimo|ultima)\b.*\b(hino|cantico|louvor)\b/.test(q)
    || /\b(esse|essa)\b.*\b(hino|cantico|louvor)\b/.test(q)
    || /\bqual\b.*\bnumero\b/.test(q)
    || /\b(manda|mande|mostra|mostre|envia|envie)\b.*\b(de novo|novamente|outra vez|letra|refrao|coro)\b/.test(q)
    || /^(manda|mande|mostra|mostre|envia|envie|repete|repita)( de novo| novamente| outra vez)?$/.test(q)
    || /\b(letra|refrao|coro)\b.*\b(esse|essa|ultimo|ultima)\b/.test(q);
}

function songListMarker(parsed: Extract<MinistryReference, { kind: "songs" }>) {
  const compact = parsed.items.map(songToken).join(",");
  const selected = parsed.selected ? `|s=${songToken(parsed.selected)}` : "";
  return `Contexto ministerial atual: [ATIS_SONG_LIST=${parsed.date ?? "-"}|${compact}${selected}]`;
}

export function ministryContextMessage(reference: string, message: string) {
  const parsed = parseMinistryReference(reference);
  if (!parsed) return null;
  const q = normalize(message).replace(/^atis[,:\s-]*/i, "");

  if (parsed.kind === "culto") {
    if (!cultoSongsFollowup(q) && !cultoDetailFollowup(q) && !isMinistryRelationIntent(q)) return null;
    return {
      content: `Contexto ministerial atual: [ATIS_CULTO_DATE=${parsed.date}]`,
      label: `Culto ${parsed.date}`,
    };
  }

  const position = ordinalPosition(q);
  if (!isMinistryRelationIntent(q) && ((!position || position > parsed.items.length) && !(parsed.selected && selectedSongFollowup(q)))) return null;
  return {
    content: songListMarker(parsed),
    label: `Lista de louvor${parsed.date ? ` ${parsed.date}` : ""}`,
  };
}

function latestMinistryMarker(history: AtisConversationMessage[]): MinistryReference | null {
  for (const item of [...history].reverse()) {
    if (item.role !== "user") continue;
    const culto = item.content.match(/\[ATIS_CULTO_DATE=(\d{4}-\d{2}-\d{2})\]/);
    if (culto) return { kind: "culto", date: culto[1] };
    const songs = item.content.match(/\[ATIS_SONG_LIST=(\d{4}-\d{2}-\d{2}|-)\|([hc]\d+(?:,[hc]\d+)*)(?:\|s=([hc]\d+))?\]/);
    if (songs) {
      const items = songs[2].split(",").map(parseSongToken).filter(Boolean) as SongReference[];
      if (!items.length) continue;
      const selected = songs[3] ? parseSongToken(songs[3]) : null;
      return {
        kind: "songs",
        date: songs[1] === "-" ? null : songs[1],
        items,
        selected: selected && items.some((candidate) => candidate.kind === selected.kind && candidate.number === selected.number) ? selected : null,
      };
    }
  }
  return null;
}

function selectedSongRoute(item: SongReference, q: string, carryReference: string | null): MinistryFollowup {
  const wantsChorus = /\b(refrao|coro)\b/.test(q);
  const wantsNumber = /\bqual\b.*\bnumero\b|\bnumero desse\b|\bnumero deste\b/.test(q);
  const wantsLyrics = /\b(letra|manda|mande|mostra|mostre|envia|envie|repete|repita)\b/.test(q) || wantsChorus;
  if (item.kind === "harpa") {
    const suffix = wantsChorus ? " refrão" : wantsNumber ? " qual o número desse hino" : "";
    return { route: "harpa_lookup", message: `Harpa ${item.number}${suffix}`, carryReference };
  }
  return {
    route: "canticos_info",
    message: `Cântico ${item.number}${wantsLyrics ? " letra" : ""}`,
    carryReference,
  };
}

export function resolveMinistryFollowup(message: string, history: AtisConversationMessage[]): MinistryFollowup | null {
  const marker = latestMinistryMarker(history);
  if (!marker) return null;
  const q = normalize(message);

  if (marker.kind === "culto") {
    if (isMinistryRelationIntent(q)) {
      return {
        route: "ministry_relation",
        message,
        carryReference: encodeCultoReference(marker.date),
      };
    }
    if (cultoSongsFollowup(q)) {
      return {
        route: "canticos_info",
        message: `programação de louvor do culto: ${message} __ATIS_CULTO_DATE=${marker.date}__`,
        carryReference: encodeCultoReference(marker.date),
      };
    }
    if (cultoDetailFollowup(q)) {
      return {
        route: "culto_info",
        message: `${message} __ATIS_CULTO_DATE=${marker.date}__`,
        carryReference: encodeCultoReference(marker.date),
      };
    }
    return null;
  }

  if (isMinistryRelationIntent(q)) {
    return {
      route: "ministry_relation",
      message,
      carryReference: encodeSongsReference(marker.date, marker.items, marker.selected ?? null),
    };
  }

  const position = ordinalPosition(message);
  if (position && position <= marker.items.length) {
    const item = marker.items[position - 1];
    const carryReference = encodeSongsReference(marker.date, marker.items, item);
    return selectedSongRoute(item, q, carryReference);
  }

  if (marker.selected && selectedSongFollowup(q)) {
    const carryReference = encodeSongsReference(marker.date, marker.items, marker.selected);
    return selectedSongRoute(marker.selected, q, carryReference);
  }
  return null;
}

export async function captureCultoReference(supabase: any, message: string) {
  const q = normalize(message);
  const contextDate = message.match(/__ATIS_CULTO_DATE=(\d{4}-\d{2}-\d{2})__/i)?.[1] ?? null;
  const { data, error } = await supabase.rpc("atis_get_culto_candidates", { _days: 30, _timezone: TZ });
  if (error) throw error;
  const rows = Array.isArray(data) ? data : [];
  const today = todayKey();
  let candidates = rows;
  if (contextDate) candidates = rows.filter((row: any) => row.service_date === contextDate);
  else if (/\bhoje\b/.test(q)) candidates = rows.filter((row: any) => row.service_date === today);
  else if (/\bdomingo\b/.test(q)) candidates = rows.filter((row: any) => isSunday(String(row.service_date)));
  const selected = candidates[0];
  return selected?.service_date ? encodeCultoReference(String(selected.service_date)) : null;
}

function programmingRequest(message: string) {
  const q = normalize(message);
  return /__atis_culto_date=\d{4}-\d{2}-\d{2}__/.test(q)
    || (/\b(culto|domingo|hoje|proximo|programacao|sequencia|lista)\b/.test(q)
      && /\b(hino|hinos|cantico|canticos|louvor|louvores)\b/.test(q));
}

export async function captureSongListReference(supabase: any, message: string) {
  if (!programmingRequest(message)) return null;
  const marker = message.match(/__ATIS_CULTO_DATE=(\d{4}-\d{2}-\d{2})__/i)?.[1] ?? null;
  const q = normalize(message);
  const today = todayKey();
  const through = addDays(today, 30);
  const { data, error } = await supabase
    .from("culto_selections")
    .select("culto_date,items")
    .eq("is_active", true)
    .gte("culto_date", today)
    .lte("culto_date", through)
    .order("culto_date", { ascending: true });
  if (error) throw error;
  let rows = Array.isArray(data) ? data : [];
  if (marker) rows = rows.filter((row: any) => row.culto_date === marker);
  else if (/\bhoje\b/.test(q)) rows = rows.filter((row: any) => row.culto_date === today);
  else if (/\bdomingo\b/.test(q)) rows = rows.filter((row: any) => isSunday(String(row.culto_date)));
  const selection = rows[0];
  if (!selection) return null;
  const items = (Array.isArray(selection.items) ? selection.items : [])
    .map((item: any) => Number(item?.hino_number))
    .filter((number: number) => Number.isFinite(number) && number > 0)
    .slice(0, MAX_CONTEXT_ITEMS)
    .map((number: number) => number >= CANTICO_OFFSET
      ? { kind: "cantico" as const, number: number - CANTICO_OFFSET }
      : { kind: "harpa" as const, number });
  return encodeSongsReference(String(selection.culto_date), items);
}
