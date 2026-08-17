from pathlib import Path

# Use one unique continuity count even when ministry memory also reports context_source=memory.
p = Path("supabase/functions/_shared/atis/destination-insights.ts")
text = p.read_text()
old = '''  const memoryHits = contextCounts.get("memory") ?? 0;
  const ministryMemoryHits = rows.filter((row) => row.metadata?.context_memory_reason === "ministry_memory").length;
  const recommendations: string[] = [];'''
new = '''  const memoryHits = contextCounts.get("memory") ?? 0;
  const ministryMemoryHits = rows.filter((row) => row.metadata?.context_memory_reason === "ministry_memory").length;
  const continuityHits = rows.filter((row) => row.metadata?.context_source === "memory" || row.metadata?.context_memory_reason === "ministry_memory").length;
  const recommendations: string[] = [];'''
if old not in text:
    raise SystemExit("insights continuity anchor missing")
text = text.replace(old, new, 1)
old = '  if (memoryHits + ministryMemoryHits > 0) recommendations.push(`O contexto estruturado foi reaproveitado em ${memoryHits + ministryMemoryHits} interação(ões), sinal de continuidade real da conversa.`);'
new = '  if (continuityHits > 0) recommendations.push(`O contexto estruturado foi reaproveitado em ${continuityHits} interação(ões), sinal de continuidade real da conversa.`);'
if old not in text:
    raise SystemExit("insights recommendation continuity anchor missing")
text = text.replace(old, new, 1)
old = '''    memory_hits: memoryHits,
    ministry_memory_hits: ministryMemoryHits,'''
new = '''    memory_hits: memoryHits,
    ministry_memory_hits: ministryMemoryHits,
    continuity_hits: continuityHits,'''
if old not in text:
    raise SystemExit("insights return continuity anchor missing")
p.write_text(text)

# ATIS console: aggregate only operational metadata for a selected destination.
p = Path("supabase/functions/atis-console/index.ts")
text = p.read_text()
import_anchor = 'import { validateCronExpression } from "../_shared/atis/automation-engine.ts";\n'
insight_import = 'import { buildDestinationInsights } from "../_shared/atis/destination-insights.ts";\n'
if insight_import not in text:
    if import_anchor not in text:
        raise SystemExit("console import anchor missing")
    text = text.replace(import_anchor, import_anchor + insight_import, 1)

profile_save_start = text.index("async function profileSave")
insert_at = text.index("\nasync function dashboard", profile_save_start)
function = r'''

async function profileInsights(supabase: any, type: DestinationType, id: string, raw: Json) {
  await ensureDestination(supabase, type, id);
  const days = clampInt(raw.days, 30, 7, 90);
  const since = new Date(Date.now() - days * 24 * 3600_000).toISOString();
  const { data, error } = await supabase
    .from("atis_inbound_messages")
    .select("status,assistant_route,metadata,received_at")
    .gte("received_at", since)
    .contains("metadata", { destination_type: type, destination_id: id })
    .order("received_at", { ascending: false })
    .limit(5000);
  if (error) throw error;
  return buildDestinationInsights(data ?? [], type);
}
'''
text = text[:insert_at] + function + text[insert_at:]

profile_action = '    if (action === "profile_get") return json({ ok: true, profile: await profileGet(supabase, destinationType!, destinationId!) });\n'
if profile_action not in text:
    raise SystemExit("profile_get action anchor missing")
text = text.replace(profile_action, profile_action + '    if (action === "profile_insights") return json({ ok: true, insights: await profileInsights(supabase, destinationType!, destinationId!, data) });\n', 1)
p.write_text(text)

# Destination intelligence card: consume the unique continuity count.
p = Path("src/components/admin/atis/AtisDestinationInsights.tsx")
text = p.read_text()
old = '  ministry_memory_hits: number;\n'
new = '  ministry_memory_hits: number;\n  continuity_hits: number;\n'
if old not in text:
    raise SystemExit("destination insights type anchor missing")
text = text.replace(old, new, 1)
old = 'Memória reaproveitada: <strong className="text-[hsl(var(--dark-text))]">{data.memory_hits + data.ministry_memory_hits}</strong>'
new = 'Memória reaproveitada: <strong className="text-[hsl(var(--dark-text))]">{data.continuity_hits}</strong>'
if old not in text:
    raise SystemExit("destination insights memory display anchor missing")
text = text.replace(old, new, 1)
p.write_text(text)

# Conversation profile: place observed intelligence next to configured behavior.
p = Path("src/components/admin/atis/AtisConversationProfile.tsx")
text = p.read_text()
import_anchor = 'import type { AtisDestinationType } from "./AtisDestinationSettings";\n'
component_import = 'import AtisDestinationInsights from "./AtisDestinationInsights";\n'
if component_import not in text:
    if import_anchor not in text:
        raise SystemExit("conversation profile import anchor missing")
    text = text.replace(import_anchor, import_anchor + component_import, 1)
render_anchor = '    <div className="p-4 space-y-4">\n'
if render_anchor not in text:
    raise SystemExit("conversation profile body anchor missing")
text = text.replace(render_anchor, render_anchor + '      <AtisDestinationInsights destinationType={destinationType} destinationId={destinationId} />\n', 1)
p.write_text(text)
