# Painel Atis — WhatsApp Bot Ministerial

Antes de codar Evolution API (que roda fora, no Railway), vamos construir **primeiro o painel de controle dentro do próprio app da Bíblia Atalaia**. Ele já vai ficar pronto pra "plugar" no Evolution depois via webhook.

## Arquitetura geral (visão)

```text
[App Bíblia Atalaia]  ──►  [Lovable Cloud / Edge Functions]  ◄──► [Evolution API no Railway]  ◄──►  [WhatsApp / Grupo]
   Painel /atis              webhooks + regras + DB                 (fica pra fase 2)
```

Fase 1 (agora): painel, tabelas, regras, agendamentos, endpoints.
Fase 2 (depois): subir Evolution no Railway e apontar o webhook pro nosso endpoint.

## Rota e acesso

- Nova rota `/atis` — somente `admin` (mesma checagem do `/admin`).
- Botão "Atis" dentro do `/admin` (header) → navega pra `/atis`.
- Botão "Voltar ao Admin" dentro do `/atis`.

## Layout (segue o padrão do app da Bíblia)

- Cores: mesmas variáveis (`--dark-bg`, `--dark-card`, `--primary`, streak orange). Nada de dourado novo.
- Tipografia: Inter, mesmos títulos/sombras dos cards do `/admin`.
- Ícones lucide, mesmos radius (`rounded-2xl`), mesmos botões shadcn.

**Mobile-first (< 768px):**

- Header fixo com logo "Atis" + status de conexão (bolinha verde/vermelha).
- Conteúdo em cards empilhados.
- **Bottom nav próprio do Atis** com 5 abas (mesmo estilo do `BottomNav` da Bíblia):
`Painel · Contatos · Agenda · Estudos · Config`.
- Ações principais em FAB / botões grandes.

**Desktop (≥ 768px):**

- Sidebar fixa esquerda (mesmo componente visual do `DesktopSidebar`) com as 5 seções.
- Área central larga com grid de cards / tabelas.
- Header com status + botão "Voltar ao Admin".

## Funções do painel (o que você vai controlar)

### 1. Painel (dashboard)

- Status da conexão com Evolution (online/offline, número conectado, QR code quando desconectado).
- Métricas: mensagens enviadas hoje, contatos ativos, grupos monitorados, últimas menções ao Atis.
- Atalhos: "Enviar broadcast", "Testar bot", "Ver logs".

### 2. Contatos & Grupos

- Lista de contatos individuais (nome, telefone, tags, opt-in, aniversário).
- Lista de grupos onde o Atis está + toggle "responder só se mencionado" por grupo.
- Importar CSV / cadastro manual / edição inline.
- Tags (ex.: "jovens", "obreiros", "visitantes") pra segmentar broadcasts.

### 3. Aniversariantes

- CRUD de aniversariantes (nome, data, telefone opcional, grupo alvo).
- Template da mensagem de parabéns (com variáveis `{nome}`, `{versiculo}`).
- Horário de envio diário (padrão Fortaleza-CE).
- Preview + histórico dos envios.

### 4. Agenda de mensagens (broadcasts & recorrentes)

- Criar envio: destino (contato, tag, grupo), tipo (texto, versículo, hino, estudo), data/hora ou recorrência (diária/semanal).
- Reaproveita **versículo do dia** e **culto de hoje** que já existem — só marca "enviar também no WhatsApp".
- Fila de envios pendentes + log de enviados/falhas.

### 5. Estudos ministeriais

- CRUD de estudos (título, tema, texto base com referências, perguntas de reflexão).
- Botão "Enviar agora" ou agendar.
- Estudos ficam também disponíveis pra consumo dentro do próprio app (Descubra), sem duplicar conteúdo.

### 6. Atis Bot (comportamento no grupo)

- Toggle global: ativo/pausado.
- Por grupo: "responder sempre" vs "só quando mencionado" (padrão: só mencionado, como você pediu).
- Palavras-gatilho extras (ex.: "Atis", "@atis", "bíblia").
- **Comandos habilitáveis** (cada um com switch on/off):
  - `versículo <ref>` → busca na Bíblia (usa o mesmo motor do app).
  - `buscar <palavra>` → busca inteligente (mesma da BiblePage).
  - `hino <nº>` → letra da Harpa Cristã + link.
  - `devocional` → devocional IA do dia.
  - `oração` → registra pedido de oração (vai pro admin).
  - `estudo` → envia o estudo do dia.
  - `aniversariantes` → lista do dia.
- Mensagem de boas-vindas quando entra em grupo novo.
- Rate limit por usuário (evitar spam).

### 7. Logs & Auditoria

- Todas as mensagens enviadas/recebidas (com filtro por grupo, contato, comando).
- Erros de webhook / falhas Evolution.
- Reutiliza `admin_activity_log`.

### 8. Configuração

- URL da Evolution API + API key (via secret).
- Nome de instância, número do bot.
- Prompt/persona do Atis (tom pastoral, saudação, assinatura).
- Fuso horário (default America/Fortaleza).
- Botão "Reconectar / mostrar QR".

## Integrações com o que já existe

- Bíblia: reusa `parseBibleReference` + `bibleSearch` (nenhum código duplicado).
- Harpa: reusa `src/data/harpa.ts`.
- IA: reusa `ai-fetch` (Gemini com fallback Lovable AI).
- Push do app continua igual — o Atis é um **canal adicional**, não substitui.
- Culto/versículo do dia: ganham checkbox "enviar também no WhatsApp".

## O que precisa no backend (Lovable Cloud)

Tabelas novas (com RLS admin-only + GRANTs):

- `atis_config` (1 linha, config global do bot)
- `atis_contacts` (contatos individuais)
- `atis_groups` (grupos WhatsApp + regras)
- `atis_birthdays`
- `atis_broadcasts` (agendamentos e histórico)
- `atis_studies`
- `atis_messages_log` (in/out)

Edge functions (stubs agora, plugam no Evolution depois):

- `atis-webhook` — recebe eventos do Evolution.
- `atis-send` — envia mensagem via Evolution.
- `atis-cron` — dispara aniversariantes, versículo do dia, estudos agendados.

Secrets a pedir **quando você subir o Evolution**:

- `EVOLUTION_API_URL`, `EVOLUTION_API_KEY`, `EVOLUTION_INSTANCE`.

## Ordem de entrega sugerida

1. Rota `/atis` + guard admin + botão no `/admin`.
2. Shell visual (sidebar desktop + bottom nav mobile + header).
3. Tabelas + telas CRUD (Contatos, Grupos, Aniversariantes, Estudos).
4. Dashboard com status "desconectado" (placeholder até o Evolution existir).
5. Agenda + cron.
6. Config + persona do Atis.
7. (Fase 2) Ligar no Evolution real com webhook.

## Perguntas rápidas antes de começar

1. Confirma que quer **tudo isso no painel já nesta primeira leva**, ou começamos só por **Dashboard + Contatos + Aniversariantes + Config** e o resto vem depois? Da forma que achar melhor, se achar que dá pra fazer tudo pode fazer, mas se precisar de etapas não tem problema quero tudo perfeito
2. Atis vai ter avatar/foto própria (posso gerar), ou usa o mesmo ícone do app? Vai ter um ícone próprio(avatar que seja editável)
3. Quer que o botão de acesso ao painel Atis apareça **só dentro do /admin** (mais discreto) ou também no menu do perfil? Somente no admin 