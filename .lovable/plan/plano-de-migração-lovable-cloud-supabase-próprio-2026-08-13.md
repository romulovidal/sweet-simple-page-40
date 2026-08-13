# Plano de Migração: Lovable Cloud → Supabase Próprio

## Posso fazer tudo por você?

Quase tudo, sim — mas com dois limites reais que verifiquei agora no seu projeto:

**O que eu consigo executar sozinho** (com a connection string e a service_role key do Supabase de destino, guardadas como secret — nunca coladas no chat):

- Recriar todo o schema `public`: tabelas, tipos, funções, triggers, índices, policies e GRANTs.
- Copiar todos os dados das 53 tabelas do `public` (volume atual é pequeno, cabe tranquilo).
- Recriar os usuários no destino via Admin API, preservando o mesmo UUID, e-mail, metadados e data de criação — assim todas as foreign keys e dados vinculados continuam batendo.
- Reescrever o `.env` do app para apontar ao novo projeto.
- Ajustar o código onde for necessário e revalidar o build.

**O que eu NÃO consigo fazer, mesmo com key:**

1. **Senhas dos usuários.** Confirmei agora: o acesso que tenho ao banco atual bloqueia a leitura do schema `auth` (`permission denied for schema auth`). Os hashes de senha não são expostos por nenhuma API. Ou seja: eu recrio os usuários, mas quem entra com e-mail e senha vai precisar redefinir a senha uma vez. Quem entra com Google/social não sente nada, desde que o provedor seja reconfigurado no destino com o mesmo e-mail.
2. **Deploy das Edge Functions no seu Supabase.** O deploy exige login no Supabase CLI com a sua conta. Eu preparo os comandos prontos, mas você roda (é um comando só).

Se preservar as senhas for obrigatório, existe um caminho: você rodar localmente um `pg_dump` do schema `auth` do banco atual (com a connection string que só você acessa) e importar no destino. Aí as senhas vão junto. Eu monto o comando exato.

**Sobre a key:** não cole a service_role key nem a connection string aqui no chat. Eu peço via ferramenta de secret, que grava em local seguro e não fica no histórico.

## Resumo executivo

Sim, é possível migrar o banco de dados, usuários, edge functions e configurações do Lovable Cloud para um projeto Supabase próprio. O Lovable Cloud é, por baixo, um Supabase gerenciado — o formato dos dados é o mesmo.

**Limitação importante:** não é possível "desconectar" o Lovable Cloud deste projeto. O que pode ser feito é:

1. Exportar todos os dados do Lovable Cloud.
2. Importar em um projeto Supabase novo/seu.
3. Apontar o app para o novo projeto atualizando as variáveis de ambiente.
4. Redeployar as Edge Functions e reconfigurar os secrets no novo projeto.

## O que será migrado

| Item | Situação atual | Como migrar |
|------|---------------|-------------|
| Banco de dados (tabelas, dados, RLS, policies, triggers, functions) | Lovable Cloud | Exportar/importar via SQL ou pg_dump |
| Auth (usuários, identidades) | Lovable Cloud | Requer exportação do schema `auth` e reimportação; é a parte mais delicada |
| Storage (imagens, PDFs, avatares) | Nenhum bucket cadastrado no projeto | Apenas recriar buckets no destino; sem dados para mover |
| Edge Functions | Código em `supabase/functions/` | Re-deploy com Supabase CLI no novo projeto |
| Secrets (API keys, VAPID, Evolution, etc.) | Configurados no Lovable Cloud | Reconfigurar manualmente no novo Supabase |

## Passo a passo

### 1. Preparação no destino

- Crie o projeto Supabase de destino.
- Anote:
  - `Project URL` (ex: `https://xxxx.supabase.co`)
  - `anon public` key
  - `service_role` key (guarde com segurança)
  - Connection string do banco (Database → Connection String → Transaction ou Session mode)
- Instale o Supabase CLI localmente: `npx supabase login` e `npx supabase link --project-ref <ref_destino>`.

### 2. Exportar o banco de dados atual

- No painel do Lovable Cloud, vá em **Cloud → Advanced settings → Export data**.
- Baixe o dump `.sql` completo (schema + dados).
- Alternativa técnica: com a `SUPABASE_DB_URL` e `SUPABASE_SERVICE_ROLE_KEY` do projeto atual, rodar localmente:
  ```bash
  pg_dump --clean --if-exists --schema-only "<SUPABASE_DB_URL>" > schema.sql
  pg_dump --data-only --disable-triggers "<SUPABASE_DB_URL>" > data.sql
  ```
- Para bancos até 100 MB, o arquivo SQL único costuma ser o suficiente.

