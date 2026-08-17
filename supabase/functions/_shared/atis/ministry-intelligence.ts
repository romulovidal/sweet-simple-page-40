import { aiChatFetchWithProviders } from "../ai-fetch.ts";

const TZ = "America/Fortaleza";
const CANTICO_OFFSET = 100000;
const MAX_RELATION_ITEMS = 10;

type ConversationMessage = { role: "user" | "assistant"; content: string };
type SongRef = { kind: "harpa" | "cantico"; number: number };

type MinistryMarker = {
  date: string | null;
  items: SongRef[];
  selected: SongRef | null;
};

export type MinistrySongGrounding = SongRef & {
  title: string;
  lyrics: string | null;
  category: string | null;
  biblicalReference: string | null;
};

export type MinistryRelationGrounding = {
  date: string;
  culto: {
    title: string;
    theme: string | null;
    scriptureReference: string | null;
    ministerName: string | null;
    leaderName: string | null;
  };
  songs: MinistrySongGrounding[];
  selected: MinistrySongGrounding | null;
  reference: string;
};

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[.!?]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function parseSongToken(token: string): SongRef | null {
  const match = /^([hc])(\d+)$/.exec(token);
  if (!match) return null;
  const number = Number(match[2]);
  if (!Number.isInteger(number) || number <= 0) return null;
  return { kind: match[1] === "h" ? "harpa" : "cantico", number };
}

function songToken(item: SongRef) {
  return `${item.kind === "harpa" ? "h" : "c"}${item.number}`;
}

function markerReference(marker: MinistryMarker) {
  const selected = marker.selected ? `;s=${songToken(marker.selected)}` : "";
  return `ctx:songs:${marker.date ?? "-"}:${marker.items.map(songToken).join(",")}${selected}`;
}

export function isMinistryRelationIntent(message: string) {
  const q = normalize(message).replace(/^atis[,:\s-]*/i, "");
  const hasWorship = /\b(hino|hinos|cantico|canticos|louvor|louvores|musica|musicas|esse|essa|desses|dessas)\b/.test(q);
  const hasCultoAnchor = /\b(culto|tema|mensagem|pregacao|texto[- ]?base|passagem|referencia biblica|biblia|biblico|biblica)\b/.test(q);
  const relation = /\b(combina|combinam|relaciona|relacionado|relacionada|coerente|coerencia|adequado|adequada|encaixa|conecta|conexao|tem a ver|mais apropriado|mais apropriada)\b/.test(q);
  const compareList = /\bqual\b.*\b(desses|dessas|hinos|canticos|louvores)\b.*\b(tema|mensagem|texto|culto|combina|melhor)\b/.test(q);
  return (hasWorship && hasCultoAnchor && relation) || compareList;
}

export function ministryRelationContextFromHistory(history: ConversationMessage[]): MinistryMarker | null {
  for (const item of [...history].reverse()) {
    if (item.role !== "user") continue;
    const songs = item.content.match(/\[ATIS_SONG_LIST=(\d{4}-\d{2}-\d{2}|-)\|([hc]\d+(?:,[hc]\d+)*)(?:\|s=([hc]\d+))?\]/);
    if (songs) {
      const items = songs[2].split(",").map(parseSongToken).filter(Boolean) as SongRef[];
      if (items.length) {
        const selectedCandidate = songs[3] ? parseSongToken(songs[3]) : null;
        const selected = selectedCandidate && items.some((row) => row.kind === selectedCandidate.kind && row.number === selectedCandidate.number)
          ? selectedCandidate
          : null;
        return { date: songs[1] === "-" ? null : songs[1], items, selected };
      }
    }
    const culto = item.content.match(/\[ATIS_CULTO_DATE=(\d{4}-\d{2}-\d{2})\]/);
    if (culto) return { date: culto[1], items: [], selected: null };
  }
  return null;
}

function selectionItems(raw: any[]): SongRef[] {
  return raw
    .map((item: any) => Number(item?.hino_number))
    .filter((number: number) => Number.isFinite(number) && number > 0)
    .slice(0, 30)
    .map((number: number) => number >= CANTICO_OFFSET
      ? { kind: "cantico" as const, number: number - CANTICO_OFFSET }
      : { kind: "harpa" as const, number });
}

function lyricsFromHarpaSections(sections: any[]) {
  return sections
    .flatMap((section: any) => Array.isArray(section?.linhas) ? section.linhas : [])
    .map((line: any) => String(line ?? "").replace(/^\s*[-–—]+\s*/, "").trim())
    .filter(Boolean)
    .join("\n")
    .trim();
}

