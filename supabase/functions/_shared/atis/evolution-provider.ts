export type AtisInstanceStatus =
  | "disconnected"
  | "connecting"
  | "qr_required"
  | "connected"
  | "error"
  | "unknown";

export type EvolutionProviderConfig = {
  baseUrl: string;
  apiKey: string;
};

export class EvolutionProviderError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(message: string, status = 500, code = "EVOLUTION_ERROR", details?: unknown) {
    super(message);
    this.name = "EvolutionProviderError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const APP_ORIGIN = "https://biblia.atalaias.online";

const BIBLE_BOOK_ABBREV: Record<string, string> = {
  genesis: "gn", exodo: "ex", levitico: "lv", numeros: "nm", deuteronomio: "dt",
  josue: "js", juizes: "jz", rute: "rt", "1 samuel": "1sm", "2 samuel": "2sm",
  "1 reis": "1rs", "2 reis": "2rs", "1 cronicas": "1cr", "2 cronicas": "2cr",
  esdras: "ed", neemias: "ne", ester: "et", jo: "jó", salmos: "sl", proverbios: "pv",
  eclesiastes: "ec", cantares: "ct", isaias: "is", jeremias: "jr", lamentacoes: "lm",
  ezequiel: "ez", daniel: "dn", oseias: "os", joel: "jl", amos: "am", obadias: "ob",
  jonas: "jn", miqueias: "mq", naum: "na", habacuque: "hc", sofonias: "sf", ageu: "ag",
  zacarias: "zc", malaquias: "ml", mateus: "mt", marcos: "mc", lucas: "lc", joao: "jo",
  atos: "at", romanos: "rm", "1 corintios": "1co", "2 corintios": "2co", galatas: "gl",
  efesios: "ef", filipenses: "fp", colossenses: "cl", "1 tessalonicenses": "1ts",
  "2 tessalonicenses": "2ts", "1 timoteo": "1tm", "2 timoteo": "2tm", tito: "tt",
  filemom: "fm", hebreus: "hb", tiago: "tg", "1 pedro": "1pe", "2 pedro": "2pe",
  "1 joao": "1jo", "2 joao": "2jo", "3 joao": "3jo", judas: "jd", apocalipse: "ap",
};

function cleanBaseUrl(value: string) {
  let normalized = value.trim().replace(/\/+$/, "");
  if (normalized && !/^https?:\/\//i.test(normalized)) normalized = `https://${normalized}`;
  return normalized;
}

function safeJson(value: string): unknown {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return value.slice(0, 500);
  }
}

function firstString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function normalizeLookup(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

function normalizeState(raw: unknown): AtisInstanceStatus {
  const state = String(raw ?? "").trim().toLowerCase();

  if (["open", "connected", "online", "ready"].includes(state)) return "connected";
  if (["connecting", "opening"].includes(state)) return "connecting";
  if (["qrcode", "qr", "qr_required", "pairing"].includes(state)) return "qr_required";
  if (["close", "closed", "disconnected", "offline"].includes(state)) return "disconnected";
  if (["error", "failed"].includes(state)) return "error";
  return "unknown";
}

function providerMessageId(payload: any): string | null {
  return firstString(
    payload?.key?.id,
    payload?.messageId,
    payload?.id,
    payload?.data?.key?.id,
    payload?.data?.messageId,
  );
}

function parseBibleReply(text: string) {
  const firstLine = text.split("\n", 1)[0]?.trim() ?? "";
  const header = /^📖\s+\*([^*]+)\*$/u.exec(firstLine);
  if (!header?.[1]) return null;

  const label = header[1].trim();
  const parts = label.split(/\s+—\s+/u);
  const reference = parts[0]?.trim() ?? "";
  const version = parts[1]?.trim() || "ARC";
  const match = /^(.+?)\s+(\d+)(?::(\d+)(?:\s*[-–]\s*(\d+))?)?$/u.exec(reference);
  if (!match) return null;

  const bookName = match[1].trim();
  const chapter = Number(match[2]);
  const verseStart = match[3] ? Number(match[3]) : null;
  const verseEnd = match[4] ? Number(match[4]) : verseStart;
  if (!Number.isInteger(chapter) || chapter <= 0 || !verseStart || !verseEnd || verseEnd < verseStart) return null;
  if (verseEnd - verseStart + 1 > 50) return null;

  const bookAbbrev = BIBLE_BOOK_ABBREV[normalizeLookup(bookName)];
  if (!bookAbbrev) return null;
  const verses = Array.from({ length: verseEnd - verseStart + 1 }, (_, index) => verseStart + index);
  const body = text.slice(firstLine.length).trim();
  return { bookName, bookAbbrev, chapter, verseStart, verses, reference, version, body };
}

async function createGroupVerseShareLink(text: string) {
  if (text.includes(`${APP_ORIGIN}/v/`)) return null;
  const parsed = parseBibleReply(text);
  if (!parsed) return null;

  const params = new URLSearchParams({
    book: parsed.bookAbbrev,
    chapter: String(parsed.chapter),
    verse: String(parsed.verseStart),
    verses: parsed.verses.join(","),
  });
  const fallback = `${APP_ORIGIN}/biblia?${params.toString()}`;

  const supabaseUrl = Deno.env.get("SUPABASE_URL")?.trim();
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim();
  if (!supabaseUrl || !serviceKey) return fallback;

  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/create-verse-share`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({
        book_abbrev: parsed.bookAbbrev,
        chapter: parsed.chapter,
        verses: parsed.verses,
        text_snippet: parsed.body.replace(/\s+/g, " ").slice(0, 600),
        book_name: parsed.bookName,
        version: parsed.version,
      }),
    });
    const result = await response.json().catch(() => null) as any;
    if (response.ok && typeof result?.slug === "string" && result.slug.trim()) {
      return `${APP_ORIGIN}/v/${result.slug.trim()}`;
    }
    console.error("[atis-rich-link] verse share unavailable", response.status, result?.error ?? "unknown");
  } catch (error) {
    console.error("[atis-rich-link] verse share failed", (error as Error)?.message);
  }
  return fallback;
}

function parseHarpaReply(text: string) {
  const firstLine = text.split("\n", 1)[0]?.trim() ?? "";
  const match = /^🎵\s+\*Harpa Cristã\s+(\d+)\s+—\s+(.+?)\*$/u.exec(firstLine);
  if (!match) return null;
  const number = Number(match[1]);
  const title = match[2]?.trim() ?? "";
  return Number.isInteger(number) && number > 0 && title ? { number, title } : null;
}

async function findHarpaYoutubeLink(text: string) {
  if (/youtu\.be\/|youtube\.com\//i.test(text)) return null;
  const hymn = parseHarpaReply(text);
  if (!hymn) return null;

  const supabaseUrl = Deno.env.get("SUPABASE_URL")?.trim();
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim();
  if (!supabaseUrl || !serviceKey) return null;

  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/youtube-search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({ number: hymn.number, title: hymn.title }),
    });
    const result = await response.json().catch(() => null) as any;
    if (response.ok && typeof result?.videoId === "string" && result.videoId.trim()) {
      return `https://www.youtube.com/watch?v=${encodeURIComponent(result.videoId.trim())}`;
    }
    console.error("[atis-rich-link] YouTube search unavailable", response.status, result?.code ?? result?.error ?? "unknown");
  } catch (error) {
    console.error("[atis-rich-link] YouTube search failed", (error as Error)?.message);
  }
  return null;
}

