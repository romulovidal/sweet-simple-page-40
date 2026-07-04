// Biografias de personagens bíblicos — perfis com bio, época, papel,
// versículos-chave clicáveis e momentos marcantes.

export type CharacterCategory = "patriarca" | "lider" | "profeta" | "rei" | "apostolo" | "jesus" | "outro";

export interface CharacterMoment {
  year?: string;
  title: string;
  description: string;
  reference?: string;
}

export interface CharacterVerse {
  reference: string; // ex: "Gênesis 12"
  note: string;
}

export interface BibleCharacter {
  id: string;
  name: string;
  aka?: string[]; // outros nomes/aliases
  category: CharacterCategory;
  era: string; // ex: "~2091 aC"
  role: string; // ex: "Pai da fé, patriarca de Israel"
  color: string; // hsl triplet
  icon: string; // emoji
  bio: string;
  keyVerses: CharacterVerse[];
  moments: CharacterMoment[];
  /**
   * Falas em 1ª pessoa que o personagem "diz" quando se apresenta ao usuário.
   * Cada string é uma fala/slide. Se omitido, um script é gerado a partir do bio.
   */
  presentation?: string[];
}

export const BIBLE_CHARACTERS: BibleCharacter[] = [
  // ── Patriarcas ──
  {
    id: "abraao",
    name: "Abraão",
    aka: ["Abrão"],
    category: "patriarca",
    era: "~2166 – 1991 aC",
    role: "Pai da fé · Patriarca de Israel",
    color: "38 92% 55%",
    icon: "🌟",
    bio: "Chamado por Deus para deixar sua terra e se tornar pai de uma grande nação. Sua fé foi contada como justiça, e por meio de sua descendência todas as famílias da terra seriam abençoadas.",
    keyVerses: [
      { reference: "Gênesis 12", note: "O chamado e a promessa" },
      { reference: "Gênesis 15", note: "Aliança e justificação pela fé" },
      { reference: "Gênesis 22", note: "O sacrifício de Isaque" },
      { reference: "Romanos 4", note: "Pai de todos os que creem" },
    ],
    moments: [
      { year: "~2091 aC", title: "Chamado de Ur", description: "Deus o chama a deixar sua terra e ir para Canaã.", reference: "Gênesis 12" },
      { year: "~2081 aC", title: "Aliança da fé", description: "Deus promete descendência como as estrelas.", reference: "Gênesis 15" },
      { year: "~2066 aC", title: "Nasce Isaque", description: "O filho da promessa nasce na velhice de Sara.", reference: "Gênesis 21" },
      { year: "~2050 aC", title: "Provação no Moriá", description: "Abraão obedece e Deus provê o cordeiro.", reference: "Gênesis 22" },
    ],
  },
  {
    id: "isaque",
    name: "Isaque",
    category: "patriarca",
    era: "~2066 – 1886 aC",
    role: "Filho da promessa · Patriarca",
    color: "38 80% 60%",
    icon: "🐑",
    bio: "Filho de Abraão e Sara, nascido milagrosamente na velhice. Prefigura Cristo no monte Moriá e continua a linhagem da aliança.",
    keyVerses: [
      { reference: "Gênesis 21", note: "Nascimento" },
      { reference: "Gênesis 22", note: "O carneiro no lugar" },
      { reference: "Gênesis 26", note: "Renovação da aliança" },
    ],
    moments: [
      { year: "~2066 aC", title: "Nascimento", description: "Nasce do casal já idoso.", reference: "Gênesis 21" },
      { year: "~2050 aC", title: "Monte Moriá", description: "Oferecido e substituído por um carneiro.", reference: "Gênesis 22" },
      { year: "~2026 aC", title: "Casamento com Rebeca", description: "Servo de Abraão encontra Rebeca em Harã.", reference: "Gênesis 24" },
    ],
  },
  {
    id: "jaco",
    name: "Jacó",
    aka: ["Israel"],
    category: "patriarca",
    era: "~2006 – 1859 aC",
    role: "Pai das 12 tribos de Israel",
    color: "28 85% 55%",
    icon: "🪜",
    bio: "Enganador que se tornou lutador com Deus. Após anos com Labão, retorna transformado e recebe o nome Israel. Seus 12 filhos formam as tribos.",
    keyVerses: [
      { reference: "Gênesis 28", note: "A escada até o céu em Betel" },
      { reference: "Gênesis 32", note: "Luta com Deus em Peniel" },
      { reference: "Gênesis 35", note: "Renovação em Betel" },
    ],
    moments: [
      { year: "~2006 aC", title: "Nascimento", description: "Nasce gêmeo com Esaú.", reference: "Gênesis 25" },
      { year: "~1929 aC", title: "Sonho em Betel", description: "Vê a escada e a promessa.", reference: "Gênesis 28" },
      { year: "~1909 aC", title: "Luta em Peniel", description: "Recebe o nome Israel.", reference: "Gênesis 32" },
    ],
  },
  {
    id: "jose",
    name: "José",
    category: "patriarca",
    era: "~1915 – 1805 aC",
    role: "Governador do Egito · Salvador de Israel",
    color: "260 70% 65%",
    icon: "👑",
    bio: "Vendido pelos irmãos, tornou-se segundo homem do Egito. Preservou a vida de muitos e trouxe sua família ao Egito, cumprindo os planos de Deus.",
    keyVerses: [
      { reference: "Gênesis 37", note: "Sonhos e traição" },
      { reference: "Gênesis 41", note: "Interpretação dos sonhos de Faraó" },
      { reference: "Gênesis 50", note: "\"Vós intentastes o mal, mas Deus o tornou em bem\"" },
    ],
    moments: [
      { year: "~1898 aC", title: "Vendido ao Egito", description: "Traído pelos irmãos.", reference: "Gênesis 37" },
      { year: "~1885 aC", title: "Governador do Egito", description: "Prepara o Egito para a fome.", reference: "Gênesis 41" },
      { year: "~1876 aC", title: "Reencontro com a família", description: "Perdoa os irmãos e os leva ao Egito.", reference: "Gênesis 45" },
    ],
  },
  // ── Líderes/Profetas ──
  {
    id: "moises",
    name: "Moisés",
    category: "lider",
    era: "~1526 – 1406 aC",
    role: "Libertador · Legislador · Profeta",
    color: "195 85% 55%",
    icon: "📜",
    bio: "Tirado das águas, criado no palácio de Faraó, chamado na sarça ardente. Conduziu Israel do Egito ao Sinai e recebeu a Lei de Deus.",
    keyVerses: [
      { reference: "Êxodo 3", note: "A sarça ardente" },
      { reference: "Êxodo 14", note: "Travessia do Mar Vermelho" },
      { reference: "Êxodo 20", note: "Os Dez Mandamentos" },
      { reference: "Deuteronômio 34", note: "Morte de Moisés" },
    ],
    moments: [
      { year: "~1526 aC", title: "Salvo das águas", description: "Filha de Faraó o resgata do Nilo.", reference: "Êxodo 2" },
      { year: "~1446 aC", title: "Sarça ardente", description: "Deus o envia para libertar Israel.", reference: "Êxodo 3" },
      { year: "~1446 aC", title: "O Êxodo", description: "Israel sai do Egito na Páscoa.", reference: "Êxodo 12" },
      { year: "~1446 aC", title: "A Lei no Sinai", description: "Recebe os mandamentos.", reference: "Êxodo 20" },
    ],
  },
  {
    id: "davi",
    name: "Davi",
    category: "rei",
    era: "~1040 – 970 aC",
    role: "Rei de Israel · Homem segundo o coração de Deus",
    color: "0 75% 55%",
    icon: "👑",
    bio: "Pastor ungido em segredo, venceu Golias, foi perseguido por Saul e reinou 40 anos. Salmista de Israel e ancestral do Messias.",
    keyVerses: [
      { reference: "1 Samuel 16", note: "Ungido por Samuel" },
      { reference: "1 Samuel 17", note: "Davi e Golias" },
      { reference: "2 Samuel 7", note: "A aliança davídica" },
      { reference: "Salmos 23", note: "O Senhor é meu pastor" },
      { reference: "Salmos 51", note: "Oração de arrependimento" },
    ],
    moments: [
      { year: "~1025 aC", title: "Ungido rei", description: "Samuel o unge em Belém.", reference: "1 Samuel 16" },
      { year: "~1024 aC", title: "Vence Golias", description: "Derrota o gigante filisteu.", reference: "1 Samuel 17" },
      { year: "~1010 aC", title: "Rei em Hebrom", description: "Torna-se rei de Judá.", reference: "2 Samuel 2" },
      { year: "~1003 aC", title: "Conquista Jerusalém", description: "Torna-a capital.", reference: "2 Samuel 5" },
    ],
  },
  {
    id: "salomao",
    name: "Salomão",
    category: "rei",
    era: "~990 – 931 aC",
    role: "Rei sábio · Construtor do Templo",
    color: "45 85% 55%",
    icon: "🏛️",
    bio: "Filho de Davi. Pediu sabedoria a Deus e recebeu também riqueza e honra. Construiu o primeiro Templo, mas seu coração desviou-se no fim.",
    keyVerses: [
      { reference: "1 Reis 3", note: "Pedido de sabedoria" },
      { reference: "1 Reis 8", note: "Dedicação do Templo" },
      { reference: "Provérbios 1", note: "O temor do Senhor" },
      { reference: "Eclesiastes 12", note: "Teme a Deus e guarda os seus mandamentos" },
    ],
    moments: [
      { year: "~970 aC", title: "Torna-se rei", description: "Sucede Davi no trono.", reference: "1 Reis 2" },
      { year: "~967 aC", title: "Inicia o Templo", description: "Começa a construção em Jerusalém.", reference: "1 Reis 6" },
      { year: "~960 aC", title: "Dedica o Templo", description: "A glória do Senhor enche a casa.", reference: "1 Reis 8" },
    ],
  },
  {
    id: "elias",
    name: "Elias",
    category: "profeta",
    era: "~900 – 850 aC",
    role: "Profeta de fogo em Israel",
    color: "15 90% 55%",
    icon: "🔥",
    bio: "Confrontou Acabe e os profetas de Baal no Carmelo. Foi levado ao céu num carro de fogo. Aparece com Moisés na Transfiguração de Jesus.",
    keyVerses: [
      { reference: "1 Reis 17", note: "Alimentado pelos corvos" },
      { reference: "1 Reis 18", note: "Confronto no Monte Carmelo" },
      { reference: "1 Reis 19", note: "Cicio tranquilo e suave" },
      { reference: "2 Reis 2", note: "Arrebatado ao céu" },
    ],
    moments: [
      { year: "~870 aC", title: "Seca sobre Israel", description: "Anuncia julgamento contra Acabe.", reference: "1 Reis 17" },
      { year: "~860 aC", title: "Fogo no Carmelo", description: "Deus responde com fogo do céu.", reference: "1 Reis 18" },
      { year: "~850 aC", title: "Carro de fogo", description: "É levado por um redemoinho.", reference: "2 Reis 2" },
    ],
  },
  {
    id: "isaias",
    name: "Isaías",
    category: "profeta",
    era: "~740 – 680 aC",
    role: "Profeta do Messias",
    color: "220 70% 60%",
    icon: "📖",
    bio: "Chamado numa visão da glória do Senhor. Profetizou juízo e salvação, e anunciou com clareza o Servo Sofredor — o Messias.",
    keyVerses: [
      { reference: "Isaías 6", note: "Visão do trono: \"Eis-me aqui, envia-me\"" },
      { reference: "Isaías 7", note: "A virgem conceberá — Emanuel" },
      { reference: "Isaías 53", note: "O Servo Sofredor" },
      { reference: "Isaías 61", note: "O Espírito do Senhor está sobre mim" },
    ],
    moments: [
      { year: "~740 aC", title: "Visão no Templo", description: "Vê o Senhor e é comissionado.", reference: "Isaías 6" },
      { year: "~701 aC", title: "Livramento de Jerusalém", description: "Profetiza contra a Assíria.", reference: "Isaías 37" },
    ],
  },
  {
    id: "daniel",
    name: "Daniel",
    category: "profeta",
    era: "~620 – 530 aC",
    role: "Profeta no exílio · Estadista",
    color: "265 65% 60%",
    icon: "🦁",
    bio: "Levado cativo à Babilônia jovem, manteve-se fiel a Deus na corte pagã. Recebeu visões do fim dos tempos e foi livre da cova dos leões.",
    keyVerses: [
      { reference: "Daniel 1", note: "Fidelidade na corte" },
      { reference: "Daniel 2", note: "A estátua e os reinos" },
      { reference: "Daniel 6", note: "A cova dos leões" },
      { reference: "Daniel 9", note: "As 70 semanas" },
    ],
    moments: [
      { year: "~605 aC", title: "Cativo na Babilônia", description: "Levado com jovens nobres.", reference: "Daniel 1" },
      { year: "~539 aC", title: "Livre dos leões", description: "Sob Dario, Deus fecha a boca dos leões.", reference: "Daniel 6" },
    ],
  },
  // ── Novo Testamento ──
  {
    id: "jesus",
    name: "Jesus",
    aka: ["Cristo", "Messias", "Filho de Deus"],
    category: "jesus",
    era: "~4 aC – 30 dC",
    role: "Filho de Deus · Salvador do mundo",
    color: "0 0% 100%",
    icon: "✝️",
    bio: "O Verbo que se fez carne. Nasceu de Maria em Belém, viveu em Nazaré, pregou o Reino, foi crucificado por nossos pecados, ressuscitou ao terceiro dia e vive para sempre.",
    keyVerses: [
      { reference: "João 1", note: "\"No princípio era o Verbo\"" },
      { reference: "Mateus 5", note: "O Sermão do Monte" },
      { reference: "João 3", note: "\"Porque Deus amou o mundo...\"" },
      { reference: "João 14", note: "\"Eu sou o caminho, a verdade e a vida\"" },
      { reference: "Lucas 24", note: "A ressurreição" },
    ],
    moments: [
      { year: "~4 aC", title: "Nascimento em Belém", description: "O Salvador nasce.", reference: "Lucas 2" },
      { year: "~27 dC", title: "Batismo no Jordão", description: "\"Este é o meu Filho amado\".", reference: "Mateus 3" },
      { year: "~30 dC", title: "Crucificação", description: "Morre pelos pecados do mundo.", reference: "João 19" },
      { year: "~30 dC", title: "Ressurreição", description: "Vence a morte no terceiro dia.", reference: "Mateus 28" },
    ],
  },
  {
    id: "maria",
    name: "Maria",
    category: "outro",
    era: "~18 aC – 45 dC",
    role: "Mãe de Jesus",
    color: "200 75% 65%",
    icon: "🕊️",
    bio: "Jovem de Nazaré que respondeu ao anjo com fé: \"Eis aqui a serva do Senhor\". Acompanhou Jesus da manjedoura à cruz.",
    keyVerses: [
      { reference: "Lucas 1", note: "A Anunciação e o Magnificat" },
      { reference: "Lucas 2", note: "Nascimento de Jesus" },
      { reference: "João 2", note: "Bodas de Caná" },
      { reference: "João 19", note: "Ao pé da cruz" },
    ],
    moments: [
      { year: "~5 aC", title: "A Anunciação", description: "Gabriel a saúda.", reference: "Lucas 1" },
      { year: "~4 aC", title: "Nascimento de Jesus", description: "Em Belém.", reference: "Lucas 2" },
      { year: "~30 dC", title: "Ao pé da cruz", description: "Jesus a confia a João.", reference: "João 19" },
    ],
  },
  {
    id: "joao-batista",
    name: "João Batista",
    category: "profeta",
    era: "~5 aC – 30 dC",
    role: "Precursor do Messias",
    color: "35 70% 45%",
    icon: "💧",
    bio: "Voz que clama no deserto. Pregou arrependimento e batizou Jesus no Jordão, apontando-o como o Cordeiro de Deus.",
    keyVerses: [
      { reference: "Mateus 3", note: "Prega e batiza" },
      { reference: "João 1", note: "\"Eis o Cordeiro de Deus\"" },
      { reference: "Marcos 6", note: "Martírio" },
    ],
    moments: [
      { year: "~27 dC", title: "Ministério no deserto", description: "Chama Israel ao arrependimento.", reference: "Mateus 3" },
      { year: "~27 dC", title: "Batiza Jesus", description: "No rio Jordão.", reference: "Mateus 3" },
    ],
  },
  {
    id: "pedro",
    name: "Pedro",
    aka: ["Simão", "Cefas"],
    category: "apostolo",
    era: "~1 – 67 dC",
    role: "Apóstolo · Pescador de homens",
    color: "210 80% 55%",
    icon: "🗝️",
    bio: "Pescador da Galileia chamado por Jesus. Impulsivo e apaixonado, negou o Senhor três vezes e foi restaurado. Pregou no Pentecostes e liderou a igreja primitiva.",
    keyVerses: [
      { reference: "Mateus 16", note: "\"Tu és o Cristo\"" },
      { reference: "João 21", note: "Restauração à beira-mar" },
      { reference: "Atos 2", note: "Sermão do Pentecostes" },
      { reference: "1 Pedro 1", note: "Nova esperança viva" },
    ],
    moments: [
      { year: "~27 dC", title: "Chamado por Jesus", description: "\"Vinde após mim\".", reference: "Mateus 4" },
      { year: "~30 dC", title: "Nega e é restaurado", description: "Três vezes.", reference: "João 21" },
      { year: "~30 dC", title: "Pentecostes", description: "3.000 se convertem.", reference: "Atos 2" },
    ],
  },
  {
    id: "paulo",
    name: "Paulo",
    aka: ["Saulo de Tarso"],
    category: "apostolo",
    era: "~5 – 67 dC",
    role: "Apóstolo dos gentios",
    color: "155 60% 45%",
    icon: "✉️",
    bio: "Fariseu perseguidor da igreja que encontrou Cristo no caminho de Damasco. Fez três viagens missionárias e escreveu 13 epístolas do Novo Testamento.",
    keyVerses: [
      { reference: "Atos 9", note: "Conversão no caminho de Damasco" },
      { reference: "Romanos 8", note: "Nada nos separará do amor de Cristo" },
      { reference: "1 Coríntios 13", note: "O capítulo do amor" },
      { reference: "Filipenses 4", note: "\"Posso todas as coisas\"" },
      { reference: "2 Timóteo 4", note: "\"Combati o bom combate\"" },
    ],
    moments: [
      { year: "~34 dC", title: "Conversão", description: "Encontra Cristo a caminho de Damasco.", reference: "Atos 9" },
      { year: "~46 dC", title: "1ª viagem missionária", description: "Chipre e Ásia Menor.", reference: "Atos 13" },
      { year: "~49 dC", title: "2ª viagem missionária", description: "Alcança a Europa (Filipos, Corinto).", reference: "Atos 16" },
      { year: "~53 dC", title: "3ª viagem missionária", description: "Longo ministério em Éfeso.", reference: "Atos 19" },
      { year: "~60 dC", title: "Prisão em Roma", description: "Escreve as epístolas da prisão.", reference: "Atos 28" },
    ],
  },
  // ── Início (Gênesis) ──
  {
    id: "adao",
    name: "Adão",
    category: "outro",
    era: "Início da humanidade",
    role: "Primeiro homem · Pai da humanidade",
    color: "30 60% 50%",
    icon: "🌱",
    bio: "Formado do pó da terra pelas mãos de Deus, recebeu o fôlego da vida e cuidou do jardim do Éden. Sua desobediência trouxe a queda, mas em Cristo — o segundo Adão — a vida é restaurada.",
    keyVerses: [
      { reference: "Gênesis 1", note: "Criado à imagem de Deus" },
      { reference: "Gênesis 2", note: "Colocado no Éden" },
      { reference: "Gênesis 3", note: "A queda" },
      { reference: "Romanos 5", note: "Adão e Cristo comparados" },
    ],
    moments: [
      { title: "Criação", description: "Formado do pó e recebe o fôlego de vida.", reference: "Gênesis 2" },
      { title: "Nomeia os animais", description: "Deus traz os animais a Adão.", reference: "Gênesis 2" },
      { title: "Queda no Éden", description: "Desobedece e é expulso.", reference: "Gênesis 3" },
    ],
  },
  {
    id: "eva",
    name: "Eva",
    category: "outro",
    era: "Início da humanidade",
    role: "Primeira mulher · Mãe de todos os viventes",
    color: "340 60% 60%",
    icon: "🍎",
    bio: "Tirada do lado de Adão como auxiliadora idônea. Foi enganada pela serpente, mas recebeu a primeira promessa da vitória do Descendente que esmagaria a cabeça do inimigo.",
    keyVerses: [
      { reference: "Gênesis 2", note: "Criada de uma costela de Adão" },
      { reference: "Gênesis 3", note: "O engano e a primeira promessa" },
      { reference: "1 Timóteo 2", note: "Referência apostólica" },
    ],
    moments: [
      { title: "Criação", description: "Formada por Deus como auxiliadora idônea.", reference: "Gênesis 2" },
      { title: "Enganada pela serpente", description: "Come do fruto proibido.", reference: "Gênesis 3" },
      { title: "Mãe de Caim, Abel e Sete", description: "Nasce a humanidade.", reference: "Gênesis 4" },
    ],
  },
  {
    id: "noe",
    name: "Noé",
    category: "outro",
    era: "Antes do Dilúvio",
    role: "Justo em sua geração · Construtor da arca",
    color: "200 55% 50%",
    icon: "⛵",
    bio: "Homem justo e íntegro em sua geração. Andou com Deus e obedeceu ao construir a arca, preservando a vida sobre a terra durante o dilúvio.",
    keyVerses: [
      { reference: "Gênesis 6", note: "\"Noé achou graça aos olhos do Senhor\"" },
      { reference: "Gênesis 7", note: "O dilúvio" },
      { reference: "Gênesis 9", note: "Aliança do arco-íris" },
      { reference: "Hebreus 11", note: "Herói da fé" },
    ],
    moments: [
      { title: "Construção da arca", description: "Obedece por 120 anos.", reference: "Gênesis 6" },
      { title: "O Dilúvio", description: "Deus julga a terra e preserva Noé.", reference: "Gênesis 7" },
      { title: "Aliança do arco-íris", description: "Deus promete não destruir mais a terra por água.", reference: "Gênesis 9" },
    ],
  },
  {
    id: "sara",
    name: "Sara",
    aka: ["Sarai"],
    category: "patriarca",
    era: "~2156 – 2029 aC",
    role: "Esposa de Abraão · Mãe da promessa",
    color: "320 55% 65%",
    icon: "👑",
    bio: "Estéril por décadas, riu diante da promessa impossível e ainda assim viu Isaque nascer em sua velhice — testemunho da fidelidade de Deus.",
    keyVerses: [
      { reference: "Gênesis 17", note: "\"Sarai será mãe de nações\"" },
      { reference: "Gênesis 18", note: "A promessa se cumpre" },
      { reference: "Gênesis 21", note: "Nascimento de Isaque" },
      { reference: "Hebreus 11", note: "\"Pela fé, também Sara recebeu poder\"" },
    ],
    moments: [
      { title: "Chamada com Abraão", description: "Deixa Ur rumo a Canaã.", reference: "Gênesis 12" },
      { title: "Recebe novo nome", description: "Sarai passa a Sara.", reference: "Gênesis 17" },
      { title: "Nasce Isaque", description: "Aos 90 anos, sorri de alegria.", reference: "Gênesis 21" },
    ],
  },
  // ── Líderes / Juízes ──
  {
    id: "josue",
    name: "Josué",
    category: "lider",
    era: "~1500 – 1390 aC",
    role: "Sucessor de Moisés · Conquistador de Canaã",
    color: "160 65% 45%",
    icon: "🛡️",
    bio: "Servo fiel de Moisés desde jovem, tornou-se o líder que introduziu Israel na Terra Prometida. Sua vida ensina coragem e obediência confiante.",
    keyVerses: [
      { reference: "Josué 1", note: "\"Sê forte e corajoso\"" },
      { reference: "Josué 6", note: "Queda dos muros de Jericó" },
      { reference: "Josué 24", note: "\"Eu e a minha casa serviremos ao Senhor\"" },
    ],
    moments: [
      { title: "Espia de Canaã", description: "Fiel entre os doze.", reference: "Números 14" },
      { title: "Travessia do Jordão", description: "As águas se detêm.", reference: "Josué 3" },
      { title: "Sol parado em Gibeom", description: "Deus luta por Israel.", reference: "Josué 10" },
    ],
  },
  {
    id: "samuel",
    name: "Samuel",
    category: "profeta",
    era: "~1105 – 1010 aC",
    role: "Último juiz · Primeiro grande profeta",
    color: "210 65% 55%",
    icon: "🔔",
    bio: "Dedicado a Deus desde o ventre por Ana. Ouviu a voz do Senhor ainda menino no tabernáculo e ungiu os dois primeiros reis de Israel.",
    keyVerses: [
      { reference: "1 Samuel 3", note: "\"Fala, Senhor, teu servo ouve\"" },
      { reference: "1 Samuel 8", note: "Israel pede um rei" },
      { reference: "1 Samuel 16", note: "Unge Davi em Belém" },
    ],
    moments: [
      { title: "Consagrado desde criança", description: "Ana o entrega a Eli.", reference: "1 Samuel 1" },
      { title: "Chamado no tabernáculo", description: "Deus se revela ao menino.", reference: "1 Samuel 3" },
      { title: "Unge Saul e Davi", description: "Nasce a monarquia.", reference: "1 Samuel 10" },
    ],
  },
  {
    id: "rute",
    name: "Rute",
    category: "outro",
    era: "~1100 aC",
    role: "Moabita fiel · Bisavó de Davi",
    color: "35 75% 60%",
    icon: "🌾",
    bio: "Estrangeira que escolheu o Deus de Israel e não abandonou sua sogra Noemi. Sua fidelidade a levou à linhagem do Messias.",
    keyVerses: [
      { reference: "Rute 1", note: "\"O teu povo é o meu povo\"" },
      { reference: "Rute 2", note: "Colhe nos campos de Boaz" },
      { reference: "Rute 4", note: "Casa com Boaz · Nasce Obede" },
    ],
    moments: [
      { title: "Volta com Noemi", description: "Deixa Moabe por Israel.", reference: "Rute 1" },
      { title: "Encontra Boaz", description: "Achou graça no resgatador.", reference: "Rute 2" },
      { title: "Bisavó de Davi", description: "Entra na linhagem messiânica.", reference: "Rute 4" },
    ],
  },
  {
    id: "ester",
    name: "Ester",
    category: "outro",
    era: "~478 aC",
    role: "Rainha da Pérsia · Salvadora de seu povo",
    color: "295 65% 60%",
    icon: "👸",
    bio: "Órfã judia que se tornou rainha e arriscou a própria vida para salvar seu povo do extermínio — \"para tal tempo como este\".",
    keyVerses: [
      { reference: "Ester 4", note: "\"Se perecer, pereci\"" },
      { reference: "Ester 7", note: "Desmascara Hamã" },
      { reference: "Ester 9", note: "A festa de Purim" },
    ],
    moments: [
      { title: "Escolhida rainha", description: "Substitui Vasti no trono da Pérsia.", reference: "Ester 2" },
      { title: "Intercede pelo povo", description: "Vai ao rei sem ser chamada.", reference: "Ester 5" },
      { title: "Livramento", description: "Os judeus são salvos.", reference: "Ester 8" },
    ],
  },
  {
    id: "neemias",
    name: "Neemias",
    category: "lider",
    era: "~445 aC",
    role: "Copeiro do rei · Reconstrutor dos muros",
    color: "180 55% 45%",
    icon: "🧱",
    bio: "Servo do rei persa que chorou pelas ruínas de Jerusalém, orou e agiu. Liderou a reconstrução dos muros em apenas 52 dias.",
    keyVerses: [
      { reference: "Neemias 1", note: "Oração pelo povo" },
      { reference: "Neemias 2", note: "Vai a Jerusalém" },
      { reference: "Neemias 6", note: "Muros concluídos em 52 dias" },
    ],
    moments: [
      { title: "Ouve das ruínas", description: "Chora, jejua e ora.", reference: "Neemias 1" },
      { title: "Reconstrução", description: "Enfrenta oposição com fé e trabalho.", reference: "Neemias 4" },
      { title: "Reforma espiritual", description: "Esdras lê a Lei ao povo.", reference: "Neemias 8" },
    ],
  },
  // ── Profetas ──
  {
    id: "jeremias",
    name: "Jeremias",
    category: "profeta",
    era: "~650 – 570 aC",
    role: "Profeta chorão · Testemunha do exílio",
    color: "245 55% 55%",
    icon: "💧",
    bio: "Chamado desde o ventre. Profetizou por 40 anos advertindo Judá da queda iminente e viu Jerusalém ser destruída.",
    keyVerses: [
      { reference: "Jeremias 1", note: "\"Antes que te formasses no ventre te conheci\"" },
      { reference: "Jeremias 29", note: "\"Planos de paz e não de mal\"" },
      { reference: "Jeremias 31", note: "A nova aliança" },
      { reference: "Lamentações 3", note: "\"As misericórdias do Senhor se renovam\"" },
    ],
    moments: [
      { title: "Chamado ainda jovem", description: "Deus o santifica desde o ventre.", reference: "Jeremias 1" },
      { title: "Queda de Jerusalém", description: "Vê a cidade cair.", reference: "2 Reis 25" },
    ],
  },
  {
    id: "ezequiel",
    name: "Ezequiel",
    category: "profeta",
    era: "~622 – 570 aC",
    role: "Profeta no exílio babilônico",
    color: "280 60% 55%",
    icon: "🌪️",
    bio: "Sacerdote levado cativo à Babilônia. Recebeu visões grandiosas — a carruagem de Deus, o vale de ossos secos e o novo Templo.",
    keyVerses: [
      { reference: "Ezequiel 1", note: "Visão da glória do Senhor" },
      { reference: "Ezequiel 36", note: "Coração novo e espírito novo" },
      { reference: "Ezequiel 37", note: "O vale dos ossos secos" },
    ],
    moments: [
      { title: "Visão junto ao rio Quebar", description: "Comissionado profeta a Israel.", reference: "Ezequiel 1" },
      { title: "Ossos que vivem", description: "Deus mostra a restauração.", reference: "Ezequiel 37" },
    ],
  },
  {
    id: "jonas",
    name: "Jonas",
    category: "profeta",
    era: "~780 aC",
    role: "Profeta a Nínive",
    color: "190 70% 45%",
    icon: "🐋",
    bio: "Fugiu do chamado de Deus e foi engolido por um grande peixe. Restaurado, pregou em Nínive e viu a maior conversão do Antigo Testamento.",
    keyVerses: [
      { reference: "Jonas 1", note: "A fuga e a tempestade" },
      { reference: "Jonas 2", note: "Oração no ventre do peixe" },
      { reference: "Jonas 3", note: "Nínive se arrepende" },
    ],
    moments: [
      { title: "Fuga para Társis", description: "Tenta fugir do Senhor.", reference: "Jonas 1" },
      { title: "Três dias no peixe", description: "Sinal de Cristo.", reference: "Jonas 2" },
      { title: "Pregação a Nínive", description: "A cidade inteira se arrepende.", reference: "Jonas 3" },
    ],
  },
  // ── Novo Testamento (extras) ──
  {
    id: "jose-nt",
    name: "José de Nazaré",
    category: "outro",
    era: "~30 aC – 20 dC",
    role: "Pai adotivo de Jesus · Carpinteiro",
    color: "25 55% 50%",
    icon: "🔨",
    bio: "Homem justo e silencioso que acolheu a Maria e cuidou do menino Jesus, obedecendo prontamente às direções angelicais.",
    keyVerses: [
      { reference: "Mateus 1", note: "Aceita Maria por esposa" },
      { reference: "Mateus 2", note: "Foge para o Egito" },
      { reference: "Lucas 2", note: "Apresentação no Templo" },
    ],
    moments: [
      { title: "Sonho com o anjo", description: "Recebe Maria como esposa.", reference: "Mateus 1" },
      { title: "Fuga para o Egito", description: "Protege o menino Jesus.", reference: "Mateus 2" },
    ],
  },
  {
    id: "maria-madalena",
    name: "Maria Madalena",
    category: "outro",
    era: "~1 dC – 60 dC",
    role: "Discípula fiel · Primeira testemunha da ressurreição",
    color: "310 60% 60%",
    icon: "🌹",
    bio: "Liberta de sete demônios, seguiu a Jesus até a cruz e foi a primeira a vê-lo ressuscitado, sendo enviada a anunciar aos apóstolos.",
    keyVerses: [
      { reference: "Lucas 8", note: "Sete demônios expulsos" },
      { reference: "João 20", note: "\"Raboni!\" — encontra o Senhor ressuscitado" },
    ],
    moments: [
      { title: "Liberta por Jesus", description: "Nova vida no seguimento.", reference: "Lucas 8" },
      { title: "Ao pé da cruz", description: "Não abandona o Mestre.", reference: "João 19" },
      { title: "Vê o Ressuscitado", description: "Primeira testemunha.", reference: "João 20" },
    ],
  },
  {
    id: "joao-apostolo",
    name: "João",
    aka: ["João Evangelista", "Discípulo amado"],
    category: "apostolo",
    era: "~6 – 100 dC",
    role: "Apóstolo do amor · Autor do Evangelho e do Apocalipse",
    color: "195 75% 55%",
    icon: "📜",
    bio: "Pescador chamado por Jesus, tornou-se o \"discípulo amado\". Cuidou de Maria, escreveu cinco livros do NT e recebeu a Revelação em Patmos.",
    keyVerses: [
      { reference: "João 1", note: "\"No princípio era o Verbo\"" },
      { reference: "João 13", note: "\"Amai-vos uns aos outros\"" },
      { reference: "1 João 4", note: "\"Deus é amor\"" },
      { reference: "Apocalipse 1", note: "Visão de Cristo glorificado" },
    ],
    moments: [
      { title: "Chamado à beira-mar", description: "Deixa as redes.", reference: "Mateus 4" },
      { title: "Cuida de Maria", description: "Recebe-a como mãe.", reference: "João 19" },
      { title: "Revelação em Patmos", description: "Vê Cristo ressuscitado.", reference: "Apocalipse 1" },
    ],
  },
  {
    id: "estevao",
    name: "Estêvão",
    category: "outro",
    era: "~1 – 35 dC",
    role: "Primeiro mártir cristão",
    color: "0 65% 55%",
    icon: "🕊️",
    bio: "Diácono cheio de fé e do Espírito. Fez maravilhas entre o povo e, ao ser apedrejado, viu os céus abertos e pediu perdão pelos que o matavam.",
    keyVerses: [
      { reference: "Atos 6", note: "Escolhido diácono" },
      { reference: "Atos 7", note: "Discurso e martírio" },
    ],
    moments: [
      { title: "Diácono cheio do Espírito", description: "Serve à igreja primitiva.", reference: "Atos 6" },
      { title: "Vê os céus abertos", description: "Morre perdoando.", reference: "Atos 7" },
    ],
  },
  {
    id: "barnabe",
    name: "Barnabé",
    category: "apostolo",
    era: "~1 – 60 dC",
    role: "Filho da consolação · Companheiro de Paulo",
    color: "140 55% 45%",
    icon: "🤝",
    bio: "Levita generoso que apresentou Saulo aos apóstolos e o acompanhou na primeira viagem missionária. Reconhecia dons e encorajava jovens líderes.",
    keyVerses: [
      { reference: "Atos 4", note: "Vende propriedade pela igreja" },
      { reference: "Atos 11", note: "Envia buscar Saulo em Tarso" },
      { reference: "Atos 13", note: "Enviado com Paulo à missão" },
    ],
    moments: [
      { title: "Apresenta Saulo", description: "Aos apóstolos em Jerusalém.", reference: "Atos 9" },
      { title: "Antioquia", description: "Fortalece a nova igreja.", reference: "Atos 11" },
    ],
  },
];

export const findCharacterByName = (name: string): BibleCharacter | undefined => {
  const n = name.trim().toLowerCase();
  return BIBLE_CHARACTERS.find(
    (c) => c.name.toLowerCase() === n || c.aka?.some((a) => a.toLowerCase() === n),
  );
};