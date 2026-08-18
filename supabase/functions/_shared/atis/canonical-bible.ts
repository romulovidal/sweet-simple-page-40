import { aiChatFetchWithProviders } from "../ai-fetch.ts";
import { retrieveSemanticBibleEvidence } from "./semantic-bible.ts";

export type CanonicalBibleBook = { abbrev: string; name?: string; chapters: string[][] };

export type CanonicalEvidence = {
  reference: string;
  text: string;
  score: number;
  testament: "OT" | "NT";
  matchedEntities: string[];
  matchedTerms: string[];
};

type ConnectionItem = { reference: string; explanation: string };
type CanonicalConnections = {
  new_testament: ConnectionItem[];
  parallels: ConnectionItem[];
  recurring_themes: ConnectionItem[];
  prophecy_fulfillment: {
    status: "explicit" | "typology" | "none";
    explanation: string;
    references: string[];
  };
};

const NT_BOOKS = new Set([
  "mateus", "marcos", "lucas", "joao", "atos", "romanos", "1 corintios", "2 corintios", "galatas", "efesios",
  "filipenses", "colossenses", "1 tessalonicenses", "2 tessalonicenses", "1 timoteo", "2 timoteo", "tito", "filemom",
  "hebreus", "tiago", "1 pedro", "2 pedro", "1 joao", "2 joao", "3 joao", "judas", "apocalipse",
]);

const STOPWORDS = new Set([
  "ainda", "assim", "antes", "aquela", "aquele", "aqueles", "aqui", "cada", "como", "contra", "coisa", "coisas", "depois",
  "desde", "disse", "dizer", "entao", "estava", "estando", "este", "esta", "estes", "estas", "feito", "foram", "grande", "havia",
  "isso", "isto", "mesmo", "muito", "nao", "para", "pela", "pelas", "pelo", "pelos", "porque", "quando", "quanto", "quem", "sobre",
  "tambem", "tinha", "todos", "toda", "todas", "tudo", "uma", "umas", "uns", "vosso", "vossa", "senhor", "deus", "eis", "mais",
  "sera", "serao", "sendo", "tendo", "toda", "todo", "deles", "delas", "dele", "dela", "nele", "nela", "seus", "suas", "meu", "minha",
]);

const GENERIC_CAPITALIZED = new Set([
  "e", "mas", "entao", "disse", "porque", "quando", "depois", "assim", "ora", "logo", "senhor", "deus", "eis", "portanto",
  "por", "pois", "havemos", "houver", "contudo", "todavia", "entretanto", "ainda", "todos", "todas", "todo", "toda",
  "este", "esta", "estes", "estas", "aquele", "aquela", "aqueles", "aquelas", "pelo", "pela", "pelos", "pelas",
  "nos", "nas", "aos", "qual", "quais", "onde", "aonde", "entretanto", "tambem", "então", "porquanto", "assim",
]);

function normalize(value: string) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function words(value: string) {
  return normalize(value).split(" ").filter(Boolean);
}

function unique<T>(items: T[]) {
  return [...new Set(items)];
}

function hasToken(normalizedText: string, token: string) {
  return (` ${normalizedText} `).includes(` ${token} `);
}

function canonicalBookName(book: CanonicalBibleBook) {
  return String(book.name || book.abbrev || "").trim();
}

function testamentForBook(book: CanonicalBibleBook): "OT" | "NT" {
  return NT_BOOKS.has(normalize(canonicalBookName(book))) ? "NT" : "OT";
}

function sourceLocation(label: string, bible: CanonicalBibleBook[]) {
  const normalizedLabel = normalize(label);
  const book = bible
    .map((item) => ({ item, token: normalize(canonicalBookName(item)) }))
    .filter((entry) => entry.token && normalizedLabel.startsWith(`${entry.token} `))
    .sort((a, b) => b.token.length - a.token.length)[0]?.item;
  if (!book) return null;
  const rest = normalizedLabel.slice(normalize(canonicalBookName(book)).length).trim();
  const match = /^(\d{1,3})(?:\s+(\d{1,3})(?:\s+(\d{1,3}))?)?/.exec(rest);
  if (!match) return { book, chapter: null as number | null, verseStart: null as number | null, verseEnd: null as number | null };
  const chapter = Number(match[1]);
  const verseStart = match[2] ? Number(match[2]) : null;
  const verseEnd = match[3] ? Number(match[3]) : verseStart;
  return { book, chapter, verseStart, verseEnd };
}