async function enrichGroupReply(text: string) {
  let enriched = text.trim();

  // Explicit Bible lookups produced from the app JSON receive the exact same
  // short-share mechanism used by the app UI. If short-link allocation fails,
  // a direct /biblia URL is used so the answer itself is never blocked.
  const verseLink = await createGroupVerseShareLink(enriched);
  if (verseLink) {
    enriched = `${enriched}\n\n🔗 *Abrir e compartilhar na Bíblia do Atalaia:*\n${verseLink}`;
  }

  // Harpa content remains sourced from the app JSON. YouTube is used only to
  // resolve a listening link; a provider/API failure never blocks the hymn text.
  const youtubeLink = await findHarpaYoutubeLink(enriched);
  if (youtubeLink) {
    enriched = `${enriched}\n\n▶️ *Ouvir no YouTube:*\n${youtubeLink}`;
  }

  return enriched;
}

export class EvolutionProvider {
  readonly baseUrl: string;
  readonly apiKey: string;

  constructor(config: EvolutionProviderConfig) {
    if (!config.baseUrl?.trim()) {
      throw new EvolutionProviderError("Evolution API URL is not configured", 500, "EVOLUTION_URL_MISSING");
    }
    if (!config.apiKey?.trim()) {
      throw new EvolutionProviderError("Evolution API key is not configured", 500, "EVOLUTION_KEY_MISSING");
    }

    this.baseUrl = cleanBaseUrl(config.baseUrl);
    this.apiKey = config.apiKey.trim();
  }

