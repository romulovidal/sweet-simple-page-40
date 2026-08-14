# Migração para o Supabase próprio — `karyuuhxeismshhxuokg`

Schema `public`, `auth.users` e `auth.identities` **já foram migrados e validados**.
Este pacote cuida apenas do que falta: **secrets → Edge Functions → pg_cron/pg_net → trigger de auth → verificação**.

Nada aqui recria dados de `public`, `auth.users` ou `auth.identities`.

---

## Arquivos do pacote

| Arquivo | Função |
|---|---|
| `MIGRATION_README.md` | Este guia |
| `migrate.ps1` | Orquestrador único (roda tudo em ordem) |
| `deploy-functions.ps1` | Deploy das 30 Edge Functions |
| `migrate.sql` | Extensões, helper seguro, trigger de auth, 11 cron jobs, bucket |
| `verify-migration.ps1` | 9 blocos de verificação automática |
| `secrets.example.env` | Nomes dos secrets, sem valores |
| `config.target.toml` | `supabase/config.toml` do projeto de destino (`verify_jwt` por função) |

---

## Pré-requisitos

1. **Supabase CLI** instalado (`winget install Supabase.CLI` ou `scoop install supabase`).
2. **psql** no PATH (PostgreSQL client 15+).
3. Connection string do novo projeto na sessão do PowerShell:
   ```powershell
   $env:TARGET_SUPABASE_DB_URL = "postgresql://postgres.karyuuhxeismshhxuokg:<senha>@aws-...pooler.supabase.com:5432/postgres"
   ```
4. Arquivo `migration\.env.secrets` criado a partir de `secrets.example.env` e **preenchido**.
5. A **service_role key** do novo projeto em mãos (o script pede uma vez, com entrada oculta, e grava no Vault).

---

## Ordem exata de execução

```powershell
cd <repo>\migration
Copy-Item secrets.example.env .env.secrets   # preencha os valores
$env:TARGET_SUPABASE_DB_URL = "postgresql://..."
.\migrate.ps1
```

`migrate.ps1` executa, parando em qualquer erro (`$ErrorActionPreference = "Stop"`):

| Etapa | O que faz |
|---|---|
| 0 | Checa CLI, psql, connection string e `.env.secrets` |
| 1 | `supabase secrets set --env-file .env.secrets` |
| 2 | Chama `deploy-functions.ps1` (login → link → 30 deploys, com `config.target.toml` aplicado temporariamente) |
| 3 | Grava a `service_role` key no **Vault** como `service_role_key` (se ainda não existir) |
| 4 | Executa `migrate.sql` |
| 5 | Executa `verify-migration.ps1` |

---

## Secrets

**Fornecidos automaticamente pelo Supabase (não cadastrar):**
`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_URL`

**Cadastro manual obrigatório (13):**
`EVOLUTION_API_URL`, `EVOLUTION_API_KEY`, `ATIS_WEBHOOK_SECRET`, `GROQ_API_KEY`, `XAI_API_KEY`,
`GEMINI_API_KEY`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `YOUTUBE_API_KEY`,
`APP_PUBLIC_URL`, `APP_PUBLIC_ORIGIN`, *(opcional)* `LOVABLE_API_KEY`