async function fetchHarpa(baseUrl: string) {
  const response = await fetch(`${baseUrl.replace(/\/+$/, "")}/harpa/harpa-crista.json`, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`APP_HARPA_HTTP_${response.status}`);
  const body = await response.json();
  return Array.isArray(body?.hinos) ? body.hinos : [];
}

export async function loadMinistryRelationGrounding(
  supabase: any,
  baseUrl: string,
  history: ConversationMessage[],
): Promise<MinistryRelationGrounding | null> {
  const marker = ministryRelationContextFromHistory(history);
  if (!marker?.date) return null;

  const { data: cultoRows, error: cultoError } = await supabase.rpc("atis_get_culto_candidates", { _days: 30, _timezone: TZ });
  if (cultoError) throw cultoError;
  const culto = (Array.isArray(cultoRows) ? cultoRows : []).find((row: any) => String(row?.service_date) === marker.date);
  if (!culto) return null;

  const { data: selection, error: selectionError } = await supabase
    .from("culto_selections")
    .select("culto_date,items")
    .eq("culto_date", marker.date)
    .eq("is_active", true)
    .maybeSingle();
  if (selectionError) throw selectionError;
  if (!selection) return null;

  const currentItems = selectionItems(Array.isArray(selection.items) ? selection.items : []);
  if (!currentItems.length) return null;
  const limitedItems = currentItems.slice(0, MAX_RELATION_ITEMS);
  const currentSelected = marker.selected && limitedItems.some((row) => row.kind === marker.selected?.kind && row.number === marker.selected?.number)
    ? marker.selected
    : null;

  const canticoNumbers = limitedItems.filter((row) => row.kind === "cantico").map((row) => row.number);
  const harpaNumbers = limitedItems.filter((row) => row.kind === "harpa").map((row) => row.number);

  const { data: canticos, error: canticosError } = canticoNumbers.length
    ? await supabase
        .from("canticos")
        .select("numero,titulo,categoria,referencia_biblica,letra_raw,momentos_sugeridos")
        .in("numero", canticoNumbers)
        .eq("publicado", true)
    : { data: [], error: null } as any;
  if (canticosError) throw canticosError;
  const canticosByNumber = new Map((canticos ?? []).map((row: any) => [Number(row.numero), row]));

  let harpaRows: any[] = [];
  let overrides: any[] = [];
  if (harpaNumbers.length) {
    harpaRows = await fetchHarpa(baseUrl);
    const { data: overrideRows, error: overrideError } = await supabase
      .from("harpa_overrides")
      .select("number,title,secoes")
      .in("number", harpaNumbers);
    if (overrideError) throw overrideError;
    overrides = overrideRows ?? [];
  }
  const harpaByNumber = new Map(harpaRows.map((row: any) => [Number(row?.numero), row]));
  const overrideByNumber = new Map(overrides.map((row: any) => [Number(row?.number), row]));

  const songs = limitedItems.map((item): MinistrySongGrounding => {
    if (item.kind === "cantico") {
      const row: any = canticosByNumber.get(item.number);
      return {
        ...item,
        title: String(row?.titulo ?? `Cântico ${item.number}`),
        lyrics: String(row?.letra_raw ?? "").trim() || null,
        category: String(row?.categoria ?? "").trim() || null,
        biblicalReference: String(row?.referencia_biblica ?? "").trim() || null,
      };
    }
    const hymn: any = harpaByNumber.get(item.number);
    const override: any = overrideByNumber.get(item.number);
    const sections = Array.isArray(override?.secoes) ? override.secoes : Array.isArray(hymn?.secoes) ? hymn.secoes : [];
    return {
      ...item,
      title: String(override?.title ?? hymn?.titulo ?? `Harpa ${item.number}`),
      lyrics: lyricsFromHarpaSections(sections) || null,
      category: null,
      biblicalReference: null,
    };
  });

  const selected = currentSelected
    ? songs.find((row) => row.kind === currentSelected.kind && row.number === currentSelected.number) ?? null
    : null;
  const refreshedMarker: MinistryMarker = { date: marker.date, items: limitedItems, selected: currentSelected };

  return {
    date: marker.date,
    culto: {
      title: String(culto?.title ?? "Culto"),
      theme: String(culto?.theme ?? "").trim() || null,
      scriptureReference: String(culto?.scripture_reference ?? "").trim() || null,
      ministerName: String(culto?.minister_name ?? "").trim() || null,
      leaderName: String(culto?.leader_name ?? "").trim() || null,
    },
    songs,
    selected,
    reference: markerReference(refreshedMarker),
  };
}

