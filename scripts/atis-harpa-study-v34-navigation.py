from pathlib import Path

RUNTIME = Path("supabase/functions/_shared/atis/conversation-runtime.ts")
INSIGHTS = Path("src/components/admin/atis/AtisDestinationInsights.tsx")
TEST = Path("supabase/functions/_shared/atis/harpa-study-navigation_test.ts")


def once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected 1 anchor, got {count}")
    return text.replace(old, new, 1)

runtime = RUNTIME.read_text()
runtime = once(
    runtime,
    '  if (route === "harpa_lookup") return `${base}/harpa`;',
    '  if (route === "harpa_lookup" || route === "harpa_study") return `${base}/harpa`;',
    "continue in app Harpa route",
)
runtime = once(
    runtime,
    '  if (route === "harpa_lookup" || route === "canticos_info") {',
    '  if (route === "harpa_lookup" || route === "harpa_study" || route === "canticos_info") {',
    "Harpa buttons",
)
RUNTIME.write_text(runtime)

insights = INSIGHTS.read_text()
insights = once(
    insights,
    '  harpa_lookup: "Harpa",',
    '  harpa_lookup: "Harpa",\n  harpa_study: "Estudo da Harpa",',
    "Harpa study metric label",
)
INSIGHTS.write_text(insights)

TEST.write_text('''import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";\nimport { assistantButtons, continueInAppLink } from "./conversation-runtime.ts";\n\nDeno.test("Harpa study continues in Harpa area", () => {\n  assertEquals(continueInAppLink("harpa_study", "Harpa 15"), "https://biblia.atalaias.online/harpa");\n});\n\nDeno.test("Harpa study uses Harpa quick actions", () => {\n  const ids = assistantButtons("harpa_study").map((button) => button.id);\n  assertEquals(ids, ["atis:app", "atis:mode:study"]);\n});\n''')

print("ATIS Harpa study v34 navigation patch applied")