**Frontend (Vercel):** `VITE_SUPABASE_PROJECT_ID`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`.

> **VAPID:** reutilize exatamente as chaves atuais. Chaves novas invalidam todas as
> inscrições de push já existentes e os usuários teriam que reativar as notificações.

---

## pg_cron / pg_net — abordagem segura

No projeto antigo cada job carregava a `anon key` colada no comando. Aqui:

- a `service_role` key fica no **Vault** (`vault.secrets`, nome `service_role_key`);
- `private.edge_call(fn, body)` (SECURITY DEFINER, sem permissão para `anon`/`authenticated`)
  lê a chave e monta o `net.http_post`;
- os 11 jobs chamam apenas `private.edge_call('<function>')`.

Resultado: **nenhuma chave em `cron.job.command`** e as funções de cron continuam com
`verify_jwt = true`.

Jobs recriados: `daily-verse-push`, `culto-reminder`, `atis-daily-devotional`,
`atis-birthday-greeting`, `atis-broadcast-runner`, `atis-daily-verse-dm`,
`atis-series-runner`, `atis-plans-runner` (`* * * * *`), `atis-welcome-runner` (`*/5`),
`smart-notifications` (`0 12 * * *`), `cleanup-old-data` (`0 6 * * *`, só SQL).
`migrate.sql` aborta se sobrar qualquer URL do projeto antigo.

---

## Auth

- `auth.users` e `auth.identities` **não são tocados** — UUIDs e hashes preservados.
- `on_auth_user_created` é recriado apontando para `public.handle_new_user()`.
- `handle_new_user()` ganhou `ON CONFLICT (user_id) DO NOTHING` + índice único em
  `profiles.user_id`: usuários que já têm perfil migrado **não geram duplicata**.
- Perfis faltantes para usuários já existentes **não** são criados por este script
  (o trigger só dispara em novos cadastros) — ver "Passos manuais".

---

## Storage

A origem tem **1 bucket privado**, `database_export_13_08_26`, com **1 objeto** (o próprio
dump da migração, ~11 MB). **Nenhum arquivo de usuário para migrar.** O bucket é recriado
vazio apenas por paridade; o objeto pode ser copiado manualmente se você quiser guardá-lo.

---

## `verify_jwt` por função (`config.target.toml`)

`verify_jwt = false` **somente** em: `atis-webhook` (protegida por `ATIS_WEBHOOK_SECRET`),
`s`, `cs`, `og`, `og-culto` (links curtos e imagens OG lidos por crawlers) e
`track-event`, `track-device`, `tts-verse`, `exegetai`, `ai-tools` (usadas por visitantes
não logados — a nova *publishable key* não é um JWT e seria rejeitada).
As outras 20 ficam no padrão `verify_jwt = true`. Nenhuma função administrativa fica pública.

---

## Referências ao projeto antigo (`hvdmobypsqksgkfrzhzf`)

Busca completa no repositório (`lovable.cloud`: **0 ocorrências**):

| Local | Situação |
|---|---|
| `.env` (3 linhas) | **Gerado automaticamente pelo Lovable Cloud** — não pode ser editado aqui e volta ao valor antigo. Fora do Lovable, quem vale são as env vars da Vercel. |
| `supabase/config.toml` | `project_id` antigo — trocado **temporariamente** pelo `deploy-functions.ps1`; o arquivo original é restaurado ao final. |
| `supabase/migrations/20260416014336_*.sql` | Histórico já aplicado — **não alterar**. |
| `.lovable/plan/...md` | Documental — não alterar. |
| `src/**` | **Nenhuma ocorrência** (o hardcode em `AtisPlansWA.tsx` já usa `import.meta.env`). |
| `vercel.json` | **Já aponta** para `karyuuhxeismshhxuokg` em `/v/:slug` e `/c/:slug`. |

Nenhuma alteração de código foi feita nesta etapa — nada precisava mudar.

---

## Evolution API

Secrets: `EVOLUTION_API_URL`, `EVOLUTION_API_KEY`, `ATIS_WEBHOOK_SECRET` (nenhum valor é
inventado ou exposto). Depois do deploy, a instância precisa apontar o webhook para
`https://karyuuhxeismshhxuokg.supabase.co/functions/v1/atis-webhook`. Isso é feito
**pelo próprio app**: painel `/atis` → reconectar/atualizar instância, que chama
`atis-instance` — ela monta a URL a partir de `SUPABASE_URL`, então já registra o novo
endereço automaticamente.

---

## Lovable AI

| Função | Situação fora do Lovable Cloud |
|---|---|
| `tts-verse` | **Quebra** — usa exclusivamente `LOVABLE_API_KEY` (Áudio da Bíblia). Requer chave própria de TTS ou reescrita. |
| `ai-tools`, `exegetai`, `culto-reminder`, `generate-push-message`, `classify-cantico`, `atis-webhook` (e tudo via `_shared/ai-fetch.ts`) | **Continuam funcionando** — fallback Groq → xAI → Gemini preservado, sem remoção silenciosa. |

---

## Pontos de atenção

1. `classify-cantico` importa `npm:@supabase/supabase-js@2/cors` — validar logo após o deploy.
2. Os runners do Atis rodam a cada minuto: só ative o cron depois que os secrets da
   Evolution estiverem corretos, para não disparar envios indevidos.
3. Testar `/v/<slug>` e `/c/<slug>` em produção após atualizar as env vars da Vercel.
4. O app hospedado no Lovable continua no backend antigo enquanto o `.env` gerenciado não
   for substituído — o corte real acontece na Vercel.