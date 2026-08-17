from pathlib import Path

# Backend: expose a read-only consolidated view of per-destination automations.
p = Path("supabase/functions/atis-console/index.ts")
text = p.read_text()
insert_at = text.index("\nasync function automationSave", text.index("async function automationsList"))
function = r'''

async function specializedAutomationsList(supabase: any) {
  const { data, error } = await supabase
    .from("atis_destination_feature_settings")
    .select("id,destination_type,contact_id,individual_id,group_id,feature_key,enabled,schedule_mode,custom_time,timezone,updated_at")
    .eq("feature_kind", "automation")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  const settings = data ?? [];

  const contactIds = [...new Set(settings.filter((row: any) => row.destination_type === "contact" && row.contact_id).map((row: any) => row.contact_id))];
  const individualIds = [...new Set(settings.filter((row: any) => row.destination_type === "individual" && row.individual_id).map((row: any) => row.individual_id))];
  const groupIds = [...new Set(settings.filter((row: any) => row.destination_type === "group" && row.group_id).map((row: any) => row.group_id))];

  const [contacts, individuals, groups] = await Promise.all([
    contactIds.length
      ? supabase.from("atis_contacts").select("id,name,phone_e164,blocked,is_active,whatsapp_opt_in,reactivation_requires_app").in("id", contactIds)
      : Promise.resolve({ data: [], error: null }),
    individualIds.length
      ? supabase.from("atis_individuals").select("id,name,phone_e164,blocked,is_active,allow_messages").in("id", individualIds)
      : Promise.resolve({ data: [], error: null }),
    groupIds.length
      ? supabase.from("atis_groups").select("id,name,provider_group_id,allow_automations,is_active,provider_exists").in("id", groupIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  for (const result of [contacts, individuals, groups]) if (result.error) throw result.error;

  const contactById = new Map((contacts.data ?? []).map((row: any) => [row.id, row]));
  const individualById = new Map((individuals.data ?? []).map((row: any) => [row.id, row]));
  const groupById = new Map((groups.data ?? []).map((row: any) => [row.id, row]));

  return settings.map((row: any) => {
    const type = row.destination_type as DestinationType;
    const destinationId = type === "contact" ? row.contact_id : type === "individual" ? row.individual_id : row.group_id;
    const destination = type === "contact" ? contactById.get(destinationId) : type === "individual" ? individualById.get(destinationId) : groupById.get(destinationId);
    let destinationAllowed = false;
    if (type === "contact") {
      destinationAllowed = Boolean(destination && destination.blocked !== true && destination.is_active === true && destination.whatsapp_opt_in === true && destination.reactivation_requires_app !== true);
    } else if (type === "individual") {
      destinationAllowed = Boolean(destination && destination.blocked !== true && destination.is_active === true && destination.allow_messages === true);
    } else {
      destinationAllowed = Boolean(destination && destination.is_active === true && destination.provider_exists !== false && destination.allow_automations === true);
    }
    const fallback = type === "group" ? destination?.provider_group_id : destination?.phone_e164;
    return {
      id: row.id,
      destination_type: type,
      destination_id: destinationId,
      destination_name: firstString(destination?.name, fallback) ?? "Destinatário",
      feature_key: row.feature_key,
      enabled: row.enabled === true,
      destination_allowed: destinationAllowed,
      effective_enabled: row.enabled === true && destinationAllowed,
      schedule_mode: row.schedule_mode ?? "system",
      custom_time: row.custom_time?.slice?.(0, 8) ?? null,
      timezone: row.timezone ?? "America/Fortaleza",
      updated_at: row.updated_at,
    };
  });
}
'''
text = text[:insert_at] + function + text[insert_at:]
action = '    if (action === "automations_list") return json({ ok: true, rows: await automationsList(supabase) });\n'
if action not in text:
    raise SystemExit("atis-console automations_list action anchor missing")
text = text.replace(action, action + '    if (action === "specialized_automations_list") return json({ ok: true, rows: await specializedAutomationsList(supabase) });\n', 1)
p.write_text(text)

# Frontend: keep general automations editor and add the specialized operational view below it.
p = Path("src/components/admin/atis/AtisAutomations.tsx")
text = p.read_text()
import_anchor = 'import { supabase } from "@/integrations/supabase/client";\n'
component_import = 'import AtisSpecializedAutomations from "./AtisSpecializedAutomations";\n'
if component_import not in text:
    if import_anchor not in text:
        raise SystemExit("AtisAutomations import anchor missing")
    text = text.replace(import_anchor, import_anchor + component_import, 1)
old_description = 'Crie rotinas recorrentes usando o motor e a fila já existentes. Grupos só recebem automações quando essa permissão estiver ativa no próprio grupo.'
new_description = 'Crie rotinas gerais no motor de automações. Logo abaixo, acompanhe também as rotinas especializadas configuradas diretamente por contato, indivíduo ou grupo.'
if old_description not in text:
    raise SystemExit("AtisAutomations header description anchor missing")
text = text.replace(old_description, new_description, 1)
modal_anchor = '      {editing && <div className="fixed inset-0 z-[90]'
if modal_anchor not in text:
    raise SystemExit("AtisAutomations modal anchor missing")
text = text.replace(modal_anchor, '      <AtisSpecializedAutomations />\n\n' + modal_anchor, 1)
p.write_text(text)