export function extractCanonicalEntities(sourceText: string) {
  const found = sourceText.match(/\b[\p{Lu}À-Ý][\p{L}À-ÿ'’-]{2,}\b/gu) ?? [];
  return unique(found.map(normalize))
    .filter((token) => token.length >= 3 && !STOPWORDS.has(token) && !GENERIC_CAPITALIZED.has(token));
}

function significantTerms(sourceText: string, message: string, entities: string[]) {
  const entitySet = new Set(entities);
  const source = words(sourceText)
    .filter((token) => token.length >= 5 && !STOPWORDS.has(token) && !entitySet.has(token));
  const frequency = new Map<string, number>();
  for (const token of source) frequency.set(token, (frequency.get(token) ?? 0) + 1);
  const thematic = [...frequency.entries()]
    .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)
    .slice(0, 18)
    .map(([token]) => token);
  const query = unique(words(message).filter((token) => token.length >= 4 && !STOPWORDS.has(token))).slice(0, 12);
  return { thematic, query };
}

export function retrieveCanonicalEvidence(
  sourceLabel: string,
  sourceText: string,
  message: string,
  bible: CanonicalBibleBook[],
  maxResults = 12,
): CanonicalEvidence[] {
  if (!Array.isArray(bible) || !bible.length || !sourceText.trim()) return [];

  const location = sourceLocation(sourceLabel, bible);
  const sourceTestament = location ? testamentForBook(location.book) : "OT";
  const entities = extractCanonicalEntities(sourceText);
  const { thematic, query } = significantTerms(sourceText, message, entities);

  const rows: Array<{
    book: CanonicalBibleBook;
    bookName: string;
    chapter: number;
    verse: number;
    text: string;
    normalized: string;
    testament: "OT" | "NT";
  }> = [];

  for (const book of bible) {
    const bookName = canonicalBookName(book);
    const testament = testamentForBook(book);
    for (let chapterIndex = 0; chapterIndex < (book.chapters?.length ?? 0); chapterIndex++) {
      const verses = book.chapters[chapterIndex] ?? [];
      for (let verseIndex = 0; verseIndex < verses.length; verseIndex++) {
        const text = String(verses[verseIndex] ?? "").trim();
        if (!text) continue;
        rows.push({
          book,
          bookName,
          chapter: chapterIndex + 1,
          verse: verseIndex + 1,
          text,
          normalized: normalize(text),
          testament,
        });
      }
    }
  }

  const entityFrequency = new Map<string, number>();
  for (const entity of entities) {
    let count = 0;
    for (const row of rows) if (hasToken(row.normalized, entity)) count++;
    entityFrequency.set(entity, count);
  }

  const candidates: CanonicalEvidence[] = [];
  for (const row of rows) {
    if (location && normalize(canonicalBookName(location.book)) === normalize(row.bookName) && location.chapter === row.chapter) {
      const start = location.verseStart ?? 1;
      const end = location.verseEnd ?? Number.MAX_SAFE_INTEGER;
      if (row.verse >= start && row.verse <= end) continue;
    }

    const matchedEntities = entities.filter((entity) => hasToken(row.normalized, entity));
    const matchedTerms = thematic.filter((term) => hasToken(row.normalized, term)).slice(0, 5);
    const queryMatches = query.filter((term) => hasToken(row.normalized, term));

    let score = 0;
    for (const entity of matchedEntities) {
      const frequency = entityFrequency.get(entity) ?? 9999;
      score += frequency <= 12 ? 24 : frequency <= 50 ? 15 : frequency <= 200 ? 8 : 3;
    }
    score += matchedTerms.length * 1.5;
    score += queryMatches.length * 3;
    if (sourceTestament === "OT" && row.testament === "NT" && matchedEntities.length) score += 8;
    if (score < 3) continue;

    candidates.push({
      reference: `${row.bookName} ${row.chapter}:${row.verse}`,
      text: row.text,
      score,
      testament: row.testament,
      matchedEntities,
      matchedTerms: unique([...matchedTerms, ...queryMatches]).slice(0, 6),
    });
  }

  candidates.sort((a, b) => b.score - a.score || a.reference.localeCompare(b.reference, "pt-BR"));

  const output: CanonicalEvidence[] = [];
  const chapterCounts = new Map<string, number>();
  for (const candidate of candidates) {
    const chapterKey = candidate.reference.replace(/:\d+$/, "");
    const count = chapterCounts.get(chapterKey) ?? 0;
    if (count >= 2) continue;
    output.push(candidate);
    chapterCounts.set(chapterKey, count + 1);
    if (output.length >= Math.max(1, Math.min(maxResults, 20))) break;
  }
  return output;
}

export function canonicalEvidenceContext(evidence: CanonicalEvidence[], maxItems = 6) {
  const selected = evidence.slice(0, Math.max(0, Math.min(maxItems, 10)));
  if (!selected.length) return "";
  return `\n\nEVIDÊNCIAS CANÔNICAS RECUPERADAS DA BÍBLIA DO APP\n${selected.map((item) => `- ${item.reference}: ${item.text}`).join("\n")}\nUse essas evidências somente quando forem realmente relevantes. Elas são referências cruzadas verificadas no acervo do app; não force todas na resposta e não introduza fatos que não estejam sustentados pela passagem-base ou por estas evidências.`;
}

function parseJsonObject(value: string) {
  const stripped = String(value ?? "").replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  const start = stripped.indexOf("{");
  const end = stripped.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(stripped.slice(start, end + 1));
  } catch {
    return null;
  }
}

