# ATIS V3 — Contrato Técnico do Backend

Status: fase 1 iniciada em 2026-08-16.

## Princípios

- ATIS V3 é um subsistema isolado do push nativo do app.
- WhatsApp/Evolution não deve compartilhar fluxo com `send-push`, `daily-verse-push`, `smart-notifications` ou `culto-reminder`.
- Frontend nunca recebe `service_role`, Evolution API key ou webhook secret.
- Toda mutação administrativa passa por Edge Function autenticada; tabelas ATIS ficam somente leitura para Admin no frontend.
- `super_admin` herda permissões de `admin` via `public.has_role`.
- Automação nunca envia diretamente: automação gera mensagens/fila; worker envia.
- Destinos suportados desde o núcleo: individual, contato e grupo.

## Domínios

### Conexão
- `atis_instances`: instância WhatsApp/Evolution e estado normalizado.
- Estados canônicos: `disconnected`, `connecting`, `qr_required`, `connected`, `error`, `unknown`.

### Pessoas e grupos
- `atis_contacts`: agenda ATIS; pode vincular um `auth.users.id`.
- `atis_groups`: grupos reais do provider, identificados pelo ID do provider, nunca apenas pelo nome.
- `atis_group_members`: participantes sincronizados dos grupos.
- Usuários do app continuam tendo `profiles.whatsapp` e `profiles.whatsapp_opt_in`; o ATIS pode criar/alimentar contato vinculado quando necessário.

### Conteúdo e automações
- `atis_templates`: templates versionados com variáveis.
- `atis_automations`: configuração de automações por schedule, evento ou manual.
- `atis_automation_runs`: execução idempotente e auditável de cada automação.

### Fila
- `atis_messages`: mensagem lógica/campanha.
- `atis_message_targets`: um destino resolvido por mensagem; suporta `individual`, `contact`, `group`.
- `atis_message_attempts`: histórico imutável de tentativas de entrega.
- `atis_claim_message_targets(...)`: claim atômico com `FOR UPDATE SKIP LOCKED` e lease.

### Webhook
- `atis_webhook_events`: deduplicação, processamento e auditoria de eventos da Evolution.

### Configuração não-secreta
- `atis_settings`: limites de entrega, timezone e defaults não sensíveis.
- Secrets ficam exclusivamente no ambiente server-side.

## Estados da fila

Mensagem: `queued`, `processing`, `completed`, `partial`, `failed`, `cancelled`.

Destino: `pending`, `processing`, `sent`, `failed`, `skipped`, `cancelled`.

## Dedupe e idempotência

- `atis_messages.dedupe_key` é única quando preenchida.
- Um destino é único dentro da mensagem via `(message_id, target_key)`.
- Runs de scheduler são únicos por `(automation_id, scheduled_for)`.
- `idempotency_key` opcional em `atis_automation_runs` permite dedupe adicional.

## Destinos

### individual
Fila contém snapshot `phone_e164` e `target_key` como `phone:+55...`.

### contact
Fila contém `contact_id`, snapshot `phone_e164` e `target_key` como `contact:<uuid>`.

### group
Fila contém `group_id`, snapshot `provider_target_id` e `target_key` como `group:<uuid>`.

## Consentimento

- Contatos possuem `whatsapp_opt_in`, `opt_in_source`, `opt_in_at` e `opt_out_at`.
- Automações individuais não devem incluir contatos sem consentimento quando a regra exigir opt-in.
- Grupos possuem `allow_automations` independente de contatos individuais.

## Segurança

Fluxo Admin:

`Bearer user JWT -> Supabase Auth -> user id validado -> user_roles -> admin/super_admin -> service_role interno -> operação`.

Fluxo interno:

`pg_cron/worker -> token server-to-server validado -> operação`.

Webhook:

`Evolution -> autenticação própria do webhook -> atis-webhook`.

Nenhuma autorização pode confiar em JWT somente decodificado.

## RLS da fase 1

Todas as tabelas ATIS têm RLS habilitada.

`authenticated` recebe apenas SELECT e somente quando `public.has_role(auth.uid(), 'admin')` é verdadeiro. Alterações serão feitas pelas Edge Functions após autenticação e autorização.

## Política inicial de entrega

- máximo: 8 mensagens/minuto;
- intervalo mínimo: 3000 ms;
- máximo de 3 tentativas;
- retry: 60 s, 300 s, 900 s;
- quiet hours modeladas, inicialmente desabilitadas.

Esses valores são defaults não-secretos e poderão ser alterados depois via backend administrativo.

## Fases seguintes

1. Validar schema/RLS/claim da fila.
2. Implementar adapter `EvolutionProvider` sem UI.
3. Implementar `atis-instance` e validar status/criação/QR/conectar/desconectar.
4. Implementar `atis-webhook` e normalização de eventos.
5. Implementar `atis-send` para enfileirar individual, contato e grupo.
6. Implementar worker/runner e validar envio E2E.
7. Implementar sincronização de contatos e grupos.
8. Adicionar automações uma por vez.
9. Só então construir o frontend administrativo.

## Critério de conclusão

Cada etapa terá três estados separados: `IMPLEMENTADO`, `BACKEND VALIDADO`, `E2E VALIDADO`. Build isolado não conta como validação E2E.
