import type { HistoriaEvent } from "../types";

/**
 * ~45 eventos cronológicos. Todas as datas são aproximadas.
 * `references` são sempre baseadas no texto bíblico.
 */
export const EVENTS: HistoriaEvent[] = [
  // Princípio
  { id: "criacao", name: "Criação do mundo", periodId: "principio", year: -4000, approximate: true, description: "Em seis dias Deus cria os céus e a terra e no sétimo descansa.", context: "O universo tem origem em uma Palavra e um Propósito, não em acaso.", application: "Toda vida tem valor porque tem origem em Deus.", tags: ["criacao"], characterIds: ["adao", "eva"], references: ["Gênesis 1", "Gênesis 2", "João 1", "Colossenses 1"], icon: "🌌" },
  { id: "queda", name: "A Queda no Éden", periodId: "principio", year: -3990, approximate: true, description: "Adão e Eva desobedecem e o pecado entra no mundo. Deus promete a semente da mulher.", tags: ["profecia"], characterIds: ["adao", "eva"], placeIds: ["eden"], references: ["Gênesis 3", "Romanos 5"], icon: "🍎" },
  { id: "diluvio", name: "O Dilúvio", periodId: "principio", year: -2900, approximate: true, description: "Deus julga a maldade humana e preserva Noé, sua família e um par de cada animal na arca.", tags: ["juizo", "aliança"], characterIds: ["noe"], references: ["Gênesis 6", "Gênesis 7", "Gênesis 9"], icon: "🌊" },

  // Patriarcas
  { id: "chamado-abraao", name: "Chamado de Abraão", periodId: "patriarcas", year: -2091, approximate: true, description: "Deus chama Abrão de Ur para uma terra que lhe mostraria e promete uma grande nação.", tags: ["aliança", "messianico"], characterIds: ["abraao"], placeIds: ["ur", "canaa"], references: ["Gênesis 12"], icon: "🌟" },
  { id: "alianca-abraao", name: "Aliança com Abraão", periodId: "patriarcas", year: -2081, approximate: true, description: "Deus promete descendência como as estrelas; Abraão crê e é justificado.", tags: ["aliança"], characterIds: ["abraao"], references: ["Gênesis 15", "Romanos 4"], icon: "✨" },
  { id: "nasce-isaque", name: "Nasce Isaque", periodId: "patriarcas", year: -2066, approximate: true, description: "O filho da promessa nasce quando Sara já tinha 90 anos.", tags: ["milagre"], characterIds: ["sara", "isaque"], references: ["Gênesis 21"], icon: "🐑" },
  { id: "moria", name: "Sacrifício de Isaque", periodId: "patriarcas", year: -2050, approximate: true, description: "Abraão obedece a Deus até o extremo; o próprio Deus provê o cordeiro.", tags: ["messianico"], characterIds: ["abraao", "isaque"], references: ["Gênesis 22", "Hebreus 11"], icon: "🔥" },
  { id: "escada-betel", name: "Escada de Betel", periodId: "patriarcas", year: -1928, approximate: true, description: "Jacó sonha com uma escada que liga o céu à terra.", tags: [], characterIds: ["jaco"], placeIds: ["betel"], references: ["Gênesis 28", "João 1"], icon: "🪜" },
  { id: "peniel", name: "Luta em Peniel", periodId: "patriarcas", year: -1906, approximate: true, description: "Jacó luta com o Anjo do Senhor e recebe o nome Israel.", tags: [], characterIds: ["jaco"], placeIds: ["peniel"], references: ["Gênesis 32"], icon: "🌅" },
  { id: "jose-egito", name: "José governa o Egito", periodId: "patriarcas", year: -1885, approximate: true, description: "De prisioneiro a governador. Salva as nações da fome.", tags: [], characterIds: ["jose"], placeIds: ["egito"], references: ["Gênesis 41", "Gênesis 50"], icon: "👔" },

  // Êxodo
  { id: "sarça", name: "A sarça ardente", periodId: "exodo", year: -1446, approximate: true, description: "Deus se revela a Moisés como 'EU SOU' e o envia a libertar Israel.", tags: [], characterIds: ["moises"], placeIds: ["sinai"], references: ["Êxodo 3"], icon: "🌿" },
  { id: "pascoa", name: "A Páscoa", periodId: "exodo", year: -1446, approximate: true, description: "O sangue do cordeiro poupa Israel; o Egito é ferido; Israel sai.", tags: ["messianico"], characterIds: ["moises"], placeIds: ["egito"], references: ["Êxodo 12", "1 Coríntios 5:7"], icon: "🐑" },
  { id: "mar-vermelho", name: "Travessia do Mar Vermelho", periodId: "exodo", year: -1446, approximate: true, description: "Deus abre o mar e Israel passa em seco; o exército de Faraó é destruído.", tags: ["milagre"], characterIds: ["moises"], references: ["Êxodo 14"], icon: "🌊" },
  { id: "sinai", name: "A Lei no Sinai", periodId: "exodo", year: -1446, approximate: true, description: "Deus entrega os Dez Mandamentos e faz aliança com Israel.", tags: ["aliança"], characterIds: ["moises"], placeIds: ["sinai"], references: ["Êxodo 19", "Êxodo 20"], icon: "📜" },
  { id: "jerico", name: "Queda de Jericó", periodId: "exodo", year: -1406, approximate: true, description: "Ao som das trombetas, os muros caem. Israel entra na Terra Prometida.", tags: ["batalha", "milagre"], characterIds: ["josue"], placeIds: ["jerico"], references: ["Josué 6"], icon: "🎺" },

  // Juízes
  { id: "uncao-davi", name: "Unção de Davi", periodId: "juizes", year: -1025, approximate: true, description: "Samuel unge o mais novo dos filhos de Jessé como futuro rei.", tags: [], characterIds: ["samuel", "davi"], placeIds: ["belem"], references: ["1 Samuel 16"], icon: "🫒" },

  // Reino Unido
  { id: "golias", name: "Davi e Golias", periodId: "reino-unido", year: -1020, approximate: true, description: "Um pastor derrota o gigante filisteu com uma funda, em nome do Senhor.", tags: ["batalha"], characterIds: ["davi"], references: ["1 Samuel 17"], icon: "🪨" },
  { id: "alianca-davidica", name: "Aliança davídica", periodId: "reino-unido", year: -1000, approximate: true, description: "Deus promete a Davi um trono eterno — cumprido em Cristo.", tags: ["aliança", "messianico"], characterIds: ["davi"], references: ["2 Samuel 7", "Lucas 1"], icon: "👑" },
  { id: "templo-salomao", name: "Templo de Salomão", periodId: "reino-unido", year: -960, approximate: true, description: "O Templo é construído em Jerusalém; a glória do Senhor o enche.", tags: ["templo"], characterIds: ["salomao"], placeIds: ["jerusalem"], references: ["1 Reis 6", "1 Reis 8"], icon: "🏛️" },

  // Reino Dividido
  { id: "divisao-reino", name: "Divisão do reino", periodId: "reino-dividido", year: -930, approximate: true, description: "Após Salomão, 10 tribos seguem Jeroboão; Judá e Benjamim ficam com Roboão.", tags: [], references: ["1 Reis 12"], icon: "⚔️" },
  { id: "carmelo", name: "Elias no Carmelo", periodId: "reino-dividido", year: -862, approximate: true, description: "Elias enfrenta 450 profetas de Baal; o fogo do Senhor cai.", tags: ["milagre"], characterIds: ["elias"], references: ["1 Reis 18"], icon: "🔥" },
  { id: "queda-samaria", name: "Queda de Samaria", periodId: "reino-dividido", year: -722, approximate: true, description: "A Assíria destrói o reino do Norte e leva Israel cativo.", tags: ["juizo"], placeIds: ["samaria"], references: ["2 Reis 17"], icon: "🏚️" },
  { id: "queda-jerusalem", name: "Queda de Jerusalém", periodId: "reino-dividido", year: -586, approximate: true, description: "Nabucodonosor destrói o Templo e leva Judá cativa a Babilônia.", tags: ["juizo"], placeIds: ["jerusalem"], references: ["2 Reis 25", "Jeremias 52"], icon: "💥" },

  // Exílio
  { id: "fornalha", name: "A fornalha", periodId: "exilio", year: -580, approximate: true, description: "Sadraque, Mesaque e Abednego são preservados; um quarto anda com eles no fogo.", tags: ["milagre"], references: ["Daniel 3"], icon: "🔥" },
  { id: "cova-leoes", name: "Daniel na cova", periodId: "exilio", year: -538, approximate: true, description: "Daniel é lançado aos leões por orar; Deus fecha a boca das feras.", tags: ["milagre"], characterIds: ["daniel"], placeIds: ["babilonia"], references: ["Daniel 6"], icon: "🦁" },
  { id: "retorno-exilio", name: "Retorno do exílio", periodId: "exilio", year: -538, approximate: true, description: "Ciro, rei da Pérsia, permite a volta dos judeus para reconstruir o Templo.", tags: [], characterIds: ["esdras"], placeIds: ["jerusalem"], references: ["Esdras 1"], icon: "🚪" },
  { id: "muros-neemias", name: "Muros de Jerusalém reconstruídos", periodId: "exilio", year: -444, approximate: true, description: "Neemias reconstrói os muros em 52 dias apesar da oposição.", tags: [], characterIds: ["neemias"], placeIds: ["jerusalem"], references: ["Neemias 6"], icon: "🧱" },

  // Vida de Jesus
  { id: "anunciacao", name: "Anunciação", periodId: "vida-jesus", year: -5, approximate: true, description: "Gabriel anuncia a Maria o nascimento do Filho do Altíssimo.", tags: ["messianico"], characterIds: ["maria"], placeIds: ["nazare"], references: ["Lucas 1"], icon: "👼" },
  { id: "natal", name: "Nascimento de Jesus", periodId: "vida-jesus", year: -4, approximate: true, description: "O Verbo se faz carne em Belém, deitado numa manjedoura.", tags: ["messianico", "cumprimento"], characterIds: ["jesus", "maria"], placeIds: ["belem"], references: ["Lucas 2", "Miqueias 5"], icon: "🌟" },
  { id: "batismo-jesus", name: "Batismo de Jesus", periodId: "vida-jesus", year: 27, description: "João batiza Jesus no Jordão; o Pai fala e o Espírito desce como pomba.", tags: [], characterIds: ["jesus", "joao-batista"], placeIds: ["jordao"], references: ["Mateus 3"], icon: "🕊️" },
  { id: "sermao-monte", name: "Sermão do Monte", periodId: "vida-jesus", year: 28, description: "Jesus proclama o Reino: bem-aventuranças, oração do Pai Nosso, sal e luz.", tags: [], characterIds: ["jesus"], placeIds: ["galileia"], references: ["Mateus 5", "Mateus 6", "Mateus 7"], icon: "⛰️" },
  { id: "ceia", name: "A Última Ceia", periodId: "vida-jesus", year: 33, description: "Jesus institui a Nova Aliança em seu corpo e sangue.", tags: ["aliança"], characterIds: ["jesus", "pedro", "joao"], placeIds: ["jerusalem"], references: ["Lucas 22", "1 Coríntios 11"], icon: "🍞" },
  { id: "crucificacao", name: "Crucificação", periodId: "vida-jesus", year: 33, description: "O Cordeiro de Deus é crucificado, morrendo pelos pecadores.", tags: ["cumprimento", "messianico"], characterIds: ["jesus"], placeIds: ["jerusalem"], references: ["Isaías 53", "João 19"], icon: "✝️" },
  { id: "ressurreicao", name: "Ressurreição", periodId: "vida-jesus", year: 33, description: "Ao terceiro dia Jesus ressuscita, vencendo a morte.", tags: ["milagre", "cumprimento"], characterIds: ["jesus"], placeIds: ["jerusalem"], references: ["Mateus 28", "1 Coríntios 15"], icon: "🌅" },
  { id: "ascensao", name: "Ascensão", periodId: "vida-jesus", year: 33, description: "Jesus sobe ao céu diante dos discípulos e promete voltar.", tags: [], characterIds: ["jesus"], placeIds: ["jerusalem"], references: ["Atos 1"], icon: "☁️" },

  // Igreja Primitiva
  { id: "pentecostes", name: "Pentecostes", periodId: "igreja-primitiva", year: 33, description: "O Espírito Santo é derramado; 3000 se convertem sob a pregação de Pedro.", tags: [], characterIds: ["pedro"], placeIds: ["jerusalem"], references: ["Atos 2"], icon: "🔥" },
  { id: "damasco", name: "Conversão de Paulo", periodId: "igreja-primitiva", year: 34, description: "Jesus se revela ao perseguidor Saulo no caminho de Damasco.", tags: [], characterIds: ["paulo"], placeIds: ["damasco"], references: ["Atos 9"], icon: "⚡" },
  { id: "concilio-jerusalem", name: "Concílio de Jerusalém", periodId: "igreja-primitiva", year: 49, description: "Apóstolos e presbíteros decidem que os gentios não precisam da circuncisão.", tags: [], characterIds: ["pedro", "paulo"], placeIds: ["jerusalem"], references: ["Atos 15"], icon: "📜" },
  { id: "viagem-missionaria-1", name: "1ª viagem missionária", periodId: "igreja-primitiva", year: 46, description: "Paulo e Barnabé percorrem Chipre e a Ásia Menor pregando aos gentios.", tags: ["viagem"], characterIds: ["paulo", "barnabe"], placeIds: ["antioquia"], references: ["Atos 13", "Atos 14"], icon: "⛵" },
  { id: "viagem-missionaria-2", name: "2ª viagem missionária", periodId: "igreja-primitiva", year: 49, description: "Paulo alcança a Europa; funda igrejas em Filipos, Tessalônica e Corinto.", tags: ["viagem"], characterIds: ["paulo"], placeIds: ["corinto"], references: ["Atos 16", "Atos 17", "Atos 18"], icon: "🚢" },
  { id: "viagem-missionaria-3", name: "3ª viagem missionária", periodId: "igreja-primitiva", year: 53, description: "Paulo se estabelece em Éfeso por quase 3 anos; escreve Romanos e Coríntios.", tags: ["viagem"], characterIds: ["paulo"], placeIds: ["efeso"], references: ["Atos 19", "Atos 20"], icon: "✉️" },
  { id: "apocalipse", name: "Apocalipse em Patmos", periodId: "igreja-primitiva", year: 95, description: "João recebe a revelação de Jesus Cristo — o fim e a nova criação.", tags: ["profecia"], characterIds: ["joao"], placeIds: ["patmos"], references: ["Apocalipse 1", "Apocalipse 21"], icon: "📜" },
];

export const getEvent = (id: string) => EVENTS.find((e) => e.id === id);
export const eventsByPeriod = (periodId: string) => EVENTS.filter((e) => e.periodId === periodId);
export const eventsByCharacter = (charId: string) =>
  EVENTS.filter((e) => e.characterIds?.includes(charId));
