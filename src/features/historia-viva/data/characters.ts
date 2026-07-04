import type { HistoriaCharacter } from "../types";

/**
 * ~45 personagens cobrindo os 10 períodos.
 * Todos os anos são aproximados (usar `approximate` no display).
 * Referências bíblicas seguem o padrão "Livro Capítulo".
 */
export const CHARACTERS: HistoriaCharacter[] = [
  // ── Princípio ──
  {
    id: "adao", name: "Adão", meaning: "Homem, terra", periodId: "principio", tags: ["outro"], year: -4000, icon: "🌱",
    bio: "O primeiro homem, formado do pó da terra à imagem de Deus. Deu nome a todos os animais e caiu no Éden.",
    family: { spouses: ["eva"], children: ["caim", "abel", "sete"] },
    keyVerses: [{ ref: "Gênesis 1", note: "Criação" }, { ref: "Gênesis 3", note: "A queda" }, { ref: "Romanos 5", note: "Adão e Cristo" }],
    curiosities: ["Nomeou todos os animais.", "Viveu 930 anos segundo Gn 5:5."],
    lessons: ["A obediência simples é o teste da fé."],
    eventIds: ["criacao", "queda"], placeIds: ["eden"],
  },
  {
    id: "eva", name: "Eva", meaning: "Vida", periodId: "principio", tags: ["mulher"], year: -4000, icon: "🍎",
    bio: "A primeira mulher, formada da costela de Adão, mãe de todos os viventes.",
    family: { spouses: ["adao"], children: ["caim", "abel", "sete"] },
    keyVerses: [{ ref: "Gênesis 2", note: "Formação" }, { ref: "Gênesis 3", note: "Enganada pela serpente" }],
    eventIds: ["queda"], placeIds: ["eden"],
  },
  {
    id: "noe", name: "Noé", meaning: "Descanso", periodId: "principio", tags: ["outro", "lider"], year: -2900, icon: "🚢",
    bio: "Homem justo em sua geração. Construiu a arca por fé e salvou sua família e os animais do dilúvio.",
    family: { children: ["sem", "cam", "jafe"] },
    keyVerses: [{ ref: "Gênesis 6", note: "Chamado" }, { ref: "Gênesis 9", note: "Aliança do arco-íris" }, { ref: "Hebreus 11", note: "Fé de Noé" }],
    curiosities: ["Pregou 120 anos enquanto construía a arca."],
    lessons: ["A fé age antes de ver."],
    eventIds: ["diluvio"],
  },

  // ── Patriarcas ──
  {
    id: "abraao", name: "Abraão", meaning: "Pai de muitos", periodId: "patriarcas", tags: ["patriarca", "lider"], year: -2166, icon: "🌟",
    bio: "Chamado de Ur para deixar sua terra. Recebeu a promessa de uma descendência como as estrelas. Pai da fé.",
    family: { spouses: ["sara"], children: ["isaque", "ismael"] },
    keyVerses: [{ ref: "Gênesis 12", note: "O chamado" }, { ref: "Gênesis 15", note: "Aliança" }, { ref: "Gênesis 22", note: "Moriá" }, { ref: "Romanos 4", note: "Pai da fé" }],
    curiosities: ["Chamou Sara de irmã duas vezes com medo.", "Interseceu por Sodoma."],
    lessons: ["A justiça vem pela fé, não por obras."],
    eventIds: ["chamado-abraao", "alianca-abraao", "moria"], placeIds: ["ur", "canaa", "hebrom"],
  },
  {
    id: "sara", name: "Sara", meaning: "Princesa", periodId: "patriarcas", tags: ["mulher"], year: -2156, icon: "👑",
    bio: "Esposa de Abraão. Riu quando ouviu a promessa e concebeu Isaque na velhice.",
    family: { spouses: ["abraao"], children: ["isaque"] },
    keyVerses: [{ ref: "Gênesis 18", note: "A promessa e o riso" }, { ref: "Gênesis 21", note: "Nasce Isaque" }, { ref: "Hebreus 11", note: "Fé de Sara" }],
    eventIds: ["nasce-isaque"],
  },
  {
    id: "isaque", name: "Isaque", meaning: "Riso", periodId: "patriarcas", tags: ["patriarca"], year: -2066, icon: "🐑",
    bio: "O filho da promessa. Levado ao monte Moriá; Deus proveu o cordeiro. Pai de Esaú e Jacó.",
    family: { fathers: ["abraao"], mothers: ["sara"], spouses: ["rebeca"], children: ["esau", "jaco"] },
    keyVerses: [{ ref: "Gênesis 22", note: "Sacrifício frustrado" }, { ref: "Gênesis 24", note: "Casamento com Rebeca" }],
    eventIds: ["moria"], placeIds: ["berseba"],
  },
  {
    id: "rebeca", name: "Rebeca", meaning: "Que prende", periodId: "patriarcas", tags: ["mulher"], year: -2050, icon: "💧",
    bio: "Escolhida no poço para ser esposa de Isaque. Mãe de Esaú e Jacó.",
    family: { spouses: ["isaque"], children: ["esau", "jaco"] },
    keyVerses: [{ ref: "Gênesis 24", note: "O sinal no poço" }, { ref: "Gênesis 27", note: "A bênção a Jacó" }],
  },
  {
    id: "jaco", name: "Jacó", meaning: "Suplantador · Israel", periodId: "patriarcas", tags: ["patriarca"], year: -2006, icon: "🪜",
    bio: "Comprou a primogenitura, lutou com o Anjo e teve o nome mudado para Israel. Pai das 12 tribos.",
    family: { fathers: ["isaque"], mothers: ["rebeca"], spouses: ["lia", "raquel"], children: ["jose", "juda", "ruben", "benjamim"] },
    keyVerses: [{ ref: "Gênesis 28", note: "Escada de Betel" }, { ref: "Gênesis 32", note: "Peniel" }],
    eventIds: ["escada-betel", "peniel"], placeIds: ["betel", "peniel"],
  },
  {
    id: "jose", name: "José", meaning: "Ele acrescenta", periodId: "patriarcas", tags: ["lider"], year: -1915, icon: "👔",
    bio: "Vendido pelos irmãos, ascendeu no Egito. 'Vós pensastes o mal, mas Deus o tornou em bem.'",
    family: { fathers: ["jaco"], siblings: ["juda", "benjamim"] },
    keyVerses: [{ ref: "Gênesis 37", note: "Vendido" }, { ref: "Gênesis 41", note: "Governador do Egito" }, { ref: "Gênesis 50", note: "Perdão" }],
    lessons: ["Deus escreve certo por linhas tortas."],
    eventIds: ["jose-egito"], placeIds: ["egito"],
  },

  // ── Êxodo ──
  {
    id: "moises", name: "Moisés", meaning: "Tirado das águas", periodId: "exodo", tags: ["profeta", "lider"], year: -1526, icon: "📜",
    bio: "Salvo das águas, criado no palácio de Faraó. Deus o chama na sarça e o envia libertar Israel. Recebeu a Lei no Sinai.",
    family: { siblings: ["arao", "miria"] },
    keyVerses: [{ ref: "Êxodo 3", note: "A sarça ardente" }, { ref: "Êxodo 14", note: "Mar Vermelho" }, { ref: "Êxodo 20", note: "Os 10 mandamentos" }],
    curiosities: ["Manso mais que todos os homens (Nm 12:3).", "Falava com Deus face a face."],
    lessons: ["O chamado de Deus não depende da nossa capacidade."],
    eventIds: ["sarça", "pascoa", "mar-vermelho", "sinai"], placeIds: ["egito", "sinai"],
  },
  {
    id: "arao", name: "Arão", meaning: "Iluminado", periodId: "exodo", tags: ["sacerdote"], year: -1529, icon: "🕎",
    bio: "Irmão de Moisés e primeiro sumo sacerdote. Falou por Moisés diante de Faraó.",
    family: { siblings: ["moises", "miria"] },
    keyVerses: [{ ref: "Êxodo 28", note: "Vestes sacerdotais" }, { ref: "Levítico 9", note: "Consagração" }],
  },
  {
    id: "josue", name: "Josué", meaning: "O Senhor salva", periodId: "exodo", tags: ["lider"], year: -1450, icon: "⚔️",
    bio: "Servo de Moisés, conduziu Israel à Terra Prometida. Conquistou Jericó ao som das trombetas.",
    keyVerses: [{ ref: "Josué 1", note: "'Sê forte e corajoso'" }, { ref: "Josué 6", note: "Jericó" }, { ref: "Josué 24", note: "'Eu e minha casa serviremos ao Senhor'" }],
    eventIds: ["jerico"], placeIds: ["canaa", "jerico"],
  },

  // ── Juízes ──
  {
    id: "deborah", name: "Débora", meaning: "Abelha", periodId: "juizes", tags: ["juiz", "profeta", "mulher"], year: -1200, icon: "🐝",
    bio: "Juíza e profetisa. Liderou Baraque contra Sísera; cantou uma canção de vitória.",
    keyVerses: [{ ref: "Juízes 4", note: "Vitória sobre Sísera" }, { ref: "Juízes 5", note: "Cântico de Débora" }],
  },
  {
    id: "gideao", name: "Gideão", meaning: "Cortador", periodId: "juizes", tags: ["juiz"], year: -1191, icon: "🗡️",
    bio: "Chamado no lagar, derrotou os midianitas com 300 homens, tochas e cântaros.",
    keyVerses: [{ ref: "Juízes 6", note: "O sinal do velo" }, { ref: "Juízes 7", note: "Os 300" }],
  },
  {
    id: "sansao", name: "Sansão", meaning: "Sol", periodId: "juizes", tags: ["juiz"], year: -1100, icon: "💪",
    bio: "Nazireu de nascimento, forte pela unção do Espírito. Traído por Dalila, morreu vencendo os filisteus.",
    keyVerses: [{ ref: "Juízes 13", note: "Nascimento" }, { ref: "Juízes 16", note: "Dalila e a morte" }],
  },
  {
    id: "rute", name: "Rute", meaning: "Amiga", periodId: "juizes", tags: ["mulher"], year: -1140, icon: "🌾",
    bio: "Moabita que escolheu o Deus de Israel. Bisavó de Davi. 'Onde tu fores, eu irei.'",
    family: { spouses: ["boaz"] },
    keyVerses: [{ ref: "Rute 1", note: "'Teu Deus será o meu Deus'" }, { ref: "Rute 4", note: "Redenção" }],
  },
  {
    id: "samuel", name: "Samuel", meaning: "Ouvido de Deus", periodId: "juizes", tags: ["profeta", "juiz", "sacerdote"], year: -1105, icon: "🎺",
    bio: "Último juiz e primeiro dos profetas. Ungiu Saul e Davi como reis.",
    keyVerses: [{ ref: "1 Samuel 3", note: "'Fala, Senhor, teu servo ouve'" }, { ref: "1 Samuel 16", note: "Unção de Davi" }],
    eventIds: ["uncao-davi"],
  },

  // ── Reino Unido ──
  {
    id: "saul", name: "Saul", meaning: "Pedido", periodId: "reino-unido", tags: ["rei"], year: -1050, icon: "🗡️",
    bio: "Primeiro rei de Israel. Alto de estatura, começou humilde e terminou rejeitado por desobediência.",
    keyVerses: [{ ref: "1 Samuel 10", note: "Ungido rei" }, { ref: "1 Samuel 15", note: "Rejeitado" }],
  },
  {
    id: "davi", name: "Davi", meaning: "Amado", periodId: "reino-unido", tags: ["rei"], year: -1040, icon: "🎼",
    bio: "Pastor, salmista, guerreiro e rei segundo o coração de Deus. Derrotou Golias. Da sua linhagem viria o Messias.",
    family: { children: ["salomao", "absalao"] },
    keyVerses: [{ ref: "1 Samuel 17", note: "Golias" }, { ref: "2 Samuel 7", note: "Aliança davídica" }, { ref: "Salmos 51", note: "Arrependimento" }],
    curiosities: ["Escreveu ao menos 73 salmos.", "Reinou 40 anos."],
    lessons: ["Deus levanta e restaura quem se arrepende de coração."],
    eventIds: ["golias", "uncao-davi", "alianca-davidica"], placeIds: ["belem", "jerusalem"],
    contemporaryProphets: ["samuel", "nata"],
  },
  {
    id: "salomao", name: "Salomão", meaning: "Pacífico", periodId: "reino-unido", tags: ["rei"], year: -970, icon: "🏛️",
    bio: "Filho de Davi. Pediu sabedoria e recebeu também riqueza. Construiu o Templo. Caiu na idolatria na velhice.",
    family: { fathers: ["davi"] },
    keyVerses: [{ ref: "1 Reis 3", note: "Pedido de sabedoria" }, { ref: "1 Reis 8", note: "Templo dedicado" }, { ref: "Eclesiastes 12", note: "Teme a Deus" }],
    eventIds: ["templo-salomao"], placeIds: ["jerusalem"],
  },

  // ── Reino Dividido ──
  {
    id: "elias", name: "Elias", meaning: "O Senhor é Deus", periodId: "reino-dividido", tags: ["profeta"], year: -874, icon: "🔥",
    bio: "Profeta em Israel. Desafiou os profetas de Baal no Carmelo. Arrebatado num carro de fogo.",
    keyVerses: [{ ref: "1 Reis 18", note: "Monte Carmelo" }, { ref: "1 Reis 19", note: "'Cismo suave e delicado'" }, { ref: "2 Reis 2", note: "Arrebatamento" }],
    eventIds: ["carmelo"],
  },
  {
    id: "eliseu", name: "Eliseu", meaning: "Deus é salvação", periodId: "reino-dividido", tags: ["profeta"], year: -850, icon: "🌾",
    bio: "Discípulo de Elias, pediu porção dobrada. Realizou o dobro dos milagres do mestre.",
    keyVerses: [{ ref: "2 Reis 2", note: "Manto de Elias" }, { ref: "2 Reis 5", note: "Naamã curado" }],
  },
  {
    id: "isaias", name: "Isaías", meaning: "O Senhor salva", periodId: "reino-dividido", tags: ["profeta"], year: -740, icon: "📖",
    bio: "Profeta em Judá. Anunciou o Emanuel e o Servo Sofredor. Chamado numa visão do trono.",
    keyVerses: [{ ref: "Isaías 6", note: "Chamado no trono" }, { ref: "Isaías 7", note: "Emanuel" }, { ref: "Isaías 53", note: "Servo Sofredor" }],
  },
  {
    id: "jeremias", name: "Jeremias", meaning: "O Senhor exalta", periodId: "reino-dividido", tags: ["profeta"], year: -627, icon: "😢",
    bio: "Profeta chorão. Chamado desde o ventre. Anunciou o cativeiro babilônico e a Nova Aliança.",
    keyVerses: [{ ref: "Jeremias 1", note: "Chamado desde o ventre" }, { ref: "Jeremias 31", note: "Nova Aliança" }],
  },
  {
    id: "oseias", name: "Oseias", meaning: "Salvação", periodId: "reino-dividido", tags: ["profeta"], year: -750, icon: "💔",
    bio: "Casou-se com Gômer, uma prostituta, como sinal profético do amor de Deus por Israel infiel.",
    keyVerses: [{ ref: "Oseias 1", note: "Casamento simbólico" }, { ref: "Oseias 11", note: "'Do Egito chamei meu Filho'" }],
  },
  {
    id: "jonas", name: "Jonas", meaning: "Pomba", periodId: "reino-dividido", tags: ["profeta"], year: -780, icon: "🐋",
    bio: "Fugiu de Nínive, foi engolido por um grande peixe e pregou; a cidade se arrependeu.",
    keyVerses: [{ ref: "Jonas 2", note: "Oração no peixe" }, { ref: "Jonas 3", note: "Arrependimento de Nínive" }],
  },

  // ── Exílio ──
  {
    id: "daniel", name: "Daniel", meaning: "Deus é meu juiz", periodId: "exilio", tags: ["profeta"], year: -605, icon: "🦁",
    bio: "Levado cativo jovem para Babilônia. Interpretou sonhos, sobreviveu à cova dos leões, viu visões do fim.",
    keyVerses: [{ ref: "Daniel 3", note: "Fornalha" }, { ref: "Daniel 6", note: "Cova dos leões" }, { ref: "Daniel 9", note: "70 semanas" }],
    eventIds: ["cova-leoes"], placeIds: ["babilonia"],
  },
  {
    id: "ezequiel", name: "Ezequiel", meaning: "Deus fortalece", periodId: "exilio", tags: ["profeta", "sacerdote"], year: -593, icon: "🦴",
    bio: "Profeta no exílio. Viu a glória do Senhor, o vale dos ossos secos e o novo Templo.",
    keyVerses: [{ ref: "Ezequiel 1", note: "Visão da glória" }, { ref: "Ezequiel 37", note: "Ossos secos" }],
  },
  {
    id: "esdras", name: "Esdras", meaning: "Ajuda", periodId: "exilio", tags: ["sacerdote"], year: -458, icon: "📚",
    bio: "Escriba e sacerdote que retornou de Babilônia e restaurou a Lei em Jerusalém.",
    keyVerses: [{ ref: "Esdras 7", note: "Retorno com a Lei" }, { ref: "Neemias 8", note: "Leitura da Lei" }],
  },
  {
    id: "neemias", name: "Neemias", meaning: "O Senhor consola", periodId: "exilio", tags: ["lider"], year: -445, icon: "🧱",
    bio: "Copeiro do rei persa. Voltou a Jerusalém e reconstruiu os muros em 52 dias.",
    keyVerses: [{ ref: "Neemias 2", note: "Envio a Jerusalém" }, { ref: "Neemias 6", note: "Muros concluídos" }],
    placeIds: ["jerusalem"],
  },
  {
    id: "ester", name: "Ester", meaning: "Estrela", periodId: "exilio", tags: ["mulher"], year: -478, icon: "👸",
    bio: "Judia que se tornou rainha da Pérsia. 'Talvez para tal tempo como este chegaste ao reino.'",
    keyVerses: [{ ref: "Ester 4", note: "'Para tal tempo como este'" }, { ref: "Ester 7", note: "A queda de Hamã" }],
  },

  // ── Vida de Jesus ──
  {
    id: "maria", name: "Maria", meaning: "Amada", periodId: "vida-jesus", tags: ["mulher"], year: -18, icon: "🕊️",
    bio: "Virgem escolhida para ser mãe do Messias. 'Faça-se em mim segundo a tua palavra.'",
    family: { spouses: ["jose-nt"], children: ["jesus"] },
    keyVerses: [{ ref: "Lucas 1", note: "Anunciação e Magnificat" }, { ref: "João 2", note: "Cana" }],
    eventIds: ["anunciacao", "natal"], placeIds: ["nazare", "belem"],
  },
  {
    id: "jose-nt", name: "José (esposo de Maria)", meaning: "Ele acrescenta", periodId: "vida-jesus", tags: ["outro"], year: -20, icon: "🔨",
    bio: "Carpinteiro justo. Aceitou Maria por revelação angelical e criou Jesus como pai.",
    family: { spouses: ["maria"], children: ["jesus"] },
    keyVerses: [{ ref: "Mateus 1", note: "O sonho" }, { ref: "Mateus 2", note: "Fuga para o Egito" }],
  },
  {
    id: "joao-batista", name: "João Batista", meaning: "O Senhor é gracioso", periodId: "vida-jesus", tags: ["profeta"], year: -5, icon: "🌊",
    bio: "Precursor do Messias. Pregou arrependimento no deserto e batizou Jesus no Jordão.",
    keyVerses: [{ ref: "Mateus 3", note: "Batismo de Jesus" }, { ref: "João 1", note: "'Eis o Cordeiro de Deus'" }],
    eventIds: ["batismo-jesus"], placeIds: ["jordao"],
  },
  {
    id: "jesus", name: "Jesus Cristo", meaning: "O Senhor salva · Ungido", periodId: "vida-jesus", tags: ["jesus"], year: -4, icon: "✝️",
    bio: "O Verbo eterno que se fez carne. Viveu sem pecado, morreu pelos pecadores, ressuscitou ao terceiro dia e está assentado à direita do Pai.",
    family: { mothers: ["maria"], fathers: ["jose-nt"] },
    keyVerses: [{ ref: "João 1", note: "O Verbo se fez carne" }, { ref: "João 3", note: "'Deus amou o mundo'" }, { ref: "Isaías 53", note: "Servo Sofredor" }, { ref: "Mateus 28", note: "Ide e fazei discípulos" }],
    curiosities: ["Cumpriu mais de 300 profecias messiânicas.", "Único homem sem pecado."],
    lessons: ["Ele é o caminho, a verdade e a vida."],
    eventIds: ["natal", "batismo-jesus", "sermao-monte", "ceia", "crucificacao", "ressurreicao", "ascensao"],
    placeIds: ["belem", "nazare", "jerusalem", "galileia"],
  },
  {
    id: "pedro", name: "Pedro", meaning: "Pedra", periodId: "vida-jesus", tags: ["apostolo"], year: -1, icon: "🗝️",
    bio: "Pescador chamado por Jesus. Confessou o Cristo, negou-o e foi restaurado. Pregou em Pentecostes.",
    keyVerses: [{ ref: "Mateus 16", note: "Confissão" }, { ref: "João 21", note: "Restauração" }, { ref: "Atos 2", note: "Pentecostes" }],
    eventIds: ["pentecostes"],
  },
  {
    id: "joao", name: "João", meaning: "O Senhor é gracioso", periodId: "vida-jesus", tags: ["apostolo"], year: -6, icon: "❤️",
    bio: "O discípulo amado. Escreveu o Evangelho, três cartas e o Apocalipse. Cuidou de Maria após a cruz.",
    keyVerses: [{ ref: "João 21", note: "O discípulo amado" }, { ref: "Apocalipse 1", note: "Visão em Patmos" }],
    eventIds: ["apocalipse"], placeIds: ["efeso", "patmos"],
  },

  // ── Igreja Primitiva ──
  {
    id: "paulo", name: "Paulo", meaning: "Pequeno", periodId: "igreja-primitiva", tags: ["apostolo"], year: 5, icon: "✉️",
    bio: "Perseguidor convertido no caminho de Damasco. Apóstolo dos gentios. Escreveu 13 cartas do NT.",
    keyVerses: [{ ref: "Atos 9", note: "Conversão" }, { ref: "Romanos 8", note: "Nada nos separa" }, { ref: "Filipenses 1:21", note: "'Para mim o viver é Cristo'" }],
    eventIds: ["damasco", "viagem-missionaria-1", "viagem-missionaria-2", "viagem-missionaria-3"],
    placeIds: ["damasco", "antioquia", "corinto", "efeso", "roma"],
  },
  {
    id: "estevao", name: "Estêvão", meaning: "Coroa", periodId: "igreja-primitiva", tags: ["outro"], year: 30, icon: "🕯️",
    bio: "Primeiro mártir cristão. Viu Jesus à direita de Deus antes de ser apedrejado.",
    keyVerses: [{ ref: "Atos 6", note: "Diácono cheio do Espírito" }, { ref: "Atos 7", note: "Martírio" }],
  },
  {
    id: "barnabe", name: "Barnabé", meaning: "Filho da consolação", periodId: "igreja-primitiva", tags: ["apostolo"], year: 5, icon: "🤝",
    bio: "Encorajador. Levou Paulo aos apóstolos e o acompanhou na 1ª viagem missionária.",
    keyVerses: [{ ref: "Atos 4", note: "Vende propriedade" }, { ref: "Atos 13", note: "Enviado ao 1º campo" }],
  },
  {
    id: "lidia", name: "Lídia", meaning: "Da região da Lídia", periodId: "igreja-primitiva", tags: ["mulher"], year: 50, icon: "💜",
    bio: "Vendedora de púrpura em Filipos. Primeira convertida na Europa; hospedou Paulo.",
    keyVerses: [{ ref: "Atos 16", note: "Conversão em Filipos" }],
  },
];

export const getCharacter = (id: string) => CHARACTERS.find((c) => c.id === id);
export const charactersByPeriod = (periodId: string) => CHARACTERS.filter((c) => c.periodId === periodId);
