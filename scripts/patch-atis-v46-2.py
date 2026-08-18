from pathlib import Path
import re

canonical_path = Path('supabase/functions/_shared/atis/canonical-bible.ts')
semantic_path = Path('supabase/functions/_shared/atis/semantic-bible.ts')
test_path = Path('supabase/functions/_shared/atis/canonical-bible_test.ts')
semantic_test_path = Path('supabase/functions/_shared/atis/semantic-bible_test.ts')

canonical = canonical_path.read_text()
semantic = semantic_path.read_text()
tests = test_path.read_text()
semantic_tests = semantic_test_path.read_text()

old_generic = '''const GENERIC_CAPITALIZED = new Set([\n  "e", "mas", "entao", "disse", "porque", "quando", "depois", "assim", "ora", "logo", "senhor", "deus", "eis", "portanto",\n]);'''
new_generic = '''const GENERIC_CAPITALIZED = new Set([\n  "e", "mas", "entao", "disse", "porque", "quando", "depois", "assim", "ora", "logo", "senhor", "deus", "eis", "portanto",\n  "por", "pois", "havemos", "houver", "contudo", "todavia", "entretanto", "ainda", "todos", "todas", "todo", "toda",\n  "este", "esta", "estes", "estas", "aquele", "aquela", "aqueles", "aquelas", "pelo", "pela", "pelos", "pelas",\n  "nos", "nas", "aos", "qual", "quais", "onde", "aonde", "entretanto", "tambem", "então", "porquanto", "assim",\n]);'''
if old_generic not in canonical:
    raise SystemExit('canonical generic stopword anchor missing')
canonical = canonical.replace(old_generic, new_generic)

old_entities = '''function sourceEntities(sourceText: string) {\n  const found = sourceText.match(/\\b[\\p{Lu}À-Ý][\\p{L}À-ÿ'’-]{2,}\\b/gu) ?? [];\n  return unique(found.map(normalize))\n    .filter((token) => token.length >= 3 && !STOPWORDS.has(token) && !GENERIC_CAPITALIZED.has(token));\n}'''
new_entities = '''export function extractCanonicalEntities(sourceText: string) {\n  const found = sourceText.match(/\\b[\\p{Lu}À-Ý][\\p{L}À-ÿ'’-]{2,}\\b/gu) ?? [];\n  return unique(found.map(normalize))\n    .filter((token) => token.length >= 3 && !STOPWORDS.has(token) && !GENERIC_CAPITALIZED.has(token));\n}'''
if old_entities not in canonical:
    raise SystemExit('canonical entity anchor missing')
canonical = canonical.replace(old_entities, new_entities).replace('const entities = sourceEntities(sourceText);', 'const entities = extractCanonicalEntities(sourceText);')

ref_anchor = '''function normalizeReference(value: string) {\n  return normalize(value).replace(/\\s+/g, " ");\n}\n'''
ref_helpers = r'''

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
'''
if ref_anchor not in canonical:
    raise SystemExit('reference helper anchor missing')
canonical = canonical.replace(ref_anchor, ref_anchor + ref_helpers)

validate_pattern = re.compile(r'function validateItems\(raw: unknown, allowed: Map<string, CanonicalEvidence>, maxItems: number\): ConnectionItem\[\] \{.*?\n\}\n\nexport function validateCanonicalConnectionsPayload\(raw: unknown, evidence: CanonicalEvidence\[], sourceLabel: string\): CanonicalConnections \{.*?\n\}\n\nfunction renderItems', re.S)
validate_replacement = r'''function validateItems(raw: unknown, evidence: CanonicalEvidence[], maxItems: number): ConnectionItem[] {
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

  const requestedProphecyRefs = Array.isArray(prophecyRaw.references)
    ? prophecyRaw.references.filter((item: unknown): item is string => typeof item === "string")
    : [];
  const resolvedProphecyRefs = requestedProphecyRefs
    .map((reference) => resolveEvidenceReference(reference, evidence)?.reference ?? null)
    .filter(Boolean) as string[];

  const rawProphecyExplanation = typeof prophecyRaw.explanation === "string"
    ? prophecyRaw.explanation.trim().replace(/\s+/g, " ")
    : "";
  const explanationRefs = extractBibleReferences(rawProphecyExplanation);
  const unsupportedExplanationRef = explanationRefs.some((reference) => !resolveEvidenceReference(reference, evidence));
  const groundedExplanationRefs = explanationRefs
    .map((reference) => resolveEvidenceReference(reference, evidence)?.reference ?? null)
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

function renderItems'''
canonical, count = validate_pattern.subn(validate_replacement, canonical)
if count != 1:
    raise SystemExit(f'canonical validator replacement count={count}')

# Add deterministic, quota-independent source terms to the concept bridge.
semantic_anchor = '''export function sanitizeConceptTerms(raw: unknown): string[] {'''
stop_block = '''const CONCEPT_STOPWORDS = new Set([\n  "ainda", "assim", "antes", "aquela", "aquele", "aqui", "como", "contra", "depois", "desde", "disse", "entao",\n  "estava", "este", "esta", "feito", "foram", "havia", "isso", "isto", "mais", "muito", "nao", "para", "pela", "pelo",\n  "porque", "quando", "quanto", "quem", "senhor", "deus", "tambem", "tinha", "todo", "toda", "todos", "todas", "uma", "umas",\n  "uns", "povo", "coisa", "coisas", "eis", "pois", "porquanto", "havemos", "sendo", "tendo", "conexoes", "biblicas", "biblica",\n  "novo", "testamento", "profecia", "cumprimento", "passagem", "texto", "versiculo", "versiculos", "explique", "explicacao",\n]);\n\nexport function deterministicConceptTerms(sourceText: string, userMessage: string) {\n  const sourceTokens = normalize(sourceText).split(" ").filter(Boolean);\n  const frequency = new Map<string, number>();\n  for (const token of sourceTokens) {\n    if (token.length < 4 || /\\d/.test(token) || CONCEPT_STOPWORDS.has(token)) continue;\n    frequency.set(token, (frequency.get(token) ?? 0) + 1);\n  }\n  const sourceTerms = [...frequency.entries()]\n    .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)\n    .map(([token]) => token)\n    .slice(0, 10);\n  const queryTerms = normalize(userMessage).split(" ")\n    .filter((token) => token.length >= 4 && !/\\d/.test(token) && !CONCEPT_STOPWORDS.has(token))\n    .slice(0, 4);\n  return unique([...sourceTerms, ...queryTerms]).slice(0, 12);\n}\n\n'''
if semantic_anchor not in semantic:
    raise SystemExit('semantic sanitizer anchor missing')