function clipped(value: string | null, max = 1200) {
  if (!value) return "não disponível";
  const text = value.trim();
  return text.length <= max ? text : `${text.slice(0, max).trimEnd()}…`;
}

export async function generateMinistryRelationAnswer(
  systemPrompt: string,
  userMessage: string,
  grounding: MinistryRelationGrounding,
  bibleContext: { label: string; text: string } | null,
  conversationMode: "normal" | "study" | "concise" = "normal",
) {
  const songFacts = grounding.songs.map((song, index) => [
    `${index + 1}. ${song.kind === "harpa" ? `Harpa ${song.number}` : `Cântico ${song.number}`} — ${song.title}`,
    song.category ? `Categoria: ${song.category}` : null,
    song.biblicalReference ? `Referência cadastrada: ${song.biblicalReference}` : null,
    `Letra do acervo: ${clipped(song.lyrics)}`,
  ].filter(Boolean).join("\n")).join("\n\n");

  const selectedLabel = grounding.selected
    ? `${grounding.selected.kind === "harpa" ? `Harpa ${grounding.selected.number}` : `Cântico ${grounding.selected.number}`} — ${grounding.selected.title}`
    : "nenhum item selecionado explicitamente";
  const bibleFacts = bibleContext
    ? `Texto-base recuperado da Bíblia do app (${bibleContext.label}):\n${bibleContext.text}`
    : `Texto-base cadastrado: ${grounding.culto.scriptureReference ?? "não informado"}. O texto literal não foi recuperado; não o transcreva.`;
  const concise = conversationMode === "concise" ? "Responda em no máximo 2 parágrafos curtos." : "Responda de forma objetiva para WhatsApp, em até 4 parágrafos curtos.";

  const response = await aiChatFetchWithProviders({
    model: "llama-3.3-70b-versatile",
    messages: [
      {
        role: "system",
        content: `${systemPrompt}\n\nFERRAMENTA: RELAÇÃO MINISTERIAL FUNDAMENTADA\nVocê analisa coerência entre culto, Bíblia e louvor. Os fatos abaixo já foram recuperados do banco/acervo real da Bíblia do Atalaia.\nREGRAS OBRIGATÓRIAS:\n- Não invente culto, tema, texto-base, hino, cântico, título ou letra.\n- Não sugira um item fora da lista fornecida nesta resposta.\n- Se a pergunta disser “esse/essa”, use o ITEM SELECIONADO; se não houver item selecionado, diga que precisa que o usuário escolha um item.\n- Se a pergunta pedir “qual desses”, compare somente os itens da lista fornecida e escolha no máximo 1 principal, podendo citar 1 alternativa.\n- O texto bíblico literal só pode ser citado se aparecer em TEXTO-BASE RECUPERADO abaixo. Prefira explicar a relação sem transcrever longos trechos.\n- Diferencie fato do app de avaliação pastoral: use linguagem como “pela letra e pelo tema, há boa coerência porque...”.\n- Se faltarem tema, texto-base ou letra suficiente, declare a limitação em vez de preencher lacunas.\n- Não mencione prompts, tokens, rotas ou ferramentas internas.\n${concise}`,
      },
      {
        role: "user",
        content: `PERGUNTA DO USUÁRIO\n${userMessage}\n\nCULTO REAL DO APP\nData: ${grounding.date}\nCulto: ${grounding.culto.title}\nTema: ${grounding.culto.theme ?? "não informado"}\nTexto-base cadastrado: ${grounding.culto.scriptureReference ?? "não informado"}\nMinistro: ${grounding.culto.ministerName ?? "não informado"}\n\n${bibleFacts}\n\nITEM SELECIONADO\n${selectedLabel}\n\nLISTA REAL DE LOUVOR\n${songFacts}`,
      },
    ],
    temperature: 0.3,
    max_tokens: conversationMode === "study" ? 1500 : conversationMode === "concise" ? 650 : 1000,
  }, ["groq", "gemini"]);

  if (!response.ok) throw new Error("AI_PROVIDER_UNAVAILABLE");
  const body = await response.json().catch(() => null) as any;
  const text = String(body?.choices?.[0]?.message?.content ?? "").trim();
  if (!text) throw new Error("AI_EMPTY_RESPONSE");
  return text.length <= 3800 ? text : `${text.slice(0, 3740).trimEnd()}\n\n… resposta reduzida para WhatsApp.`;
}