  private async request(path: string, init: RequestInit = {}, timeoutMs = 15000) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        ...init,
        signal: controller.signal,
        headers: {
          apikey: this.apiKey,
          ...(init.body && !(init.body instanceof FormData) ? { "Content-Type": "application/json" } : {}),
          ...(init.headers ?? {}),
        },
      });

      const raw = await response.text();
      const body = safeJson(raw);

      if (!response.ok) {
        const providerMessage = firstString(
          (body as any)?.message,
          (body as any)?.error,
          (body as any)?.response?.message,
        );
        throw new EvolutionProviderError(
          providerMessage ?? `Evolution API returned HTTP ${response.status}`,
          response.status,
          `EVOLUTION_HTTP_${response.status}`,
          body,
        );
      }

      return body;
    } catch (error) {
      if (error instanceof EvolutionProviderError) throw error;
      if ((error as Error)?.name === "AbortError") {
        throw new EvolutionProviderError("Evolution API request timed out", 504, "EVOLUTION_TIMEOUT");
      }
      throw new EvolutionProviderError(
        (error as Error)?.message || "Evolution API request failed",
        502,
        "EVOLUTION_NETWORK_ERROR",
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  async health() {
    const body: any = await this.request("/", { method: "GET" }, 10000);
    return {
      ok: true,
      version: firstString(body?.version, body?.data?.version),
      message: firstString(body?.message, body?.status),
    };
  }

  async createInstance(instanceName: string) {
    const body: any = await this.request("/instance/create", {
      method: "POST",
      body: JSON.stringify({
        instanceName,
        integration: "WHATSAPP-BAILEYS",
        qrcode: true,
      }),
    });

    return {
      raw: body,
      instanceId: firstString(body?.instance?.instanceId, body?.instance?.id, body?.id),
      instanceName: firstString(body?.instance?.instanceName, body?.instance?.name, body?.name) ?? instanceName,
      providerState: firstString(body?.instance?.status, body?.instance?.state),
      status: normalizeState(body?.instance?.status ?? body?.instance?.state ?? "connecting"),
      qr: body?.qrcode?.base64 ?? null,
      pairingCode: body?.qrcode?.pairingCode ?? null,
      qrCount: typeof body?.qrcode?.count === "number" ? body.qrcode.count : null,
    };
  }

  async connect(instanceName: string) {
    const body: any = await this.request(`/instance/connect/${encodeURIComponent(instanceName)}`, { method: "GET" });
    return {
      raw: body,
      qr: body?.base64 ?? body?.qrcode?.base64 ?? null,
      pairingCode: body?.pairingCode ?? body?.qrcode?.pairingCode ?? null,
      qrCount: typeof body?.count === "number" ? body.count : typeof body?.qrcode?.count === "number" ? body.qrcode.count : null,
    };
  }

  async connectionState(instanceName: string) {
    const body: any = await this.request(`/instance/connectionState/${encodeURIComponent(instanceName)}`, { method: "GET" });
    const providerState = firstString(
      body?.instance?.state,
      body?.instance?.status,
      body?.state,
      body?.status,
    );

    return {
      raw: body,
      providerState,
      status: normalizeState(providerState),
      instanceName: firstString(body?.instance?.instanceName, body?.instanceName) ?? instanceName,
    };
  }

  async fetchInstances(instanceName?: string) {
    const suffix = instanceName ? `?instanceName=${encodeURIComponent(instanceName)}` : "";
    return await this.request(`/instance/fetchInstances${suffix}`, { method: "GET" });
  }

  async setWebhook(
    instanceName: string,
    url: string,
    events: string[],
    headers: Record<string, string> = {},
  ) {
    const body: any = await this.request(`/webhook/set/${encodeURIComponent(instanceName)}`, {
      method: "POST",
      body: JSON.stringify({
        webhook: {
          enabled: true,
          url,
          headers,
          byEvents: false,
          base64: false,
          events,
        },
      }),
    });
    return { raw: body };
  }

  async findWebhook(instanceName: string) {
    return await this.request(`/webhook/find/${encodeURIComponent(instanceName)}`, { method: "GET" });
  }

  async restart(instanceName: string) {
    const body = await this.request(`/instance/restart/${encodeURIComponent(instanceName)}`, { method: "POST" });
    return { raw: body };
  }

  async logout(instanceName: string) {
    const body = await this.request(`/instance/logout/${encodeURIComponent(instanceName)}`, { method: "DELETE" });
    return { raw: body };
  }

  // Intentionally no contact-book lookup method here. ATIS must never import or
  // enumerate the connected phone's personal WhatsApp address book.

  async fetchAllGroups(instanceName: string, getParticipants = true) {
    const query = `?getParticipants=${getParticipants ? "true" : "false"}`;
    const body = await this.request(`/group/fetchAllGroups/${encodeURIComponent(instanceName)}${query}`, {
      method: "GET",
    }, 30000);

    return Array.isArray(body) ? body : Array.isArray((body as any)?.data) ? (body as any).data : [];
  }

  async sendText(instanceName: string, target: string, text: string, delay = 0) {
    const finalText = target.endsWith("@g.us") ? await enrichGroupReply(text) : text;
    const body: any = await this.request(`/message/sendText/${encodeURIComponent(instanceName)}`, {
      method: "POST",
      body: JSON.stringify({
        number: target,
        text: finalText,
        ...(delay > 0 ? { delay } : {}),
      }),
    }, 30000);

    return {
      raw: body,
      providerMessageId: providerMessageId(body),
      status: firstString(body?.status, body?.data?.status),
      enriched: finalText !== text,
      sentText: finalText,
    };
  }

async sendButtons(instanceName: string, target: string, text: string, buttons: Array<{ id: string; text: string }>, footer = "Bíblia do Atalaia") {
  if (!buttons.length) return await this.sendText(instanceName, target, text);
  const body: any = await this.request(`/message/sendButtons/${encodeURIComponent(instanceName)}`, {
    method: "POST",
    body: JSON.stringify({
      number: target,
      title: "Atis",
      description: text,
      footer,
      buttons: buttons.slice(0, 3).map((button) => ({
        type: "reply",
        displayText: button.text.slice(0, 40),
        id: button.id.slice(0, 120),
      })),
    }),
  }, 30000);
  return { raw: body, providerMessageId: providerMessageId(body), status: firstString(body?.status, body?.data?.status), sentText: text };
}

async sendAudio(instanceName: string, target: string, audio: Uint8Array, mimetype = "audio/wav") {
  let binary = "";
  const chunk = 0x8000;
  for (let index = 0; index < audio.length; index += chunk) {
    binary += String.fromCharCode(...audio.subarray(index, Math.min(index + chunk, audio.length)));
  }
  const media = btoa(binary);
  const body: any = await this.request(`/message/sendMedia/${encodeURIComponent(instanceName)}`, {
    method: "POST",
    body: JSON.stringify({
      number: target,
      mediatype: "audio",
      mimetype,
      media,
      fileName: "atis-resposta.wav",
    }),
  }, 45000);
  return { raw: body, providerMessageId: providerMessageId(body), status: firstString(body?.status, body?.data?.status) };
}
}

export function getEvolutionConfigFromEnv() {
  const primaryUrl = Deno.env.get("EVOLUTION_API_URL")?.trim() ?? "";
  const legacyUrl = Deno.env.get("EVOLUTION_URL")?.trim() ?? "";
  const primaryKey = Deno.env.get("EVOLUTION_API_KEY")?.trim() ?? "";
  const legacyKey = Deno.env.get("EVOLUTION_KEY")?.trim() || Deno.env.get("EVOLUTION_GLOBAL_API_KEY")?.trim() || "";

  return {
    baseUrl: primaryUrl || legacyUrl,
    apiKey: primaryKey || legacyKey,
    urlConfigured: Boolean(primaryUrl || legacyUrl),
    keyConfigured: Boolean(primaryKey || legacyKey),
    urlSource: primaryUrl ? "EVOLUTION_API_URL" : legacyUrl ? "EVOLUTION_URL" : null,
    keySource: primaryKey
      ? "EVOLUTION_API_KEY"
      : Deno.env.get("EVOLUTION_KEY")?.trim()
      ? "EVOLUTION_KEY"
      : Deno.env.get("EVOLUTION_GLOBAL_API_KEY")?.trim()
      ? "EVOLUTION_GLOBAL_API_KEY"
      : null,
  };
}
