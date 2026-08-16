type SupabaseClient = any;

type ResolvedRecipient = {
  target_type: "contact" | "group";
  target_key: string;
  contact_id?: string | null;
  group_id?: string | null;
  phone_e164?: string | null;
  provider_target_id?: string | null;
  display_name?: string | null;
  variables: Record<string, string>;
};

function fieldValueParts(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    weekday: "short",
  });
  const parts = Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]));
  const weekdayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour) % 24,
    minute: Number(parts.minute),
    weekday: weekdayMap[parts.weekday] ?? 0,
  };
}

function normalizeDow(value: number) {
  return value === 7 ? 0 : value;
}

function numericRange(min: number, max: number) {
  const values: number[] = [];
  for (let value = min; value <= max; value++) values.push(value);
  return values;
}

function expandCronField(expression: string, min: number, max: number, dayOfWeek = false) {
  const values = new Set<number>();
  const input = expression.trim();
  if (!input) throw new Error("EMPTY_CRON_FIELD");

  for (const segmentRaw of input.split(",")) {
    const segment = segmentRaw.trim();
    if (!segment) throw new Error("INVALID_CRON_FIELD");

    const [base, stepRaw] = segment.split("/");
    const step = stepRaw === undefined ? 1 : Number(stepRaw);
    if (!Number.isInteger(step) || step <= 0) throw new Error("INVALID_CRON_STEP");

    let candidates: number[];
    if (base === "*") {
      candidates = numericRange(min, max);
    } else if (base.includes("-")) {
      const [fromRaw, toRaw] = base.split("-");
      const from = Number(fromRaw);
      const to = Number(toRaw);
      if (!Number.isInteger(from) || !Number.isInteger(to) || from > to || from < min || to > max) {
        throw new Error("INVALID_CRON_RANGE");
      }
      candidates = numericRange(from, to);
    } else {
      const value = Number(base);
      if (!Number.isInteger(value) || value < min || value > max) throw new Error("INVALID_CRON_VALUE");
      candidates = [value];
    }

    for (let index = 0; index < candidates.length; index += step) {
      values.add(dayOfWeek ? normalizeDow(candidates[index]) : candidates[index]);
    }
  }

  return values;
}

export function validateCronExpression(expression: string) {
  const fields = expression.trim().split(/\s+/);
  if (fields.length !== 5) throw new Error("CRON_REQUIRES_FIVE_FIELDS");
  expandCronField(fields[0], 0, 59);
  expandCronField(fields[1], 0, 23);
  expandCronField(fields[2], 1, 31);
  expandCronField(fields[3], 1, 12);
  expandCronField(fields[4], 0, 7, true);
  return true;
}

export function cronMatches(expression: string, date: Date, timeZone: string) {
  validateCronExpression(expression);
  const [minuteExpr, hourExpr, domExpr, monthExpr, dowExpr] = expression.trim().split(/\s+/);
  const local = fieldValueParts(date, timeZone);

  const minuteMatch = expandCronField(minuteExpr, 0, 59).has(local.minute);
  const hourMatch = expandCronField(hourExpr, 0, 23).has(local.hour);
  const monthMatch = expandCronField(monthExpr, 1, 12).has(local.month);
  const domMatch = expandCronField(domExpr, 1, 31).has(local.day);
  const dowMatch = expandCronField(dowExpr, 0, 7, true).has(local.weekday);

  const domAny = domExpr === "*";
  const dowAny = dowExpr === "*";
  const dayMatch = domAny && dowAny ? true : domAny ? dowMatch : dowAny ? domMatch : domMatch || dowMatch;

  return minuteMatch && hourMatch && monthMatch && dayMatch;
}

function localMinuteKey(date: Date, timeZone: string) {
  const local = fieldValueParts(date, timeZone);
  return `${local.year}-${String(local.month).padStart(2, "0")}-${String(local.day).padStart(2, "0")}T${String(local.hour).padStart(2, "0")}:${String(local.minute).padStart(2, "0")}`;
}

function ptBrDateTime(date: Date, timeZone: string) {
  return {
    data: new Intl.DateTimeFormat("pt-BR", { timeZone, dateStyle: "short" }).format(date),
    hora: new Intl.DateTimeFormat("pt-BR", { timeZone, hour: "2-digit", minute: "2-digit" }).format(date),
  };
}

function renderTemplate(content: string, variables: Record<string, string>) {
  return content.replace(/{{\s*([a-zA-Z0-9_.-]+)\s*}}/g, (_match, key: string) => variables[key] ?? "");
}

