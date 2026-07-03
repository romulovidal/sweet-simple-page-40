// Timeline bíblica visual — eras, eventos e personagens
// Datas aproximadas seguindo a cronologia tradicional (Ussher/erudita conservadora).

export interface TimelineEvent {
  year: string; // ex: "~1446 aC", "33 dC"
  title: string;
  description: string;
  characters?: string[];
  reference?: string; // ex: "Êxodo 12"
}

export interface TimelineEra {
  id: string;
  name: string;
  period: string; // ex: "~2000 - 1800 aC"
  summary: string;
  color: string; // hsl triplet
  icon: string; // emoji ilustrativo
  events: TimelineEvent[];
}

export const BIBLE_TIMELINE: TimelineEra[] = [
  {
    id: "criacao",
    name: "Criação e Patriarcas",
    period: "Início — ~1800 aC",
    summary: "Da criação ao chamado de Abraão e a formação do povo de Israel através dos patriarcas.",
    color: "45 95% 55%",
    icon: "🌍",
    events: [
      { year: "Início", title: "A Criação", description: "Deus cria os céus e a terra em seis dias e descansa no sétimo.", reference: "Gênesis 1—2", characters: ["Adão", "Eva"] },
      { year: "—", title: "A Queda", description: "Adão e Eva desobedecem e o pecado entra no mundo.", reference: "Gênesis 3", characters: ["Adão", "Eva"] },
      { year: "—", title: "O Dilúvio", description: "Deus preserva Noé e sua família na arca enquanto julga a humanidade.", reference: "Gênesis 6—9", characters: ["Noé"] },
      { year: "~2091 aC", title: "Chamado de Abraão", description: "Deus chama Abrão de Ur e promete fazer dele uma grande nação.", reference: "Gênesis 12", characters: ["Abraão", "Sara"] },
      { year: "~2066 aC", title: "Nascimento de Isaque", description: "O filho da promessa nasce a Abraão e Sara na velhice.", reference: "Gênesis 21", characters: ["Isaque", "Abraão", "Sara"] },
      { year: "~2006 aC", title: "Jacó e Esaú", description: "Nascem os gêmeos; Jacó recebe a bênção e é renomeado Israel.", reference: "Gênesis 25—32", characters: ["Jacó", "Esaú"] },
      { year: "~1898 aC", title: "José no Egito", description: "Vendido pelos irmãos, José se torna governador do Egito e salva sua família da fome.", reference: "Gênesis 37—50", characters: ["José", "Jacó"] },
    ],
  },
  {
    id: "exodo",
    name: "Escravidão e Êxodo",
    period: "~1800 — 1400 aC",
    summary: "Israel escravizado no Egito é libertado por Moisés, recebe a Lei e caminha rumo à Terra Prometida.",
    color: "25 95% 55%",
    icon: "🔥",
    events: [
      { year: "~1526 aC", title: "Nascimento de Moisés", description: "Escondido no Nilo, é adotado pela filha de Faraó.", reference: "Êxodo 2", characters: ["Moisés"] },
      { year: "~1446 aC", title: "As Dez Pragas e a Páscoa", description: "Deus julga o Egito e liberta Israel na noite da Páscoa.", reference: "Êxodo 7—12", characters: ["Moisés", "Arão", "Faraó"] },
      { year: "~1446 aC", title: "Travessia do Mar Vermelho", description: "As águas se abrem e Israel escapa do exército egípcio.", reference: "Êxodo 14", characters: ["Moisés"] },
      { year: "~1446 aC", title: "A Lei no Sinai", description: "Deus entrega os Dez Mandamentos e a Aliança a Moisés.", reference: "Êxodo 19—20", characters: ["Moisés"] },
      { year: "~1406 aC", title: "Morte de Moisés", description: "Após 40 anos no deserto, Moisés vê Canaã e morre no monte Nebo.", reference: "Deuteronômio 34", characters: ["Moisés", "Josué"] },
      { year: "~1406 aC", title: "Conquista de Jericó", description: "Josué lidera a travessia do Jordão e a queda dos muros de Jericó.", reference: "Josué 6", characters: ["Josué", "Raabe"] },
    ],
  },
  {
    id: "juizes",
    name: "Período dos Juízes",
    period: "~1400 — 1050 aC",
    summary: "Ciclos de apostasia e libertação: Israel se afasta, é oprimido, clama e Deus levanta juízes.",
    color: "35 85% 50%",
    icon: "⚔️",
    events: [
      { year: "~1200 aC", title: "Débora e Baraque", description: "Uma profetisa julga Israel e derrota o general Sísera.", reference: "Juízes 4—5", characters: ["Débora", "Baraque", "Jael"] },
      { year: "~1180 aC", title: "Gideão", description: "Com apenas 300 homens derrota os midianitas.", reference: "Juízes 6—8", characters: ["Gideão"] },
      { year: "~1100 aC", title: "Sansão", description: "O juiz nazireu de força sobrenatural luta contra os filisteus.", reference: "Juízes 13—16", characters: ["Sansão", "Dalila"] },
      { year: "~1100 aC", title: "Rute e Boaz", description: "A moabita fiel se torna bisavó do rei Davi.", reference: "Rute 1—4", characters: ["Rute", "Boaz", "Noemi"] },
      { year: "~1080 aC", title: "Samuel, o último juiz", description: "Profeta e juiz que unge os primeiros reis de Israel.", reference: "1 Samuel 3", characters: ["Samuel", "Eli"] },
    ],
  },
  {
    id: "reino-unido",
    name: "Reino Unido",
    period: "~1050 — 930 aC",
    summary: "Saul, Davi e Salomão reinam sobre um Israel unificado. Construção do Templo em Jerusalém.",
    color: "265 70% 60%",
    icon: "👑",
    events: [
      { year: "~1050 aC", title: "Saul, o primeiro rei", description: "Ungido por Samuel, reina 40 anos mas é rejeitado por desobediência.", reference: "1 Samuel 10", characters: ["Saul", "Samuel"] },
      { year: "~1025 aC", title: "Davi e Golias", description: "O jovem pastor derrota o gigante filisteu com uma funda.", reference: "1 Samuel 17", characters: ["Davi", "Golias"] },
      { year: "~1010 aC", title: "Davi torna-se rei", description: "Após a morte de Saul, Davi reina em Hebrom e depois em Jerusalém.", reference: "2 Samuel 5", characters: ["Davi"] },
      { year: "~970 aC", title: "Salomão sucede Davi", description: "Recebe sabedoria sobrenatural e leva Israel ao auge de esplendor.", reference: "1 Reis 3", characters: ["Salomão", "Davi"] },
      { year: "~966 aC", title: "Construção do Templo", description: "Salomão constrói a Casa do Senhor em Jerusalém, em 7 anos.", reference: "1 Reis 6", characters: ["Salomão"] },
    ],
  },
  {
    id: "reinos-divididos",
    name: "Reinos Divididos",
    period: "~930 — 586 aC",
    summary: "Após Salomão, o reino se divide em Israel (Norte) e Judá (Sul). Profetas confrontam a idolatria.",
    color: "0 75% 55%",
    icon: "⚡",
    events: [
      { year: "~930 aC", title: "Divisão do Reino", description: "Roboão perde as 10 tribos do Norte para Jeroboão.", reference: "1 Reis 12", characters: ["Roboão", "Jeroboão"] },
      { year: "~870 aC", title: "Elias vs. Baal", description: "O profeta desafia 450 profetas de Baal no monte Carmelo.", reference: "1 Reis 18", characters: ["Elias", "Acabe", "Jezabel"] },
      { year: "~850 aC", title: "Ministério de Eliseu", description: "Sucessor de Elias, realiza dobro dos milagres.", reference: "2 Reis 2", characters: ["Eliseu"] },
      { year: "~740 aC", title: "Isaías profetiza", description: "Anuncia julgamento e o Messias vindouro por 60 anos.", reference: "Isaías 6", characters: ["Isaías"] },
      { year: "722 aC", title: "Queda de Samaria", description: "A Assíria destrói o Reino do Norte; as 10 tribos são exiladas.", reference: "2 Reis 17", characters: [] },
      { year: "~627 aC", title: "Jeremias, o profeta chorão", description: "Adverte Judá do julgamento iminente pelos babilônios.", reference: "Jeremias 1", characters: ["Jeremias"] },
    ],
  },
  {
    id: "exilio",
    name: "Exílio Babilônico",
    period: "586 — 538 aC",
    summary: "Jerusalém cai, o Templo é destruído e Judá é levada cativa por 70 anos na Babilônia.",
    color: "220 40% 45%",
    icon: "⛓️",
    events: [
      { year: "586 aC", title: "Queda de Jerusalém", description: "Nabucodonosor destrói o Templo de Salomão e leva Judá cativa.", reference: "2 Reis 25", characters: ["Nabucodonosor"] },
      { year: "~605 aC", title: "Daniel na Babilônia", description: "Jovem nobre exilado interpreta sonhos de reis e resiste na fé.", reference: "Daniel 1—6", characters: ["Daniel"] },
      { year: "~593 aC", title: "Visões de Ezequiel", description: "O profeta anuncia esperança de restauração aos exilados.", reference: "Ezequiel 37", characters: ["Ezequiel"] },
      { year: "~586 aC", title: "Os três hebreus na fornalha", description: "Sadraque, Mesaque e Abednego são preservados no fogo.", reference: "Daniel 3", characters: ["Sadraque", "Mesaque", "Abednego"] },
    ],
  },
  {
    id: "retorno",
    name: "Retorno e Restauração",
    period: "538 — 400 aC",
    summary: "Ciro liberta os exilados. Zorobabel reconstrói o Templo; Neemias, os muros; Esdras ensina a Lei.",
    color: "160 60% 45%",
    icon: "🏛️",
    events: [
      { year: "538 aC", title: "Decreto de Ciro", description: "O rei persa autoriza o retorno dos judeus a Jerusalém.", reference: "Esdras 1", characters: ["Ciro", "Zorobabel"] },
      { year: "~516 aC", title: "Segundo Templo", description: "Zorobabel conclui a reconstrução do Templo em Jerusalém.", reference: "Esdras 6", characters: ["Zorobabel", "Ageu", "Zacarias"] },
      { year: "~479 aC", title: "Ester salva o povo", description: "Rainha da Pérsia intercede e evita o extermínio dos judeus.", reference: "Ester 4—7", characters: ["Ester", "Mardoqueu"] },
      { year: "~445 aC", title: "Muros de Jerusalém", description: "Neemias lidera a reconstrução dos muros em 52 dias.", reference: "Neemias 6", characters: ["Neemias", "Esdras"] },
    ],
  },
  {
    id: "intertestamentario",
    name: "Período Intertestamentário",
    period: "~400 aC — 4 aC",
    summary: "Os '400 anos de silêncio': ascensão grega, macabeus, domínio romano. Prepara-se o cenário para o Messias.",
    color: "290 40% 50%",
    icon: "📜",
    events: [
      { year: "~332 aC", title: "Alexandre e o helenismo", description: "A cultura grega se espalha; surge a Septuaginta.", reference: "—", characters: [] },
      { year: "~167 aC", title: "Revolta dos Macabeus", description: "Judas Macabeu liberta Jerusalém e purifica o Templo (Hanuká).", reference: "—", characters: [] },
      { year: "63 aC", title: "Roma domina Judeia", description: "Pompeu conquista Jerusalém; começa o domínio romano.", reference: "—", characters: [] },
    ],
  },
  {
    id: "cristo",
    name: "Vida de Cristo",
    period: "~4 aC — 33 dC",
    summary: "Nascimento, ministério, morte e ressurreição de Jesus — o centro da história bíblica.",
    color: "200 90% 55%",
    icon: "✝️",
    events: [
      { year: "~4 aC", title: "Nascimento de Jesus", description: "O Messias nasce em Belém, cumprindo as profecias.", reference: "Lucas 2", characters: ["Jesus", "Maria", "José"] },
      { year: "~27 dC", title: "Batismo por João", description: "Jesus é batizado no Jordão e começa Seu ministério público.", reference: "Mateus 3", characters: ["Jesus", "João Batista"] },
      { year: "~28 dC", title: "Sermão do Monte", description: "Jesus proclama as Bem-aventuranças e o Reino dos Céus.", reference: "Mateus 5—7", characters: ["Jesus"] },
      { year: "~29 dC", title: "Milagres e parábolas", description: "Cura enfermos, ressuscita mortos e ensina em parábolas.", reference: "Marcos 4—5", characters: ["Jesus", "Pedro"] },
      { year: "33 dC", title: "Última Ceia", description: "Institui a Nova Aliança com pão e vinho na noite da traição.", reference: "Lucas 22", characters: ["Jesus", "Pedro", "Judas"] },
      { year: "33 dC", title: "Crucificação", description: "Jesus é crucificado no Calvário pelos pecados do mundo.", reference: "João 19", characters: ["Jesus", "Pilatos"] },
      { year: "33 dC", title: "Ressurreição", description: "No terceiro dia, Jesus ressuscita — vitória sobre a morte.", reference: "Mateus 28", characters: ["Jesus", "Maria Madalena"] },
    ],
  },
  {
    id: "igreja",
    name: "Igreja Primitiva",
    period: "33 — 100 dC",
    summary: "Pentecostes, expansão missionária pelo Império, cartas apostólicas e o Apocalipse.",
    color: "340 75% 55%",
    icon: "🕊️",
    events: [
      { year: "33 dC", title: "Pentecostes", description: "O Espírito Santo desce; nasce a Igreja com 3.000 conversos.", reference: "Atos 2", characters: ["Pedro"] },
      { year: "~34 dC", title: "Conversão de Saulo", description: "Perseguidor da Igreja encontra Cristo a caminho de Damasco.", reference: "Atos 9", characters: ["Paulo"] },
      { year: "~46 dC", title: "1ª Viagem Missionária", description: "Paulo e Barnabé levam o Evangelho à Ásia Menor.", reference: "Atos 13—14", characters: ["Paulo", "Barnabé"] },
      { year: "~50 dC", title: "Concílio de Jerusalém", description: "Apóstolos decidem que gentios não precisam se circuncidar.", reference: "Atos 15", characters: ["Pedro", "Paulo", "Tiago"] },
      { year: "~57 dC", title: "Epístola aos Romanos", description: "Paulo escreve sua obra-prima teológica sobre justificação pela fé.", reference: "Romanos 1", characters: ["Paulo"] },
      { year: "~67 dC", title: "Martírio de Paulo", description: "Executado em Roma sob Nero; escreve 2 Timóteo antes de morrer.", reference: "2 Timóteo 4", characters: ["Paulo"] },
      { year: "70 dC", title: "Destruição de Jerusalém", description: "Roma destrói o Templo, cumprindo a profecia de Jesus.", reference: "Mateus 24", characters: [] },
      { year: "~95 dC", title: "Apocalipse", description: "João recebe a revelação de Cristo glorificado na ilha de Patmos.", reference: "Apocalipse 1", characters: ["João"] },
    ],
  },
];