type Json = Record<string, any>;

const CANTICO_OFFSET = 100000;
const TZ = "America/Fortaleza";

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[.,;!?()[\]{}]/g, " ").replace(/\s+/g, " ").trim();
}

function clampText(value: string, max = 3800) {
  const text = value.trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max - 55).trimEnd()}\n\n… conteúdo reduzido para envio no WhatsApp.`;
}

function todayKey() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const get = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function addDays(iso: string, days: number) {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y, (m || 1) - 1, d || 1, 12));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function isSunday(iso: string) {
  return new Date(`${iso}T12:00:00Z`).getUTCDay() === 0;
}

function fmtDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "2-digit", month: "long" }).format(new Date(Date.UTC(y, (m || 1) - 1, d || 1, 12)));
}

function meaningfulTerms(message: string) {
  const stop = new Set(["atis", "cantico", "canticos", "hino", "hinos", "louvor", "louvores", "qual", "quais", "me", "mostre", "mostra", "procure", "buscar", "busca", "sobre", "que", "fala", "fale", "um", "uma", "do", "da", "de", "dos", "das", "para", "no", "na", "nos", "nas", "culto", "domingo", "hoje", "proximo", "proxima", "programacao"]);
  return normalize(message).split(" ").filter((term) => term.length >= 3 && !stop.has(term)).slice(0, 8);
}

export function isCanticosIntent(message: string) {
  const q = normalize(message);
  if (/\b(cantico|canticos)\b/.test(q)) return true;
  return /\b(programacao|sequencia|lista)\b.*\b(louvor|hinos?)\b/.test(q)
    || /\b(hinos?|louvores?)\b.*\b(culto|domingo|hoje|proximo)\b/.test(q)
    || /\b(louvor|louvores)\b.*\b(culto|domingo|hoje|proximo)\b/.test(q);
}

async function worshipSelectionLookup(supabase: any, message: string) {
  const q = normalize(message);
  const contextDate = message.match(/__ATIS_CULTO_DATE=(\d{4}-\d{2}-\d{2})__/i)?.[1] ?? null;
  const today = todayKey();
  const through = addDays(today, 30);
  const { data, error } = await supabase
    .from("culto_selections")
    .select("id,title,culto_date,schedule_id,items,share_slug")
    .eq("is_active", true)
    .gte("culto_date", today)
    .lte("culto_date", through)
    .order("culto_date", { ascending: true });
  if (error) throw error;
  let rows = Array.isArray(data) ? data : [];
  if (contextDate) rows = rows.filter((row: any) => row.culto_date === contextDate);
  else if (/\bhoje\b/.test(q)) rows = rows.filter((row: any) => row.culto_date === today);
  else if (/\bdomingo\b/.test(q)) rows = rows.filter((row: any) => isSunday(row.culto_date));
  const selection = rows[0];
  if (!selection) {
    if (contextDate) return `🎶 Ainda não há uma seleção de louvor ativa cadastrada para o culto de ${fmtDate(contextDate)} no app.`;
    if (/\bhoje\b/.test(q)) return "🎶 Ainda não há uma seleção de louvor ativa cadastrada para hoje no app.";
    if (/\bdomingo\b/.test(q)) return "🎶 Ainda não há uma seleção de louvor ativa cadastrada para o próximo domingo no app.";
    return "🎶 Não encontrei uma próxima seleção de louvor ativa cadastrada no app.";
  }

  const items = Array.isArray(selection.items) ? selection.items : [];
  if (!items.length) return `🎶 A programação *${selection.title}* de ${fmtDate(selection.culto_date)} ainda não tem hinos ou cânticos cadastrados.`;

  const canticoNumbers = [...new Set(items.map((item: any) => Number(item?.hino_number)).filter((n: number) => Number.isFinite(n) && n >= CANTICO_OFFSET).map((n: number) => n - CANTICO_OFFSET))];
  const { data: canticos, error: canticoError } = canticoNumbers.length
    ? await supabase.from("canticos").select("numero,titulo,tom,categoria").in("numero", canticoNumbers).eq("publicado", true)
    : { data: [], error: null } as any;
  if (canticoError) throw canticoError;
  const byNumber = new Map((canticos ?? []).map((row: any) => [Number(row.numero), row]));

  const lines = items.map((item: any, index: number) => {
    const ref = Number(item?.hino_number);
    if (ref >= CANTICO_OFFSET) {
      const number = ref - CANTICO_OFFSET;
      const song = byNumber.get(number) as any;
      const detail = song?.tom ? ` · tom ${song.tom}` : "";
      return `${index + 1}. 🎵 Cântico ${number}${song?.titulo ? ` — *${song.titulo}*` : ""}${detail}`;
    }
    return `${index + 1}. 🎼 Harpa Cristã ${ref}`;
  });

  return `🎶 *${selection.title}*\n📅 ${fmtDate(selection.culto_date)}\n\n${lines.join("\n")}`;
}

function scoreSong(song: any, terms: string[]) {
  const title = normalize(String(song?.titulo ?? ""));
  const category = normalize(String(song?.categoria ?? ""));
  const moments = Array.isArray(song?.momentos_sugeridos) ? normalize(song.momentos_sugeridos.join(" ")) : "";
  const reference = normalize(String(song?.referencia_biblica ?? ""));
  const lyrics = normalize(String(song?.letra_raw ?? ""));
  let score = 0;
  for (const term of terms) {
    if (title.includes(term)) score += 8;
    if (category.includes(term)) score += 5;
    if (moments.includes(term)) score += 4;
    if (reference.includes(term)) score += 3;
    if (lyrics.includes(term)) score += 2;
  }
  return score;
}

async function canticoSearch(supabase: any, message: string) {
  const q = normalize(message);
  const numberMatch = q.match(/\bcantico\s*(?:n|no|numero)?\s*(\d{1,4})\b/);
  if (numberMatch) {
    const { data, error } = await supabase.from("canticos").select("numero,titulo,categoria,tom,capotraste,momentos_sugeridos,referencia_biblica,letra_raw").eq("numero", Number(numberMatch[1])).eq("publicado", true).maybeSingle();
    if (error) throw error;
    if (!data) return `🎵 Não encontrei o Cântico ${numberMatch[1]} entre os cânticos publicados do app.`;
    const wantsLyrics = /\b(letra|manda|mande|mostra|mostre|envia|envie)\b/.test(q);
    if (wantsLyrics) {
      const lyrics = String(data.letra_raw ?? "").trim();
      if (!lyrics) return `🎵 O *Cântico ${data.numero} — ${data.titulo}* está cadastrado no app, mas ainda não possui letra disponível.`;
      return clampText(`🎵 *Cântico ${data.numero} — ${data.titulo}*\n\n${lyrics}`);
    }
    const extras = [data.categoria ? `Categoria: ${data.categoria}` : null, data.tom ? `Tom: ${data.tom}` : null, data.referencia_biblica ? `Referência: ${data.referencia_biblica}` : null].filter(Boolean);
    return `🎵 *Cântico ${data.numero} — ${data.titulo}*${extras.length ? `\n${extras.join(" · ")}` : ""}`;
  }

  const terms = meaningfulTerms(message);
  const { data, error } = await supabase
    .from("canticos")
    .select("numero,titulo,categoria,tom,momentos_sugeridos,referencia_biblica,letra_raw")
    .eq("publicado", true)
    .order("numero", { ascending: true })
    .limit(500);
  if (error) throw error;
  if (!terms.length) {
    const first = (data ?? []).slice(0, 8);
    if (!first.length) return "🎵 Ainda não há cânticos publicados no app.";
    return `🎵 *Cânticos publicados*\n${first.map((song: any) => `• ${song.numero} — ${song.titulo}`).join("\n")}\n\nDiga um tema, trecho da letra ou número para eu procurar melhor.`;
  }
  const ranked = (data ?? [])
    .map((song: any) => ({ song, score: scoreSong(song, terms) }))
    .filter((item: any) => item.score > 0)
    .sort((a: any, b: any) => b.score - a.score || Number(a.song.numero) - Number(b.song.numero))
    .slice(0, 5);
  if (!ranked.length) return "🎵 Não encontrei um cântico publicado no app que corresponda a esse tema ou trecho.";
  return `🎵 *Encontrei estes cânticos no app:*\n${ranked.map(({ song }: any) => `• ${song.numero} — *${song.titulo}*${song.tom ? ` · tom ${song.tom}` : ""}${song.categoria ? ` · ${song.categoria}` : ""}`).join("\n")}`;
}

export async function canticosLookup(supabase: any, message: string) {
  const q = normalize(message);
  const hasContextDate = /__atis_culto_date=\d{4}-\d{2}-\d{2}__/.test(q);
  const asksProgramming = hasContextDate || (/\b(culto|domingo|hoje|proximo|programacao|sequencia|lista)\b/.test(q) && /\b(hino|hinos|cantico|canticos|louvor|louvores)\b/.test(q));
  return asksProgramming ? await worshipSelectionLookup(supabase, message) : await canticoSearch(supabase, message);
}