function uniqueRecipients(items: ResolvedRecipient[]) {
  const map = new Map<string, ResolvedRecipient>();
  for (const item of items) if (!map.has(item.target_key)) map.set(item.target_key, item);
  return [...map.values()];
}

async function resolveContactRecipients(supabase: SupabaseClient, selector: any, automationType: string, local: ReturnType<typeof fieldValueParts>) {
  let query = supabase
    .from("atis_contacts")
    .select("id,name,phone_e164,tags,birth_date,metadata")
    .eq("is_active", true)
    .eq("whatsapp_opt_in", true);

  const mode = String(selector?.mode ?? (automationType === "birthday" ? "birthday" : "all_opted_in"));
  const contactIds = Array.isArray(selector?.contact_ids) ? selector.contact_ids.filter((id: unknown) => typeof id === "string") : [];
  const tags = Array.isArray(selector?.tags) ? selector.tags.filter((tag: unknown) => typeof tag === "string" && tag.trim()) : [];

  if (["contacts", "mixed"].includes(mode) && contactIds.length) query = query.in("id", contactIds);
  if (mode === "tags" && tags.length) query = query.overlaps("tags", tags);
  if (mode === "birthday" || automationType === "birthday") query = query.not("birth_date", "is", null);

  const { data, error } = await query;
  if (error) throw error;

  return (data ?? [])
    .filter((contact: any) => {
      if ((mode === "birthday" || automationType === "birthday") && contact.birth_date) {
        const [, month, day] = String(contact.birth_date).split("-").map(Number);
        return month === local.month && day === local.day;
      }
      return true;
    })
    .map((contact: any): ResolvedRecipient => ({
      target_type: "contact",
      target_key: `contact:${contact.id}`,
      contact_id: contact.id,
      phone_e164: contact.phone_e164,
      display_name: contact.name,
      variables: {
        nome: contact.name ?? "",
        name: contact.name ?? "",
        telefone: contact.phone_e164 ?? "",
        phone: contact.phone_e164 ?? "",
      },
    }));
}

