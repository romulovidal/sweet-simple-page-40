
# Fase 3 — "História Viva da Bíblia"

Cinco módulos novos integrados ao hub, mantendo o design system (dark theme, tokens semânticos, Inter, PT-BR) e o padrão de navegação por `useHistoryNav`.

---

## 1. Favoritos e progresso na nuvem (base de tudo)

Hoje `useFavorites` guarda em `localStorage`. Vamos migrar para Lovable Cloud e usar a mesma infraestrutura para o progresso do Quiz e do Plano Cronológico.

### Tabelas novas (com GRANT + RLS por `auth.uid()`)
- `historia_favorites` — `id, user_id, kind, ref_id, created_at` (kind = character/event/place/book/period).
- `historia_quiz_attempts` — `id, user_id, quiz_id, score, total, duration_ms, answers jsonb, created_at`.
- `historia_plan_progress` — `id, user_id, plan_id, day_index, completed_at, unique(user_id, plan_id, day_index)`.
- `historia_stats` (view materializada leve, calculada no cliente a partir das três acima; sem tabela extra).

### Código
- `hooks/useFavorites.ts` reescrito: se logado → Supabase; se anônimo → fallback `localStorage` (migração one-shot quando faz login).
- Novo `hooks/useCloudSync.ts` que expõe `savePlanDay`, `getPlanProgress`, `saveQuizAttempt`, `listQuizAttempts`.
- Toasts curtos em falha (`sonner`).

---

## 2. Quiz Bíblico

Motor genérico de quizzes com bancos por tema, dificuldade e período.

### Dados (`data/quizzes.ts`)
Cada quiz: `{ id, title, description, icon, difficulty: 'facil'|'medio'|'dificil', periodId?, tags[], questions[] }`
Cada questão: `{ id, prompt, choices[4], correct: 0-3, explanation, ref?: BibleRef, entityRef?: EntityRef }`.
Bancos iniciais (≥ 60 perguntas):
1. **Patriarcas** (Gênesis) — 12 questões.
2. **Êxodo e Deserto** — 10.
3. **Reis e Profetas** — 12.
4. **Vida de Jesus** — 12.
5. **Cartas de Paulo** — 8.
6. **Geografia bíblica** — 8.

### Componentes (`components/Quiz/`)
- `QuizHub.tsx` — grid de quizzes, badges de "Melhor pontuação" e "Tentativas".
- `QuizPlayer.tsx` — tela full com barra de progresso, contador, 4 alternativas grandes, feedback imediato colorido (verde/vermelho), explicação + `RefLink` + link para a entidade relacionada.
- `QuizResult.tsx` — pontuação, tempo, medalha (🥉/🥈/🥇), CTA "Refazer" / "Revisar erradas" / "Explorar personagens do tema".
- Persistência: cada finalização chama `saveQuizAttempt`.

### UX
- Animação de acerto (ping) e erro (shake) usando classes existentes.
- Contraste garantido: alternativas em `bg-dark-card`, estado ativo com `hsl(var(--primary))` sobre `text-white`.
- Acessível: `aria-live` no feedback, teclas 1-4 no desktop.

---

## 3. Comparações lado a lado

Comparar duas entidades do mesmo tipo (dois personagens, dois lugares, dois livros).

### Componente `components/Compare/CompareView.tsx`
- Tab dentro do hub: **Comparar**.
- 2 seletores (usa a mesma `useHistoriaSearch`) → gera 2 colunas com linhas alinhadas:
  - Período, datas, tags, lugares principais, eventos-chave, referências, contemporâneos, palavras-chave.
- Linhas divergentes destacadas com barra lateral `bg-primary/40`.
- Botão "Trocar", "Comparar aleatórios", "Salvar comparação" (armazena par nos favoritos).

---

## 4. Plano de leitura cronológico

Roteiros diários que percorrem a Bíblia em ordem de eventos, não canônica.

