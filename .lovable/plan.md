
# Refactor Estudos Bíblicos

Reescrever a experiência de Explorar como uma **plataforma de ensino dinâmica** dentro de `/descubra`, com 3 módulos ricos e coerentes, todos linkando para a Bíblia.

## 1. Nova arquitetura da tela

Substituir a seção atual (3 cards que abrem sheets) por um **hub próprio** — `src/components/study/StudyHub.tsx` — com:

- Hero de abertura ("Estudos Bíblicos · Conheça a história por trás dos versículos")
- 3 módulos como grandes cards visuais com preview animado:
  - **Personagens** → gallery + perfil "se apresentando"
  - **Linha do Tempo** → timeline cinematográfica horizontal
  - **Mapas** → mapa SVG interativo do mundo bíblico
- Cada módulo abre em **tela cheia interna** (não sheet pequeno), com header próprio, back button e navegação entre itens sem fechar.

Roteamento leve por estado (sem mudar rotas do app), preservando back handler nativo.

## 2. Personagens "se apresentando" (card interativo animado)

Novo componente `CharacterStage.tsx` — cada personagem aparece como se estivesse **se apresentando ao usuário**:

- Retrato ilustrado grande (gerado por IA, 1 por personagem principal) com **parallax sutil**, brilho pulsante e vinheta na cor do personagem.
- **Fala em 1ª pessoa** aparecendo com efeito typewriter frase por frase ("Sou Abraão. Deus me chamou de Ur dos caldeus...").
- Controles: ▶ próxima fala, ⟲ repetir, → próximo personagem (navegação estilo stories).
- Barra de progresso das falas no topo (tipo Instagram Stories).
- Rodapé com chips: **Momentos marcantes** (timeline vertical), **Versículos-chave** (clicáveis → Bíblia), **Perguntar à IA**.
- Transição entre personagens: crossfade + slide horizontal.

Dados: expandir `bibleCharacters.ts` para ~50 personagens, cada um com novo campo `presentation: string[]` (falas em 1ª pessoa, 4–6 frases).

Retratos: gerar 12–16 imagens dos principais (Jesus, Moisés, Davi, Abraão, Paulo, Maria, Pedro, Elias, Daniel, Ester, João Batista, Sansão, Rute, Salomão, José, Noé). Personagens sem retrato usam gradiente estilizado + monograma.

## 3. Linha do Tempo cinematográfica

Reescrever `VisualTimeline` como `TimelineStage.tsx`:

- **Scroll horizontal** com snap por era, cada era com cor de fundo dominante e degradê.
- Cabeçalho fixo mostrando era atual + intervalo (ex.: "Patriarcas · 2000–1500 a.C.").
- Cards de evento grandes com: ano, título, resumo, personagem envolvido (avatar clicável → abre Personagem), referência bíblica (chip clicável → Bíblia).
- Mini-mapa da timeline no rodapé para navegação rápida.
- Animação de entrada por card (fade + slide) conforme entra em viewport.

Expandir `bibleTimeline.ts` para 40+ eventos cobrindo Criação → Apocalipse.

## 4. Mapas interativos

Reescrever `BiblicalMaps` como `MapStage.tsx`:

- **SVG estilizado do mundo bíblico** (Mediterrâneo oriental) desenhado à mão em paths — Egito, Canaã, Mesopotâmia, Ásia Menor, Grécia, Roma, Mar Vermelho, Mar Morto, Jordão.
- Cidades como **pontos clicáveis** com halo pulsante (Ur, Harã, Betel, Jerusalém, Belém, Nínive, Babilônia, Éfeso, Corinto, Roma, etc.).
- Seletor de **jornada** (Êxodo, Abraão, Paulo 1ª/2ª/3ª viagem, Exílio, 7 Igrejas): ao selecionar, **rota animada** desenha os traços entre pontos com `stroke-dashoffset`.
- Clicar em cidade abre painel lateral com: descrição, personagens ligados (chips → Personagens), eventos ligados (chips → Timeline), referências bíblicas (→ Bíblia).
- Controle de zoom/pan simples com clamp.