### 3. Importar no Supabase destino

- No SQL Editor do novo projeto, execute o dump exportado.
- Ou via psql:
  ```bash
  psql -h <host_destino> -p 5432 -U postgres -d postgres -f dump_completo.sql
  ```
- Verifique se as tabelas, policies, triggers e functions foram criadas.
- Confirme se os `GRANT`s do schema `public` estão presentes (o dump já deve trazer, mas vale validar).

### 4. Migrar os usuários (Auth)

Esta é a etapa mais crítica. O Supabase armazena usuários no schema `auth.users`, com hashes de senha e metadados.

- Opção A (recomendada para manter login/senhas): exportar o schema `auth` completo do Lovable Cloud e importar no destino. Isso exige acesso ao banco com permissões suficientes para ler o schema `auth`.
- Opção B (aceitável se poucos usuários): deixar os usuários refazerem login. Eles precisarão usar "Esqueci a senha" ou login social novamente.
- Após importar, verifique se o trigger `on_auth_user_created` no `auth.users` do destino aponta para a função `handle_new_user()` do schema `public`.

### 5. Recriar Storage e buckets

- Como não há buckets no projeto atual, basta recriar os buckets no novo Supabase quando necessário (ex: avatares, PDFs, revistas).
- Ajuste as Storage Policies de acordo com as regras de acesso do app.

### 6. Re-deploy das Edge Functions

- No novo projeto, configure os secrets das Edge Functions (mesmos nomes do projeto atual):
  - `LOVABLE_API_KEY`
  - `GROQ_API_KEY`, `GEMINI_API_KEY`, `XAI_API_KEY`
  - `EVOLUTION_API_KEY`, `EVOLUTION_API_URL`
  - `VAPID_PRIVATE_KEY`, `VAPID_PUBLIC_KEY`, `VAPID_SUBJECT`
  - `YOUTUBE_API_KEY`
  - `SENTRY_DSN`
  - `ATIS_WEBHOOK_SECRET`
  - `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` do próprio projeto destino
- Faça deploy de todas as functions:
  ```bash
  npx supabase functions deploy
  ```
- Verifique no painel do Supabase se as funções estão ativas.

### 7. Atualizar o app para apontar para o novo Supabase

- Edite o arquivo `.env`:
  ```
  VITE_SUPABASE_PROJECT_ID=<ref_destino>
  VITE_SUPABASE_PUBLISHABLE_KEY=<anon_key_destino>
  VITE_SUPABASE_URL=https://<ref_destino>.supabase.co
  ```
- O arquivo `src/integrations/supabase/client.ts` é gerado automaticamente e lê essas variáveis, então não precisa ser alterado manualmente.
- Rebuild e teste localmente (`npm run dev`).

### 8. Testes essenciais

- Login com usuário existente.
- Leitura de capítulos da Bíblia (dados locais).
- Abertura da Harpa e Cânticos.
- Envio de pedido de oração.
- Painel admin e verificação de role.
- Edge Function de versículo do dia.
- Notificação push (se houver inscritos).
- Webhook do Atis (se estiver ativo).

### 9. Publicação

- Publique o app com o novo `.env`.
- Atualize domínios customizados, se houver.
- Monitore os logs das Edge Functions e do banco nos primeiros dias.

## Riscos e cuidados

- **Auth**: senhas de usuários não podem ser extraídas em texto plano. Sem exportar o schema `auth`, os usuários perderão acesso e precisarão redefinir senha.
- **IDs e referências**: os dados do banco usam UUIDs e foreign keys. O dump preserva esses IDs, desde que importado de uma só vez.
- **Secrets**: nenhuma chave de API migra automaticamente. Todas devem ser reconfiguradas no novo projeto.
- **Storage**: URLs de arquivos antigos apontarão para o domínio antigo. Se houver arquivos, eles precisam ser baixados e reenviados.
- **RLS/Policies**: o dump deve trazer as policies, mas é prudente validar se o app consegue ler/escrever corretamente.
- **Indisponibilidade**: durante a troca de `.env`, usuários ativos no app antigo podem parar de funcionar. Planeje um downtime breve.

## Alternativa recomendada

Se o motivo da migração for ter mais controle, considere primeiro usar o próprio painel do Lovable Cloud para backups e exportações periódicas. A migração para um Supabase próprio exige manutenção contínua do banco, deploy de functions, secrets e monitoramento — hoje tudo isso é gerenciado pelo Lovable Cloud.

## Próximos passos

Se você aprovar este plano, posso começar gerando o dump do banco atual e preparando os scripts de importação para o novo projeto Supabase.
