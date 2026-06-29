## O que vai mudar

### 1. Remover "Planos de Leitura" da Home (aba Hoje)
No arquivo `src/pages/HomePage.tsx`, na aba **Hoje**, remover dois blocos:

- **"Seus Planos"** (enrolledPlans) — bloco na coluna direita (linhas ~405–441).
- **"Planos de Leitura"** (availablePlans) — grid largura total (linhas ~445–470).

Resultado: a aba Hoje passará a ter apenas Saudação, Versículo do dia, Continuar lendo e, abaixo, "Destaques e Avisos". Assim os avisos sobem na página e ficam mais visíveis.

Os planos continuam acessíveis normalmente pela aba **Planos** no menu inferior — nada é apagado do banco.

Também removerei o estado e os filtros que ficam órfãos (`planProgress`, `enrolledPlans`, `availablePlans`) para manter o código limpo. O fetch de `admin_plans` e o cache `ADMIN_PLANS_CACHE_KEY` também são removidos da Home (continuam carregando na página de Planos).

### 2. Player de vídeo sem logo do YouTube

Não existe uma forma 100% oficial de remover a marca d'água do YouTube — o parâmetro `modestbranding` foi descontinuado e o logo no canto superior direito sempre aparece durante a reprodução. A solução padrão e estável é usar uma **fachada (facade)**: mostrar a thumbnail do vídeo com um botão Play customizado e, ao clicar, carregar o iframe já com um **overlay opaco cobrindo o logo do YouTube no canto superior direito**. Isso também:

- Carrega mais rápido (sem iframe pesado até o usuário clicar).
- Usa o domínio `youtube-nocookie.com` (sem cookies de tracking até o play).
- Esconde o logo do YouTube durante a reprodução com uma faixa da cor do card sobre o canto superior direito.

#### Implementação
Criar componente novo `src/components/YouTubePlayer.tsx`:

- Props: `videoId: string`, `title: string`.
- Estado inicial: mostra `<img>` com `https://i.ytimg.com/vi/{id}/hqdefault.jpg` + botão Play centralizado (ícone do lucide, sem branding YT).
- Ao clicar: troca por `<iframe src="https://www.youtube-nocookie.com/embed/{id}?autoplay=1&rel=0&modestbranding=1&playsinline=1&controls=1" />`.
- Um `<div>` absoluto no canto superior direito (cerca de `w-20 h-10`, `bg-[hsl(var(--dark-card))]`) cobre a área onde aparece o logo do YouTube enquanto o vídeo toca. A área dos controles do player (parte inferior) fica totalmente livre — play/pause/volume/fullscreen continuam funcionando.

Em `src/pages/HomePage.tsx`, substituir os dois `<iframe>` (linhas ~484–494 e ~529–539) por `<YouTubePlayer videoId={...} title={post.title} />`. O extrator de ID já existe (`getYoutubeEmbedUrl`); vou refatorar para `extractYoutubeId` retornando só o ID.

### Observação honesta
O overlay cobre o logo nos cantos, mas no meio do player o YouTube ainda mostra brevemente o título/canal quando o vídeo começa (tooltip nativo, não removível). Se isso também for um problema, a única alternativa é hospedar os vídeos fora do YouTube (ex.: upload direto no app), o que muda o fluxo de criação de posts. Posso seguir com a fachada + overlay como descrito, que é o melhor possível usando YouTube.

### Validação antes de entregar
- Build limpo.
- Abrir `/` no preview (Playwright), checar: sem "Planos de Leitura" / "Seus Planos" na aba Hoje; "Destaques e Avisos" visível mais acima.
- Em um post tipo vídeo: confirmar visualmente (screenshot) que o logo do YouTube no canto superior direito fica coberto durante a reprodução e que os controles funcionam.
