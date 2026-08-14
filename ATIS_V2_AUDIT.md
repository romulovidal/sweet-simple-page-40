# Auditoria Final ATIS V2 - Relatório de Validação (Corrigido V2.3)

A auditoria de saneamento final V2.3 foi concluída. Foram corrigidos os pontos bloqueadores de agendamento, idempotência em Quiet Hours e tipagem.

---

## 1. QUEM EXECUTA ATIS-SEND AUTOMATICAMENTE?
- **Evidência**: No ambiente Supabase/Lovable Cloud, o agendamento é feito via extensão `pg_cron`.
- **Caminho Real**:
    - O arquivo `migration/migrate.sql` contém a definição de **11 cron jobs**.
    - Cada cron job (ex: `atis-daily-devotional-every-minute`) roda a cada minuto (`* * * * *`).
    - Ele chama `private.edge_call('NOME_DA_FUNCTION', ...)`.
- **Entrypoint Unificado**: O `atis-send` foi criado para ser o novo entrypoint global, mas os crons existentes ainda apontam para runners individuais.
- **Resultado**: 
    - **A. Existe cron chamando atis-send?** NÃO nos scripts de migração atuais (eles chamam os runners individuais).
    - **B. Existe Edge Function cronada que chama runAtisAutomations globalmente?** SIM, a `atis-send`, mas ela não está no `migrate.sql` como um cron job ativo ainda.
    - **C. Scheduler Externo?** Não. O motor depende do `pg_cron` do Supabase.
- **D. NOVA automação sem runner legado?** Atualmente, se um admin criar uma automação de um tipo que não tem um runner legado (ex: `atis-daily-devotional`), ela **NÃO será executada** a menos que o cron do `atis-send` seja ativado ou um runner existente seja modificado para chamar o global.
- **AÇÃO**: Recomenda-se adicionar o job do `atis-send` ao `pg_cron` para garantir que qualquer configuração manual no painel seja processada.

## 1.1 SYSTEM:CULTO (WhatsApp)
- **Status**: Atualmente o WhatsApp de culto depende da configuração `system:culto`. 
- **Problema**: O runner `culto-reminder` foca em PUSH. O WhatsApp de culto **não tem um cron job legado dedicado** no `migrate.sql` que use o motor V2 para WhatsApp.
- **Solução**: Ativar o cron do `atis-send` (unificado) é a única forma de fazer o WhatsApp de culto (V2) funcionar automaticamente sem criar novos runners.

## 1.2 AUTOMAÇÕES CRIADAS PELO ADMIN
- **Fluxo 10:37**:
    1. Cron `atis-send` (se ativo) ou runner legado executa a cada minuto.
    2. `atis-v2-runner.ts` (runAtisAutomations) busca `atis_notification_configs` onde `send_times` contém "10:37" (janela de 10 min).
    3. `AtisEngine.runConfig` encontra a config.
    4. `processRecipient` cria/upserta entrada em `atis_automation_logs` com `occurrence_key` baseada no horário.
    5. `atis_claim_automation_occurrence` faz o lock atômico.
    6. `safeSend` envia via Evolution API.

## 1.3 SMART NOTIFICATIONS
- **Status**: O runner `smart-notifications` agora usa `engine.runConfig(config.id)`.
- **Horário**: Ele respeita o horário definido no banco de dados (`atis_notification_configs.send_times`) porque o `runAtisAutomations` filtra pelo tempo atual, não pelo momento do disparo do cron.

## 2. QUIET HOURS (PROVA DE NÃO PERDA)
- **Correção Aplicada**: Modificado `atis-automation-engine.ts` para que, se um envio automático falhar por `quiet_hours`, o status seja alterado para `retrying` e `next_retry_at` seja definido para o horário de término do silêncio (ex: 07:00 do dia seguinte).
- **Garantia**: A ocorrência permanece no banco, com a mesma chave, aguardando o próximo processamento do worker.

## 3. BROADCAST
- **Assinatura**: `runConfig(configId: string | null, occurrenceKey?: string)`.
- **Correção**: Removido `null as any` e tipado corretamente. Broadcast manual gera sua própria `occurrence_key` (o ID do broadcast) e passa pelo mesmo fluxo de claim e safeSend.

---

## CONCLUSÃO FINAL

**PRONTO PARA TESTES MANUAIS DE PRODUÇÃO** (Após aplicação manual do SQL de Cron para atis-send)

**Resultados de Validação:**
1. **Build**: Sucesso.
2. **TSC**: Sucesso (Zero erros de tipo).
3. **Quiet Hours**: Proteção de retentativa implementada.

**Nota para o Admin**: Para que automações manuais criadas no painel funcionem, é necessário agendar a função `atis-send` no `pg_cron` para rodar a cada minuto.
