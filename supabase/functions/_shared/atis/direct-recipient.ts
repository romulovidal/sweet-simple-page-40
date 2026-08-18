const DIRECT_SESSION_NAMESPACE = "atis-inbound-direct:";

function directProviderTarget(remoteJid: string) {
  return remoteJid.replace(/@s\.whatsapp\.net$/i, "").trim();
}

export function directPhoneCandidates(remoteJid: string) {
  if (!remoteJid || remoteJid.endsWith("@g.us")) return [] as string[];
  const digits = directProviderTarget(remoteJid).replace(/\D/g, "");
  if (digits.length < 8 || digits.length > 15) return [] as string[];

  const candidates = new Set<string>([`+${digits}`]);

  // WhatsApp/Baileys may surface Brazilian mobile JIDs without the ninth digit,
  // while the app stores the canonical E.164 number with it. Preserve both
  // candidates so an existing app contact is recognized before guest fallback.
  if (digits.startsWith("55")) {
    if (digits.length === 12) {
      const area = digits.slice(2, 4);
      const local = digits.slice(4);
      if (area.length === 2 && local.length === 8) candidates.add(`+55${area}9${local}`);
    } else if (digits.length === 13 && digits[4] === "9") {
      candidates.add(`+${digits.slice(0, 4)}${digits.slice(5)}`);
    }
  }

  return [...candidates];
}

export function preferredPhoneMatch(
  rows: Array<Record<string, any> & { phone_e164?: string | null }> | null | undefined,
  candidates: string[],
): (Record<string, any> & { phone_e164?: string | null }) | null {
  const list = Array.isArray(rows) ? rows : [];
  for (const candidate of candidates) {
    const found = list.find((row) => row?.phone_e164 === candidate);
    if (found) return found;
  }
  return null;
}

export async function inboundSessionDestinationId(remoteJid: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`${DIRECT_SESSION_NAMESPACE}${remoteJid.trim().toLowerCase()}`),
  );
  const bytes = new Uint8Array(digest).slice(0, 16);
  // Format the deterministic hash as an RFC 4122 UUID (version 5 shape).
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
