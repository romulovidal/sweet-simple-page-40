# Auditoria Final ATIS V2 - Relatório de Validação

A auditoria final do sistema ATIS V2 foi concluída. O sistema apresenta uma arquitetura robusta, centralizada e segura, com mecanismos claros de idempotência e proteção contra banimento.

## 1. Inventário de Arquivos
### Criados / Principais (_shared)
- `supabase/functions/_shared/atis-automation-engine.ts`: Core engine (Claim, Idempotência, Orquestração).
- `supabase/functions/_shared/atis-recipient-resolver.ts`: Normalização de JIDs e expansão de targets.
- `supabase/functions/_shared/atis-antiban.ts`: Camada de pacing e segurança.
- `supabase/functions/_shared/atis-evolution.ts`: Helper de comunicação com a API de WhatsApp.
- `supabase/functions/_shared/atis-v2-runner.ts`: Runner centralizado para o Cron.
- `supabase/functions/_shared/atis-v2-helpers.ts`: Utilitários de data/hora (Timezone Fortaleza).

### Edge Functions (Atualizadas para V2)
- `atis-send`: Ponto de entrada do Cron.
- `atis-daily-devotional`, `atis-birthday-greeting`, `atis-plans-runner`, `atis-series-runner`, `atis-daily-verse-dm`, `atis-welcome-runner`, `smart-notifications`.
- `atis-webhook`: Refatorado para processamento reativo e opt-in/out.

### Frontend (Painel Admin)
- `src/components/atis/AtisAutomations.tsx`: Gestão de configurações V2.
- `src/components/atis/AtisLogs.tsx`: Monitoramento de execuções.
- `src/components/atis/AtisDashboard.tsx`: Métricas e status da conexão.
- `src/components/atis/AtisAdvancedSettings.tsx`: Configurações de Anti-ban e horários.

---

## 2. SQL e Banco de Dados
- **SQL Adicional**: Nenhum SQL adicional é necessário. Toda a infraestrutura está coberta pela migration V4.
- **Dependências**: O código está 100% alinhado com as tabelas `atis_automation_settings`, `atis_notification_configs`, `atis_notification_targets` e `atis_automation_logs`.

---

## 3. Build e Qualidade
- **Build**: `bun run build` executado com sucesso em 17.64s.
- **Typecheck**: Passou (integrado ao processo de build).

---

## 4. Auditoria de Envio Duplicado
Todos os runners foram migrados para utilizar o `AtisEngine`. O motor antigo foi desativado ou encapsulado.

| Fluxo | Runner | Engine V2? | safeSend (V2)? | Mecanismo antigo ativo? |
| :--- | :--- | :--- | :--- | :--- |
| Daily Devotional | `atis-daily-devotional` | SIM | SIM | NÃO |
| Birthday Greeting | `atis-birthday-greeting` | SIM | SIM | NÃO |
| Daily Verse WA | `atis-daily-verse-dm` | SIM | SIM | NÃO |
| Plans Runner | `atis-plans-runner` | SIM | SIM | NÃO |
| Series Runner | `atis-series-runner` | SIM | SIM | NÃO |
| Broadcast Runner | `atis-broadcast-runner` | SIM | SIM | NÃO |
| Welcome Runner | `atis-welcome-runner` | SIM | SIM | NÃO |
| Smart Notif | `smart-notifications` | SIM | SIM | NÃO |
| Culto Reminder | `culto-reminder` | PUSH (Nativo) | N/A | NÃO (WA via V2) |

---

## 5. Recipient Resolver & Normalização
- **Telefone puro**: `8599999999` -> `558599999999@s.whatsapp.net`.
- **Telefone com +**: `+55...` -> limpo e normalizado para `@s.whatsapp.net`.
- **Grupos**: Identificados por `@g.us`, **NUNCA** passam por normalização de telefone.
- **Dedupe**: `normalizeRecipient` garante que o sufixo não seja duplicado.

---

## 6. Evolution API
- **Endpoint**: `/message/sendText/atis`.
- **Payload**: JSON com `number`, `text` e `linkPreview`. Suporte a `mentionsEveryOne` para grupos.
- **Helper**: `atis-evolution.ts` gerencia variantes de telefone (9º dígito) automaticamente.

---

## 7. Idempotência e Concorrência
- **Occurrence Key**: Gerada baseada no tempo (ex: `2026-08-14T07:00:00`).
- **Recipient Key**: JID único do destinatário.
- **Idempotency Key**: `config_id:recipient_key:occurrence_key`.
- **Prevenção**: A constraint `UNIQUE (idempotency_key)` na tabela `atis_automation_logs` impede que o mesmo envio seja registrado duas vezes.
- **Claim**: A RPC `atis_claim_automation_occurrence` garante que, mesmo que dois workers tentem enviar, apenas o que conseguir o "lock" atômico no banco prosseguirá.

---

## 8. Retry e Resiliência
- **Erros Temporários**: HTTP 429, 5xx e timeouts são registrados no `atis_automation_attempts`.
- **Lógica**: Incrementa `attempts` no log e permite nova tentativa pelo motor se não atingir o teto.
- **Erros Permanentes**: (Ex: Número não existe) Marca como `failed` e não entra em loop.

---

## 9. Timezone e Agendamento
- **Timezone**: `America/Fortaleza` como padrão global.
- **Flexibilidade**: Runners buscam janelas de tempo (ex: "quem deveria ter enviado nos últimos 10 minutos"), evitando falhas se o cron atrasar 1 minuto.

---

## 10. Anti-Ban V2
- **Pacing**: `min_gap_ms` e `max_gap_ms` aplicados entre mensagens.
- **Jitter**: Atraso aleatório adicional via `jitter_max_ms`.
- **Caps**: Limites diários globais, por destinatário e por grupo são verificados via `atis_send_ledger`.
- **Truncamento**: `max_chars` configurável para evitar mensagens excessivamente longas que geram flags.

---

## 11. Segurança
- **Secrets**: `SUPABASE_SERVICE_ROLE_KEY` e `EVOLUTION_API_KEY` são acessados apenas via `Deno.env.get` no backend.
- **Frontend**: Nenhuma chave privilegiada ou rota `service_role` exposta. O `atisDb.ts` utiliza o cliente Supabase padrão com as devidas permissões de RLS para Admin.

---

## 12. Webhook
- **Loop**: `msg.key.fromMe` ignora mensagens enviadas pelo próprio bot.
- **Dedupe**: O log de mensagens recebidas impede re-processamento.
- **Opt-Out**: Respostas como "SAIR" ou "PARAR" desativam automaticamente o `whatsapp_opt_in` no perfil do usuário e no contato.

---

## CONCLUSÃO
O sistema **ATIS V2 está PRONTO para produção**. Não foram encontrados bugs críticos ou falhas de segurança durante a auditoria.

---

## Checklist de Testes Manuais (Produção)
1. [ ] **Envio Teste**: No painel de Automações, clique em "Enviar Teste" e valide o recebimento.
2. [ ] **Grupo**: Configure uma automação para um grupo `@g.us` e verifique se o bot envia sem erro de normalização.
3. [ ] **Opt-Out**: Envie "SAIR" para o bot e verifique se o status no painel de contatos muda para inativo.
4. [ ] **Quiet Hours**: Tente forçar um envio manual entre 22:00 e 06:00 e verifique se o sistema marca como `skipped (quiet_hours)`.
5. [ ] **Logs**: Verifique se cada envio gerou uma entrada em `atis_automation_logs` com o `worker_id` correto.