### Dados (`data/plans.ts`)
- `{ id, title, description, durationDays, coverColor, days: PlanDay[] }`
- `PlanDay { index, title, summary, readings: BibleRef[], entities: EntityRef[] }`
Planos iniciais:
1. **Bíblia em 90 dias — cronológico** (esqueleto: 90 dias, referências abreviadas).
2. **De Abraão a Josué em 21 dias**.
3. **Vida de Jesus em 30 dias** (harmonia dos evangelhos).
4. **Igreja Primitiva em 14 dias** (Atos + cartas).

### Componentes (`components/Plan/`)
- `PlanHub.tsx` — cards com progresso circular (`% concluído`), botão "Continuar" salta para o próximo dia não lido.
- `PlanReader.tsx` — dia atual: resumo, lista de leituras com `RefLink` (abre a Bíblia), chips de personagens/eventos/lugares (`openRef`), checkbox "Marcar como lido" → grava em `historia_plan_progress`.
- `PlanCalendar.tsx` — grid 7 colunas mostrando dias ✅/⏳, permite pular para qualquer dia.
- Streak local: dias consecutivos concluídos (reutiliza padrão já existente do app).

---

## 5. Estatísticas pessoais

Dashboard que consolida uso do módulo História Viva.

### Componente `components/Stats/StatsView.tsx`
Cards:
- **Personagens explorados** (# distintos abertos, favoritados).
- **Períodos visitados** (barra empilhada colorida pelas cores de `PERIODS`).
- **Quiz** — total tentativas, média, melhor tema, gráfico de linhas das últimas 10 tentativas.
- **Plano** — plano ativo, % concluído, dias em sequência.
- **Mapa** — lugares tocados (contagem simples via favoritos).
- **Conquistas / Badges** locais: primeiros marcos (1º quiz, 10 favoritos, 7 dias seguidos, ler 3 evangelhos).

Tracking mínimo: novo hook `useHistoriaTracking` — grava `viewed:entityRef` em memória + `historia_favorites` como fonte principal; sem tabela adicional de views para não inflar backend.

---

## 6. Integração no hub

`index.tsx`:
- Novos tabs: **Quiz** (🧠), **Comparar** (⚖️), **Plano** (📅), **Estatísticas** (📊).
- Ordem final dos tabs: Linha do tempo · Mapa · Paralelas · Personagens · Eventos · Lugares · Livros · **Plano · Quiz · Comparar · Estatísticas**.
- Header ganha ícone ♥ que abre modal de Favoritos (aproveita `EntityDetail` via `openRef`).

### Padrões de contraste (aplicado em todos os módulos novos)
- Superfícies: `bg-dark-card` / `bg-dark-card-hover` com `text-dark-text` para textos primários e `text-dark-muted` para secundários.
- Chips ativos: fundo `hsl(var(--primary))`, texto branco (Chip já usa `textOn`).
- Faixas coloridas por período: sempre com `text-white` + `paintOrder: stroke` quando sobre SVG.
- Nenhum `text-black`/`bg-white` cru; sempre tokens.

---

## Arquivos que serão criados/alterados

**Migração SQL** (Lovable Cloud): 3 tabelas + GRANT + RLS.

**Criar**
- `hooks/useCloudSync.ts`
- `hooks/useHistoriaTracking.ts`
- `data/quizzes.ts`, `data/plans.ts`
- `components/Quiz/{QuizHub,QuizPlayer,QuizResult}.tsx`
- `components/Compare/CompareView.tsx`
- `components/Plan/{PlanHub,PlanReader,PlanCalendar}.tsx`
- `components/Stats/StatsView.tsx`
- `components/shared/ProgressRing.tsx`

**Editar**
- `hooks/useFavorites.ts` (cloud + migração)
- `index.tsx` (novos tabs + Favoritos)
- `types.ts` (tipos Quiz, Plan, PlanDay, QuizAttempt)

---

## Ordem de execução

1. Migração SQL (tabelas + policies + GRANT).
2. `useCloudSync` + `useFavorites` cloud.
3. Quiz completo (dados + 3 componentes).
4. Plano cronológico (dados + 3 componentes).
5. Comparações.
6. Estatísticas.
7. Wire-up final no `index.tsx` + revisão de contraste.

Confirma que sigo com esse escopo? Se preferir cortar algo (ex.: começar sem "Comparações" ou sem "Plano de 90 dias"), me diga antes que eu abra a migração.
