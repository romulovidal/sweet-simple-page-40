// Deterministic ministry schedule lookup for ATIS. Data comes only from the app database.
type CultoCandidate = {
  event_id?: string | null;
  schedule_id?: string | null;
  title: string;
  service_date: string;
  start_time?: string | null;
  minister_name?: string | null;
  leader_name?: string | null;
  theme?: string | null;
  scripture_reference?: string | null;
  location?: string | null;
  notes?: string | null;
  organized?: boolean;
};

const TZ = "America/Fortaleza";

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[.,;!?()[\]{}]/g, " ").replace(/\s+/g, " ").trim();
}

function todayKey() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function isSunday(date: string) {
  return new Date(`${date}T12:00:00Z`).getUTCDay() === 0;
}

function fmtDate(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  return new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "2-digit", month: "long" }).format(new Date(Date.UTC(y, (m || 1) - 1, d || 1, 12)));
}

function detail(value: string | null | undefined, fallback = "ainda não informado") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function fullCard(culto: CultoCandidate) {
  const lines = [
    `⛪ *${culto.title}*`,
    `📅 ${fmtDate(culto.service_date)}${culto.start_time ? ` às *${culto.start_time}*` : ""}`,
    `🎙️ Ministro: *${detail(culto.minister_name)}*`,
    `👤 Dirigente: *${detail(culto.leader_name)}*`,
    `✨ Tema: *${detail(culto.theme)}*`,
    `📖 Texto-base: *${detail(culto.scripture_reference)}*`,
    `📍 Local: *${detail(culto.location)}*`,
  ];
  if (!culto.organized) lines.push("ℹ️ Os detalhes ministeriais desta data ainda não foram organizados no app.");
  return lines.join("\n");
}

function shortAnswer(culto: CultoCandidate, q: string) {
  if (/quem.+(prega|pregar|pregara|vai pregar|ministra|ministrar|ministrara|vai ministrar)|\b(pregador|ministro)\b/.test(q)) {
    return culto.minister_name
      ? `🎙️ Quem ministrará no *${culto.title}* de ${fmtDate(culto.service_date)} será *${culto.minister_name}*.${culto.theme ? `\n✨ Tema: *${culto.theme}*` : ""}`
      : `🎙️ O ministro/pregador do *${culto.title}* de ${fmtDate(culto.service_date)} ainda não foi informado no app.`;
  }
  if (/\b(tema|assunto da mensagem|tema da mensagem)\b/.test(q)) {
    return culto.theme
      ? `✨ O tema do *${culto.title}* de ${fmtDate(culto.service_date)} é *${culto.theme}*.${culto.scripture_reference ? `\n📖 Texto-base: *${culto.scripture_reference}*` : ""}`
      : `✨ O tema do *${culto.title}* de ${fmtDate(culto.service_date)} ainda não foi informado no app.`;
  }
  if (/que horas|qual horario|horario do culto|hora do culto/.test(q)) {
    return culto.start_time
      ? `🕒 O *${culto.title}* de ${fmtDate(culto.service_date)} começa às *${culto.start_time}*.`
      : `🕒 O horário do *${culto.title}* de ${fmtDate(culto.service_date)} ainda não foi informado no app.`;
  }
  if (/\b(dirigente|quem dirige|quem vai dirigir)\b/.test(q)) {
    return culto.leader_name
      ? `👤 O dirigente do *${culto.title}* de ${fmtDate(culto.service_date)} será *${culto.leader_name}*.`
      : `👤 O dirigente do *${culto.title}* de ${fmtDate(culto.service_date)} ainda não foi informado no app.`;
  }
  if (/\b(onde|local|endereco)\b/.test(q)) {
    return culto.location
      ? `📍 O *${culto.title}* de ${fmtDate(culto.service_date)} será em *${culto.location}*.`
      : `📍 O local do *${culto.title}* de ${fmtDate(culto.service_date)} ainda não foi informado no app.`;
  }
  if (/texto[- ]?base|referencia biblica|passagem base/.test(q)) {
    return culto.scripture_reference
      ? `📖 O texto-base do *${culto.title}* de ${fmtDate(culto.service_date)} é *${culto.scripture_reference}*.`
      : `📖 O texto-base do *${culto.title}* de ${fmtDate(culto.service_date)} ainda não foi informado no app.`;
  }
  return fullCard(culto);
}

export function isCultoIntent(message: string) {
  const q = normalize(message);
  return /\b(culto|cultos|prega|pregar|pregador|pregacao|ministra|ministrar|ministro|dirigente)\b/.test(q) ||
    (/\b(tema|horario|que horas)\b/.test(q) && /\b(domingo|hoje|igreja)\b/.test(q));
}

export async function cultoLookup(supabase: any, message: string) {
  const q = normalize(message);
  const { data, error } = await supabase.rpc("atis_get_culto_candidates", { _days: 30, _timezone: TZ });
  if (error) throw error;
  const rows = (Array.isArray(data) ? data : []) as CultoCandidate[];
  const today = todayKey();

  let candidates: CultoCandidate[];
  if (/\bhoje\b/.test(q)) candidates = rows.filter((row) => row.service_date === today);
  else if (/\bdomingo\b/.test(q)) candidates = rows.filter((row) => isSunday(row.service_date));
  else candidates = rows;

  if (!candidates.length) {
    if (/\bhoje\b/.test(q)) return "📅 Não há nenhum culto ativo programado para hoje no app.";
    if (/\bdomingo\b/.test(q)) return "📅 Não encontrei culto ativo programado para o próximo domingo no app.";
    return "📅 Não encontrei próximos cultos ativos cadastrados no app.";
  }

  const culto = candidates[0];
  if (/\btem culto\b/.test(q)) {
    const when = /\bhoje\b/.test(q) ? "Hoje teremos" : `Teremos em ${fmtDate(culto.service_date)}`;
    return `✅ Sim. ${when} *${culto.title}*${culto.start_time ? ` às *${culto.start_time}*` : ""}.${culto.minister_name ? `\n🎙️ Ministro: *${culto.minister_name}*` : ""}${culto.theme ? `\n✨ Tema: *${culto.theme}*` : ""}`;
  }
  return shortAnswer(culto, q);
}