function normalizeReference(value: string) {
  return normalize(value).replace(/\s+/g, " ");
}


type ReferenceSpan = { book: string; chapter: number; verseStart: number; verseEnd: number; display: string };

const CANONICAL_REFERENCE_BOOKS = [
  "Lamentações de Jeremias", "Cântico dos Cânticos", "1 Tessalonicenses", "2 Tessalonicenses", "Deuteronômio",
  "1 Coríntios", "2 Coríntios", "1 Crônicas", "2 Crônicas", "1 Timóteo", "2 Timóteo", "Eclesiastes",
  "Apocalipse", "Colossenses", "Filipenses", "Provérbios", "Lamentações", "1 Samuel", "2 Samuel", "1 Reis", "2 Reis",
  "1 Pedro", "2 Pedro", "1 João", "2 João", "3 João", "Gênesis", "Êxodo", "Levítico", "Números", "Josué", "Juízes",
  "Esdras", "Neemias", "Ester", "Salmos", "Cantares", "Isaías", "Jeremias", "Ezequiel", "Daniel", "Oséias", "Joel",
  "Amós", "Obadias", "Jonas", "Miquéias", "Naum", "Habacuque", "Sofonias", "Ageu", "Zacarias", "Malaquias",
  "Mateus", "Marcos", "Lucas", "João", "Atos", "Romanos", "Gálatas", "Efésios", "Tito", "Filemom", "Hebreus",
  "Tiago", "Judas", "Jó", "Rute", "Cânticos",
].sort((a, b) => b.length - a.length);

function parseReferenceSpan(value: string): ReferenceSpan | null {
  const cleaned = String(value ?? "").trim().replace(/[‑–—]/g, "-");
  const match = /^(.+?)\s+(\d{1,3}):(\d{1,3})(?:\s*-\s*(\d{1,3}))?$/u.exec(cleaned);
  if (!match) return null;
  const chapter = Number(match[2]);
  const verseStart = Number(match[3]);
  const verseEnd = Number(match[4] ?? match[3]);
  if (!Number.isInteger(chapter) || !Number.isInteger(verseStart) || !Number.isInteger(verseEnd) || verseEnd < verseStart) return null;
  const book = match[1].trim();
  return { book, chapter, verseStart, verseEnd, display: `${book} ${chapter}:${verseStart}${verseEnd !== verseStart ? `-${verseEnd}` : ""}` };
}