async function resolveGroupRecipients(supabase: SupabaseClient, selector: any) {
  const mode = String(selector?.mode ?? "");
  if (!["groups", "mixed", "all_groups"].includes(mode)) return [] as ResolvedRecipient[];

  let query = supabase
    .from("atis_groups")
    .select("id,name,provider_group_id")
    .eq("is_active", true)
    .eq("allow_automations", true);

  const groupIds = Array.isArray(selector?.group_ids) ? selector.group_ids.filter((id: unknown) => typeof id === "string") : [];
  if (["groups", "mixed"].includes(mode)) {
    if (!groupIds.length) return [] as ResolvedRecipient[];
    query = query.in("id", groupIds);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((group: any): ResolvedRecipient => ({
    target_type: "group",
    target_key: `group:${group.id}`,
    group_id: group.id,
    provider_target_id: group.provider_group_id,
    display_name: group.name,
    variables: {
      nome: group.name ?? "",
      name: group.name ?? "",
      grupo: group.name ?? "",
      group: group.name ?? "",
    },
  }));
}

async function resolveRecipients(supabase: SupabaseClient, automation: any, now: Date) {
  const selector = automation.target_selector ?? {};
  const mode = String(selector?.mode ?? (automation.type === "birthday" ? "birthday" : "all_opted_in"));
  const local = fieldValueParts(now, automation.timezone || "America/Fortaleza");

  const contactModes = ["all_opted_in", "contacts", "tags", "mixed", "birthday"];
  const contacts = contactModes.includes(mode)
    ? await resolveContactRecipients(supabase, selector, automation.type, local)
    : [];
  const groups = await resolveGroupRecipients(supabase, selector);
  return uniqueRecipients([...contacts, ...groups]);
}

async function loadDefaultInstance(supabase: SupabaseClient, automation: any) {
  const configuredId = automation.config?.instance_id;
  const configuredName = automation.config?.instance_name || "atis-main";
  let query = supabase.from("atis_instances").select("*").limit(1);
  query = configuredId ? query.eq("id", configuredId) : query.eq("name", configuredName);
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("AUTOMATION_INSTANCE_NOT_FOUND");
  return data;
}

async function loadTemplate(supabase: SupabaseClient, automation: any) {
  if (!automation.template_id) {
    const inline = typeof automation.config?.content === "string" ? automation.config.content.trim() : "";
    if (!inline) throw new Error("AUTOMATION_TEMPLATE_REQUIRED");
    return { content: inline, key: "inline", variables: [] };
  }
  const { data, error } = await supabase
    .from("atis_templates")
    .select("id,key,content,variables,is_active")
    .eq("id", automation.template_id)
    .maybeSingle();
  if (error) throw error;
  if (!data || !data.is_active) throw new Error("AUTOMATION_TEMPLATE_NOT_ACTIVE");
  return data;
}

export async function processScheduledAutomations(
  supabase: SupabaseClient,
  options: { now?: Date; dryRun?: boolean; limit?: number } = {},
) {
  const now = options.now ?? new Date();
  const limit = Math.max(1, Math.min(50, options.limit ?? 20));
  const { data: automations, error } = await supabase
    .from("atis_automations")
    .select("*")
    .eq("enabled", true)
    .eq("trigger_type", "schedule")
    .not("schedule_cron", "is", null)
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) throw error;

  const due: any[] = [];
  const invalid: any[] = [];
  for (const automation of automations ?? []) {
    try {
      if (cronMatches(automation.schedule_cron, now, automation.timezone || "America/Fortaleza")) due.push(automation);
    } catch (error) {
      invalid.push({ id: automation.id, key: automation.key, error: error instanceof Error ? error.message : "INVALID_CRON" });
    }
  }

  if (options.dryRun) {
    return {
      evaluated: automations?.length ?? 0,
      due: due.map((automation) => ({ id: automation.id, key: automation.key, type: automation.type })),
      invalid,
      queued_messages: 0,
    };
  }

  let queuedMessages = 0;
  let skippedRuns = 0;
  const runs: any[] = [];

  for (const automation of due) {
    try {
      const timeZone = automation.timezone || "America/Fortaleza";
      const minuteKey = localMinuteKey(now, timeZone);
      const scheduledFor = new Date(Math.floor(now.getTime() / 60000) * 60000).toISOString();
      const idempotencyKey = `scheduler:${automation.id}:${timeZone}:${minuteKey}`;
      const [template, instance, recipients] = await Promise.all([
        loadTemplate(supabase, automation),
        loadDefaultInstance(supabase, automation),
        resolveRecipients(supabase, automation, now),
      ]);

      const common = ptBrDateTime(now, timeZone);
      const staticVariables = automation.config?.variables && typeof automation.config.variables === "object"
        ? Object.fromEntries(Object.entries(automation.config.variables).map(([key, value]) => [key, String(value ?? "")]))
        : {};
      const maxAttemptsRaw = Number(automation.config?.max_attempts ?? 3);
      const maxAttempts = Number.isInteger(maxAttemptsRaw) ? Math.max(1, Math.min(10, maxAttemptsRaw)) : 3;
      const priorityRaw = Number(automation.config?.priority ?? 0);
      const priority = Number.isInteger(priorityRaw) ? Math.max(-100, Math.min(100, priorityRaw)) : 0;

      const items = recipients.map((recipient) => {
        const content = renderTemplate(template.content, {
          ...staticVariables,
          ...recipient.variables,
          data: common.data,
          date: common.data,
          hora: common.hora,
          time: common.hora,
        }).trim();
        if (!content || content.length > 4096) throw new Error("AUTOMATION_RENDERED_CONTENT_INVALID");
        return {
          instance_id: instance.id,
          message_type: "text",
          content,
          priority,
          dedupe_key: `automation:${automation.id}:${minuteKey}:${recipient.target_key}`,
          target_type: recipient.target_type,
          target_key: recipient.target_key,
          contact_id: recipient.contact_id ?? null,
          group_id: recipient.group_id ?? null,
          phone_e164: recipient.phone_e164 ?? null,
          provider_target_id: recipient.provider_target_id ?? null,
          display_name: recipient.display_name ?? null,
          max_attempts: maxAttempts,
          message_metadata: { automation_key: automation.key, automation_type: automation.type, template_key: template.key },
          target_metadata: {},
        };
      });

      const { data: result, error: queueError } = await supabase.rpc("atis_enqueue_automation_batch", {
        _automation_id: automation.id,
        _scheduled_for: scheduledFor,
        _items: items,
        _trigger_source: "scheduler",
        _idempotency_key: idempotencyKey,
      });
      if (queueError) throw queueError;

      const created = Number(result?.messages_created ?? 0);
      queuedMessages += created;
      if (result?.status === "skipped") skippedRuns++;
      runs.push({ automation_id: automation.id, key: automation.key, ...result });
    } catch (error) {
      runs.push({
        automation_id: automation.id,
        key: automation.key,
        queued: false,
        error: error instanceof Error ? error.message : "AUTOMATION_FAILED",
      });
    }
  }

  return {
    evaluated: automations?.length ?? 0,
    due: due.length,
    invalid,
    queued_messages: queuedMessages,
    skipped_runs: skippedRuns,
    runs,
  };
}