semantic = semantic.replace(semantic_anchor, stop_block + semantic_anchor)

old_bridge = '''    const terms = await expandConceptTerms(args.sourceLabel, args.sourceText, args.userMessage);\n    if (!terms.length) return [];\n    const rows = await conceptRpc(terms, args.bibleVersion, Math.max(args.matchCount * 2, 32));'''
new_bridge = '''    const deterministic = deterministicConceptTerms(args.sourceText, args.userMessage);\n    const expanded = await expandConceptTerms(args.sourceLabel, args.sourceText, args.userMessage);\n    const terms = sanitizeConceptTerms([...deterministic, ...expanded]);\n    if (!terms.length) return [];\n    const rows = await conceptRpc(terms, args.bibleVersion, Math.max(args.matchCount * 2, 32));'''
if old_bridge not in semantic:
    raise SystemExit('semantic bridge anchor missing')
semantic = semantic.replace(old_bridge, new_bridge)

# Permanent canonical guard regressions.
tests += r'''

Deno.test("canonical entity extraction ignores narrative sentence starters", async () => {
  const { extractCanonicalEntities } = await import("./canonical-bible.ts");
  const entities = extractCanonicalEntities("Por isso o povo saiu. Pois havemos de ver. Moisés levantou a serpente. E Moisés orou.");
  assertEquals(entities.includes("por"), false);
  assertEquals(entities.includes("pois"), false);
  assertEquals(entities.includes("havemos"), false);
  assert(entities.includes("moises"));
});

Deno.test("canonical validator rejects unsupported references hidden inside explanations", () => {
  const evidence = [{
    reference: "Marcos 5:31-38",
    text: "Jesus fala de fé e cura.",
    score: 10,
    testament: "NT" as const,
    matchedEntities: [],
    matchedTerms: ["fé", "cura"],
  }];
  const validated = validateCanonicalConnectionsPayload({
    new_testament: [{
      reference: "Marcos 5:31-38",
      explanation: "Isto se cumpre diretamente em João 3:14-15.",
    }],
    prophecy_fulfillment: {
      status: "typology",
      explanation: "João 3:14-15 identifica o cumprimento.",
      references: [],
    },
  }, evidence, "Números 21:4-9");
  assertEquals(validated.new_testament[0]?.explanation.includes("João 3:14-15"), false);
  assertEquals(validated.prophecy_fulfillment.status, "none");
  assertEquals(validated.prophecy_fulfillment.explanation.includes("João 3:14-15"), false);
});

Deno.test("canonical validator accepts a subrange only when a recovered ARC chunk covers it", () => {
  const evidence = [{
    reference: "João 3:13-20",
    text: "Como Moisés levantou a serpente no deserto, assim importa que o Filho do Homem seja levantado.",
    score: 25,
    testament: "NT" as const,
    matchedEntities: [],
    matchedTerms: ["conceptual", "serpente", "moises"],
  }];
  const validated = validateCanonicalConnectionsPayload({
    new_testament: [{
      reference: "João 3:14-15",
      explanation: "João 3:14-15 retoma explicitamente Moisés e a serpente levantada no deserto.",
    }],
    prophecy_fulfillment: {
      status: "typology",
      explanation: "João 3:14-15 estabelece a tipologia entre a serpente levantada e o Filho do Homem levantado.",
      references: ["João 3:14-15"],
    },
  }, evidence, "Números 21:4-9");
  assertEquals(validated.new_testament[0]?.reference, "João 3:14-15");
  assertEquals(validated.prophecy_fulfillment.status, "typology");
  assert(validated.prophecy_fulfillment.references.includes("João 3:14-15"));
});
'''

semantic_tests = semantic_tests.replace(
    'import { conceptRowsToEvidence, sanitizeConceptTerms } from "./semantic-bible.ts";',
    'import { conceptRowsToEvidence, deterministicConceptTerms, sanitizeConceptTerms } from "./semantic-bible.ts";'
)
semantic_tests += r'''

Deno.test("deterministic concept terms extract useful Números 21 concepts without AI", () => {
  const terms = deterministicConceptTerms(
    "Então o povo falou contra Deus e contra Moisés. O SENHOR mandou serpentes ardentes. Moisés orou pelo povo. Faze uma serpente ardente e põe-na sobre uma haste; todo mordido que olhar para ela viverá.",
    "Quais as conexões bíblicas no Novo Testamento e profecia cumprimento?",
  );
  assert(terms.includes("moises"));
  assert(terms.some((term) => term.startsWith("serpente")));
  assert(terms.includes("haste"));
  assertEquals(terms.includes("povo"), false);
  assertEquals(terms.includes("senhor"), false);
});
'''

canonical_path.write_text(canonical)
semantic_path.write_text(semantic)
test_path.write_text(tests)
semantic_test_path.write_text(semantic_tests)
print('ATIS v46.2 patch applied')
