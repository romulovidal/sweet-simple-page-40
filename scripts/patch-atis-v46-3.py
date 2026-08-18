from pathlib import Path

canonical_path = Path('supabase/functions/_shared/atis/canonical-bible.ts')
test_path = Path('supabase/functions/_shared/atis/canonical-bible_test.ts')

canonical = canonical_path.read_text()
tests = test_path.read_text()

old = '''  const merged = new Map<string, CanonicalEvidence>();
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
'''

new = '''  const evidence = mergeHybridCanonicalEvidence(args.evidence, semanticEvidence, 8, 10);
'''

if old not in canonical:
    raise SystemExit('hybrid merge anchor missing')

helper_anchor = '''export async function generateCanonicalConnectionsAnswer(args: {'''
helper = '''export function mergeHybridCanonicalEvidence(
  lexicalEvidence: CanonicalEvidence[],
  semanticEvidence: CanonicalEvidence[],
  lexicalSlots = 8,
  semanticSlots = 10,
) {
  const lexical = [...lexicalEvidence]
    .sort((a, b) => b.score - a.score || (a.testament === "NT" ? -1 : 1) || a.reference.localeCompare(b.reference, "pt-BR"))
    .slice(0, Math.max(0, lexicalSlots));
  const semantic = [...semanticEvidence]
    .sort((a, b) => b.score - a.score || (a.testament === "NT" ? -1 : 1) || a.reference.localeCompare(b.reference, "pt-BR"))
    .slice(0, Math.max(0, semanticSlots));

  const merged = new Map<string, CanonicalEvidence>();
  // Reserve candidates from each retriever BEFORE global scoring. This prevents
  // strong lexical scores from starving concept/vector evidence entirely.
  for (const item of [...lexical, ...semantic]) {
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

  return [...merged.values()]
    .sort((a, b) => b.score - a.score || (a.testament === "NT" ? -1 : 1) || a.reference.localeCompare(b.reference, "pt-BR"))
    .slice(0, Math.max(1, lexicalSlots + semanticSlots));
}

'''
if helper_anchor not in canonical:
    raise SystemExit('helper insertion anchor missing')

canonical = canonical.replace(helper_anchor, helper + helper_anchor)
canonical = canonical.replace(old, new)

tests = tests.replace(
    'import { retrieveCanonicalEvidence, renderCanonicalConnections, validateCanonicalConnectionsPayload } from "./canonical-bible.ts";',
    'import { mergeHybridCanonicalEvidence, retrieveCanonicalEvidence, renderCanonicalConnections, validateCanonicalConnectionsPayload } from "./canonical-bible.ts";'
)

tests += '''\n\nDeno.test("hybrid fusion reserves semantic evidence even when lexical scores dominate", () => {
  const lexical = Array.from({ length: 20 }, (_, index) => ({
    reference: `Livro Lexical ${index + 1}:1`,
    text: `Candidato lexical ${index + 1}`,
    score: 100 - index,
    testament: "OT" as const,
    matchedEntities: [`entidade-${index}`],
    matchedTerms: [],
  }));
  const semantic = [
    {
      reference: "João 3:13-20",
      text: "Como Moisés levantou a serpente no deserto, assim importa que o Filho do Homem seja levantado.",
      score: 8,
      testament: "NT" as const,
      matchedEntities: [],
      matchedTerms: ["conceptual", "moises", "serpente"],
    },
    ...Array.from({ length: 9 }, (_, index) => ({
      reference: `Livro Semântico ${index + 1}:1`,
      text: `Candidato semântico ${index + 1}`,
      score: 7 - index / 10,
      testament: "NT" as const,
      matchedEntities: [],
      matchedTerms: ["conceptual"],
    })),
  ];

  const merged = mergeHybridCanonicalEvidence(lexical, semantic, 8, 10);
  assert(merged.some((item) => item.reference === "João 3:13-20"));
  assertEquals(merged.filter((item) => item.reference.startsWith("Livro Lexical")).length, 8);
  assertEquals(merged.filter((item) => item.reference.startsWith("Livro Semântico") || item.reference === "João 3:13-20").length, 10);
});
'''

canonical_path.write_text(canonical)
test_path.write_text(tests)
print('ATIS v46.3 patch applied')