Expandir `bibleMaps.ts` para 10+ jornadas e ~30 cidades com metadados ricos.

## 5. Integração com Bíblia

Todos os módulos usam um único helper `openBibleReference(ref)` que:
- Faz parse do texto (livro + capítulo, e versículo quando existe)
- Navega para `/biblia?book=abbrev&chapter=N&verse=V`
- Fecha o hub

Já existe base disso no `DiscoverPage`; centralizar em `src/lib/bibleNav.ts`.

## 6. Limpeza

- Remover `VisualTimeline`, `BiblicalMaps`, `BibleCharacters` antigos (ou marcar como deprecated e não montar mais).
- Remover event listeners globais (`open-bible-character`, `open-bible-map`, `open-bible-timeline`) e substituir por API interna do hub via prop/context.
- Manter o botão de disparar cada módulo pelo hub, sem os triggers antigos espalhados.

---

## Detalhes técnicos

**Novos arquivos**
```
src/components/study/
  StudyHub.tsx              # Hub central com 3 módulos
  CharacterStage.tsx        # Personagem se apresentando (stories-like)
  CharacterGallery.tsx      # Grid com busca e filtros
  TimelineStage.tsx         # Timeline horizontal cinematográfica
  MapStage.tsx              # Mapa SVG interativo
  MapSvg.tsx                # SVG do mundo bíblico (paths desenhados)
  shared/StageShell.tsx     # Layout fullscreen com header + back
  shared/RefChip.tsx        # Chip clicável de referência bíblica
src/lib/bibleNav.ts         # openBibleReference helper
src/assets/characters/*.jpg # ~15 retratos gerados
```

**Arquivos modificados**
- `src/pages/DiscoverPage.tsx` — substitui a seção Estudos Bíblicos pelo `<StudyHub />`
- `src/data/bibleCharacters.ts` — +17 personagens, novo campo `presentation` + `portrait?`
- `src/data/bibleTimeline.ts` — +eventos até chegar em ~40, com `characterId` e `mapCityId` opcionais
- `src/data/bibleMaps.ts` — reestruturar em `CITIES` + `JOURNEYS` (rotas por ids de cidade)

**Arquivos removidos**
- `src/components/VisualTimeline.tsx`
- `src/components/BiblicalMaps.tsx`
- `src/components/BibleCharacters.tsx`

**Animações**
- Typewriter: `interval` limpo no unmount, respeita `prefers-reduced-motion`.
- Parallax do retrato: `transform` baseado em `mousemove` (desktop) e `deviceorientation` opcional (mobile).
- Stories progress bar: CSS transition + estado controlado.
- Timeline scroll snap: `scroll-snap-type: x mandatory`.
- Mapa rota: `stroke-dashoffset` animado com `requestAnimationFrame` (não CSS transition; determinístico).

**Design tokens**
- Manter dark theme atual. Usar cor de cada personagem/era como accent local via `hsl(var(--*))` inline (padrão já usado no app).
- Sem hardcode de cores fora do que já existe.

**Escopo do que NÃO muda**
- Rotas, autenticação, backend, timezone, PWA.
- Botão flutuante de Perguntar à IA continua igual.
- Nada na tela `/biblia` além de receber o parâmetro `verse` (já suportado).

---

## Ordem de execução

1. Criar `bibleNav.ts` + `StageShell` + `RefChip`
2. Expandir dados (`bibleCharacters`, `bibleTimeline`, `bibleMaps`)
3. Gerar retratos IA em batch (15 imagens)
4. Construir `CharacterStage` + `CharacterGallery`
5. Construir `TimelineStage`
6. Construir `MapSvg` + `MapStage`
7. Construir `StudyHub` e integrar em `DiscoverPage`
8. Remover componentes antigos e event listeners
9. Verificar build e testar navegação → Bíblia
