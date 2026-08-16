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

  async restart(instanceName: string) {
    const body = await this.request(`/instance/restart/${encodeURIComponent(instanceName)}`, { method: "POST" });
    return { raw: body };
  }

  async logout(instanceName: string) {
    const body = await this.request(`/instance/logout/${encodeURIComponent(instanceName)}`, { method: "DELETE" });
    return { raw: body };
  }

  async findContacts(instanceName: string, take = 500, skip = 0) {
    const body = await this.request(`/chat/findContacts/${encodeURIComponent(instanceName)}`, {
      method: "POST",
      body: JSON.stringify({ where: {}, take, skip, orderBy: {} }),
    }, 30000);

    return Array.isArray(body) ? body : Array.isArray((body as any)?.data) ? (body as any).data : [];
  }

  async fetchAllGroups(instanceName: string, getParticipants = true) {
    const query = getParticipants ? "?getParticipants=true" : "";
    const body = await this.request(`/group/fetchAllGroups/${encodeURIComponent(instanceName)}${query}`, {
      method: "GET",
    }, 30000);

    return Array.isArray(body) ? body : Array.isArray((body as any)?.data) ? (body as any).data : [];
  }

  async sendText(instanceName: string, target: string, text: string, delay = 0) {
    const body: any = await this.request(`/message/sendText/${encodeURIComponent(instanceName)}`, {
      method: "POST",
      body: JSON.stringify({
        number: target,
        text,
        ...(delay > 0 ? { delay } : {}),
      }),
    }, 30000);

    return {
      raw: body,
      providerMessageId: providerMessageId(body),
      status: firstString(body?.status, body?.data?.status),
    };
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
