import { ministryContextMessage, parseMinistryReference } from "./ministry-context.ts";

export type AtisContextMessage = { role: "user" | "assistant"; content: string };

export type AtisStructuredContext = {
  messages: AtisContextMessage[];
  source: "memory" | "none";
  reference: string | null;
  age_seconds: number | null;
  reason: "memory" | "ministry_memory" | "no_reference" | "not_followup" | "expired" | "ministry_expired";
};

const BIBLE_CONTEXT_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MINISTRY_CONTEXT_TTL_MS = 6 * 60 * 60 * 1000;
const BIBLE_ROUTES = new Set([
  "bible_lookup",
  "ask_bible",
  "exegetai",
  "chapter_summary",
  "word_meaning",
  "connections",
  "timeline",
  "devotional",
  "daily_verse",
]);

function firstString(...values: unknown[]) {
  for (const value of values) if (typeof value === "string" && value.trim()) return value.trim();
  return null;
}

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[.!?]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isBibleFollowup(message: string) {
  const q = normalize(message).replace(/^atis[,:\s-]*/i, "");
  if (!q) return false;

  if (/\b(culto|cultos|cantico|canticos|louvor|louvores|harpa|hino|hinos|aniversario|aniversarios|oracao|pedido de oracao|agenda|programacao)\b/.test(q)) {
    return false;
  }

  return /\b(versiculo|verso|capitulo|contexto|explica|explique|explicacao|relacionad|semelhant|outro texto|outra passagem|continue|continua|proximo|seguinte|esse texto|essa passagem|esse trecho|isso)\b/.test(q)
    || /^(?:e\s+)?(?:o\s+)?\d{1,3}(?:\s*[-–]\s*\d{1,3})?$/.test(q);
}

function ageOf(timestamp: string | null, now: Date) {
  const parsedAt = timestamp ? Date.parse(timestamp) : NaN;
  const ageMs = Number.isFinite(parsedAt) ? Math.max(0, now.getTime() - parsedAt) : 0;
  return {
    parsed: Number.isFinite(parsedAt),
    ageMs,
    ageSeconds: Number.isFinite(parsedAt) ? Math.floor(ageMs / 1000) : null,
  };
}

export function structuredConversationContext(state: any, message: string, now = new Date()): AtisStructuredContext {
  const memory = state?.memory && typeof state.memory === "object" ? state.memory : {};
  const route = firstString(state?.last_route, memory?.last_route);

  const ministryReference = firstString(
    memory?.last_ministry_reference,
    route && ["culto_info", "canticos_info", "harpa_lookup"].includes(route) ? memory?.last_reference : null,
  );
  if (ministryReference && parseMinistryReference(ministryReference)) {
    const ministry = ministryContextMessage(ministryReference, message);
    if (ministry) {
      const age = ageOf(firstString(memory?.last_ministry_reference_at, memory?.updated_at), now);
      if (age.parsed && age.ageMs > MINISTRY_CONTEXT_TTL_MS) {
        return { messages: [], source: "none", reference: ministry.label, age_seconds: age.ageSeconds, reason: "ministry_expired" };
      }
      return {
        messages: [{ role: "user", content: ministry.content }],
        source: "memory",
        reference: ministry.label,
        age_seconds: age.ageSeconds,
        reason: "ministry_memory",
      };
    }
  }

  const reference = firstString(
    memory?.last_bible_reference,
    route && BIBLE_ROUTES.has(route) ? memory?.last_reference : null,
  );

  if (!reference) {
    return { messages: [], source: "none", reference: null, age_seconds: null, reason: "no_reference" };
  }
  if (!isBibleFollowup(message)) {
    return { messages: [], source: "none", reference, age_seconds: null, reason: "not_followup" };
  }

  const age = ageOf(firstString(memory?.last_bible_reference_at), now);
  if (age.parsed && age.ageMs > BIBLE_CONTEXT_TTL_MS) {
    return { messages: [], source: "none", reference, age_seconds: age.ageSeconds, reason: "expired" };
  }

  return {
    messages: [{ role: "user", content: `Contexto bíblico atual: ${reference}` }],
    source: "memory",
    reference,
    age_seconds: age.ageSeconds,
    reason: "memory",
  };
}