function resolveEvidenceReference(requested: string, evidence: CanonicalEvidence[]) {
  const exact = evidence.find((item) => normalizeReference(item.reference) === normalizeReference(requested));
  if (exact) return { evidence: exact, reference: exact.reference };

  const requestSpan = parseReferenceSpan(requested);
  if (!requestSpan) return null;
  const covering = evidence.find((item) => {
    const evidenceSpan = parseReferenceSpan(item.reference);
    return Boolean(evidenceSpan
      && normalize(evidenceSpan.book) === normalize(requestSpan.book)
      && evidenceSpan.chapter === requestSpan.chapter
      && requestSpan.verseStart >= evidenceSpan.verseStart
      && requestSpan.verseEnd <= evidenceSpan.verseEnd);
  });
  return covering ? { evidence: covering, reference: requestSpan.display } : null;
}

function extractBibleReferences(value: string) {
  const escapedBooks = CANONICAL_REFERENCE_BOOKS.map((book) => book.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  const regex = new RegExp(`\\b(?:${escapedBooks})\\s+\\d{1,3}:\\d{1,3}(?:\\s*[-‑–—]\\s*\\d{1,3})?`, "giu");
  return unique(String(value ?? "").match(regex) ?? []);
}

function explanationIsGrounded(value: string, evidence: CanonicalEvidence[]) {
  const references = extractBibleReferences(value);
  return references.every((reference) => Boolean(resolveEvidenceReference(reference, evidence)));
}

function fallbackExplanation(item: CanonicalEvidence) {
  if (item.matchedEntities.length) {
    const names = item.matchedEntities.map((name) => name.charAt(0).toUpperCase() + name.slice(1)).join(" e ");
    return `Retoma diretamente ${names}, permitindo comparar como esse personagem ou episódio é desenvolvido em outra parte das Escrituras.`;
  }
  if (item.matchedTerms.includes("semantic")) {
    return "Foi recuperada semanticamente por tratar de um conceito, padrão ou relação canônica próxima da passagem-base, ainda que não repita as mesmas palavras.";
  }
  if (item.matchedTerms.length) {
    return `Retoma temas presentes na passagem-base, especialmente ${item.matchedTerms.slice(0, 2).join(" e ")}.`;
  }
  return "Apresenta um paralelo textual relevante com a passagem-base.";
}

function validateItems(raw: unknown, evidence: CanonicalEvidence[], maxItems: number): ConnectionItem[] {
  if (!Array.isArray(raw)) return [];
  const output: ConnectionItem[] = [];
  const seen = new Set<string>();
  for (const candidate of raw) {
    const requested = typeof candidate?.reference === "string" ? candidate.reference.trim() : "";
    const resolved = resolveEvidenceReference(requested, evidence);
    if (!resolved) continue;
    const key = normalizeReference(resolved.reference);
    if (seen.has(key)) continue;
    const rawExplanation = typeof candidate?.explanation === "string"
      ? candidate.explanation.trim().replace(/\s+/g, " ")
      : "";
    const explanation = rawExplanation.length >= 12 && explanationIsGrounded(rawExplanation, evidence)
      ? rawExplanation
      : fallbackExplanation(resolved.evidence);
    output.push({ reference: resolved.reference, explanation });
    seen.add(key);
    if (output.length >= maxItems) break;
  }
  return output;
}

export function validateCanonicalConnectionsPayload(raw: unknown, evidence: CanonicalEvidence[], sourceLabel: string): CanonicalConnections {
  const body = raw && typeof raw === "object" ? raw as any : {};
  const newTestament = validateItems(body.new_testament, evidence, 4);
  const parallels = validateItems(body.parallels, evidence, 3);
  const recurringThemes = validateItems(body.recurring_themes, evidence, 3);

  const prophecyRaw = body.prophecy_fulfillment && typeof body.prophecy_fulfillment === "object" ? body.prophecy_fulfillment : {};
  let status: "explicit" | "typology" | "none" = ["explicit", "typology", "none"].includes(prophecyRaw.status)
    ? prophecyRaw.status
    : "none";

  const requestedProphecyRefs: string[] = Array.isArray(prophecyRaw.references)
    ? prophecyRaw.references.filter((item: unknown): item is string => typeof item === "string")
    : [];
  const resolvedProphecyRefs = requestedProphecyRefs
    .map((reference: string) => resolveEvidenceReference(reference, evidence)?.reference ?? null)
    .filter(Boolean) as string[];

  const rawProphecyExplanation = typeof prophecyRaw.explanation === "string"
    ? prophecyRaw.explanation.trim().replace(/\s+/g, " ")
    : "";
  const explanationRefs = extractBibleReferences(rawProphecyExplanation);
  const unsupportedExplanationRef = explanationRefs.some((reference) => !resolveEvidenceReference(reference, evidence));
  const groundedExplanationRefs = explanationRefs
    .map((reference: string) => resolveEvidenceReference(reference, evidence)?.reference ?? null)
    .filter(Boolean) as string[];
  const supportRefs = unique([...resolvedProphecyRefs, ...groundedExplanationRefs]);

  if (status !== "none" && !supportRefs.length) status = "none";

  let prophecyExplanation = rawProphecyExplanation && !unsupportedExplanationRef
    ? rawProphecyExplanation
    : "";
  if (!prophecyExplanation) {
    prophecyExplanation = status === "explicit"
      ? `Há uma relação explícita de profecia e cumprimento sustentada pelas referências recuperadas${supportRefs.length ? ` (${supportRefs.join(", ")})` : ""}.`
      : status === "typology"
      ? `A ligação é tipológica ou de desenvolvimento canônico, sustentada pelas referências recuperadas${supportRefs.length ? ` (${supportRefs.join(", ")})` : ""}; não deve ser apresentada como profecia explícita.`
      : `${sourceLabel} não apresenta, nas evidências recuperadas, uma profecia explícita cujo cumprimento deva ser afirmado aqui.`;
  }

  const ntEvidence = evidence.filter((item) => item.testament === "NT");
  if (!newTestament.length && ntEvidence.length) {
    for (const item of ntEvidence.slice(0, 4)) newTestament.push({ reference: item.reference, explanation: fallbackExplanation(item) });
  }
  if (!parallels.length) {
    for (const item of evidence.filter((item) => !newTestament.some((existing) => normalizeReference(existing.reference) === normalizeReference(item.reference))).slice(0, 2)) {
      parallels.push({ reference: item.reference, explanation: fallbackExplanation(item) });
    }
  }

  return {
    new_testament: newTestament,
    parallels,
    recurring_themes: recurringThemes,
    prophecy_fulfillment: {
      status,
      explanation: prophecyExplanation,
      references: supportRefs,
    },
  };
}

function renderItems(title: string, items: ConnectionItem[], used: Set<string>) {
  const lines: string[] = [];
  for (const item of items) {
    const key = normalizeReference(item.reference);
    if (used.has(key)) continue;
    used.add(key);
    lines.push(`- **${item.reference}** — ${item.explanation}`);
  }
  return lines.length ? `**${title}**\n${lines.join("\n")}` : "";
}

export function renderCanonicalConnections(connections: CanonicalConnections) {
  const used = new Set<string>();
  const sections: string[] = [];
  const nt = renderItems("Conexões no Novo Testamento", connections.new_testament, used);
  if (nt) sections.push(nt);
  const parallels = renderItems("Paralelos diretos", connections.parallels, used);
  if (parallels) sections.push(parallels);
  const themes = renderItems("Temas recorrentes", connections.recurring_themes, used);
  if (themes) sections.push(themes);

  const prophecyRefs = connections.prophecy_fulfillment.references.filter((reference) => !used.has(normalizeReference(reference)));
  const prophecySuffix = prophecyRefs.length ? ` Referências relacionadas: ${prophecyRefs.join(", ")}.` : "";
  sections.push(`**Profecia / cumprimento**\n${connections.prophecy_fulfillment.explanation}${prophecySuffix}`);
  return sections.filter(Boolean).join("\n\n").trim();
}

export async function generateCanonicalConnectionsAnswer(args: {
  systemPrompt: string;
  sourceLabel: string;
  sourceText: string;
  userMessage: string;
  evidence: CanonicalEvidence[];
  conversationMode?: "normal" | "study" | "concise";
}) {
  const semanticEvidence = await retrieveSemanticBibleEvidence({
    sourceLabel: args.sourceLabel,
    sourceText: args.sourceText,
    userMessage: args.userMessage,
    bibleVersion: "ARC",
    matchCount: 18,
    minSimilarity: 0.46,
  });

  const merged = new Map<string, CanonicalEvidence>();
  for (const item of [...args.evidence, ...semanticEvidence]) {
    const key = normalizeReference(item.reference);
    if (!key) continue;
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, item);
      continue;
    }
    merged.set(key, {
      ...existing,
      score: Math.max(existing.score, item.score) + 2,
      text: existing.text.length >= item.text.length ? existing.text : item.text,
      matchedEntities: unique([...existing.matchedEntities, ...item.matchedEntities]),
      matchedTerms: unique([...existing.matchedTerms, ...item.matchedTerms]),
    });
  }

  const evidence = [...merged.values()]
    .sort((a, b) => b.score - a.score || (a.testament === "NT" ? -1 : 1) || a.reference.localeCompare(b.reference, "pt-BR"))
    .slice(0, 14);

  if (!evidence.length) {
    return `Não encontrei referências cruzadas fortes o suficiente no acervo bíblico para afirmar conexões de ${args.sourceLabel} com segurança. Prefiro não inventar relações.`;
  }

  const evidenceText = evidence.map((item) => `${item.reference} | ${item.text}`).join("\n");
  const response = await aiChatFetchWithProviders({
    model: "llama-3.3-70b-versatile",
    messages: [
      {
        role: "system",
        content: `${args.systemPrompt}\n\nVocê está usando o MOTOR CANÔNICO HÍBRIDO DO ATIS. A passagem-base e cada referência candidata abaixo foram recuperadas da Bíblia do próprio app por busca lexical e/ou semântica. Sua função é somente interpretar relações sustentáveis entre esses textos.\n\nREGRAS\n- Não crie referências que não estejam na lista de evidências.\n- Dê prioridade máxima a referências que mencionem diretamente personagens ou acontecimentos da passagem-base.\n- Use evidência semântica para descobrir relações conceituais que não repetem necessariamente as mesmas palavras, mas descarte semelhanças vagas ou apenas temáticas demais.\n- Se a passagem-base for do Antigo Testamento, destaque conexões explícitas do Novo Testamento quando existirem.\n- Diferencie rigorosamente profecia explícita, tipologia/desenvolvimento canônico e simples paralelo. Não chame tipologia de cumprimento profético.\n- Nunca deixe a parte de profecia/cumprimento vazia: quando não houver profecia explícita, diga isso claramente e explique eventual tipologia ou contraste bíblico.\n- Prefira 4 a 6 conexões realmente fortes a muitas conexões fracas.\n- Não transcreva versículos nem escreva links.\n- Retorne SOMENTE JSON válido no formato: {"new_testament":[{"reference":"Livro 1:1","explanation":"..."}],"parallels":[{"reference":"Livro 2:2","explanation":"..."}],"recurring_themes":[{"reference":"Livro 3:3","explanation":"..."}],"prophecy_fulfillment":{"status":"explicit|typology|none","explanation":"...","references":["Livro 4:4"]}}.`,
      },
      {
        role: "user",
        content: `PASSAGEM-BASE (${args.sourceLabel})\n${args.sourceText}\n\nPERGUNTA\n${args.userMessage}\n\nEVIDÊNCIAS CANÔNICAS VERIFICADAS\n${evidenceText}`,
      },
    ],
    temperature: 0.25,
    reasoning_effort: "low",
    reasoning_format: "hidden",
    max_tokens: args.conversationMode === "concise" ? 700 : 1500,
  }, ["groq", "gemini"]);

  let parsed: unknown = null;
  if (response.ok) {
    const body = await response.json().catch(() => null) as any;
    const text = body?.choices?.[0]?.message?.content;
    if (typeof text === "string") parsed = parseJsonObject(text);
  }
  const validated = validateCanonicalConnectionsPayload(parsed, evidence, args.sourceLabel);
  return renderCanonicalConnections(validated);
}
