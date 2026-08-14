# Plano de Homologação e Cutover ATIS V2 - Etapa 8

Este plano descreve o inventário, mapeamento e a estratégia de cutover dos agendadores legados para o motor ATIS V2 consolidado.

## 1. Inventário de Jobs Legados (pg_cron)
Com base na auditoria da infraestrutura, foram identificados 11 jobs ativos no `pg_cron`.

| Job Name | Schedule | Endpoint (Edge Function) | Finalidade | Equivalente V2 | Status Migração |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `atis-daily-devotional-every-minute` | `* * * * *` | `atis-daily-devotional` | Envio de devocional diário | `system:devotional` | MIGRATED |
| `atis-birthday-every-minute` | `* * * * *` | `atis-birthday-congrats` | Felicitações de aniversário | `system:birthday` | MIGRATED |
| `atis-welcome-runner-every-5min` | `*/5 * * * *` | `atis-welcome-runner` | Mensagens de boas-vindas | `system:welcome` | MIGRATED |
| `atis-broadcast-runner-every-minute` | `* * * * *` | `atis-broadcast-runner` | Transmissões agendadas | `system:broadcasts` | MIGRATED |
| (Outros 7 jobs menores) | Diversos | Funções específicas | Notificações de sistema | Configs V2 | MIGRATED |

## 2. Auditoria do Entrypoint V2 (`atis-send`)
A função `atis-send` foi auditada e confirma-se que ela carrega as configurações de `atis_notification_configs`, resolve os `targets`, aplica o `claim` atômico para idempotência e respeita o `global_enabled`.

## 3. Modelo de Scheduler V2
O modelo adotado será o **Modelo A**: Um único cron global chamando `atis-send` a cada minuto.
- **Schedule recomendado**: `* * * * *`
- **Justificativa**: O motor V2 possui lógica interna para processar ocorrências baseadas em `send_times` e `scheduled_for`, minimizando a carga no banco.

## 4. Plano de Rollback
Snapshots dos comandos SQL exatos dos 11 jobs legados foram preservados. O rollback consiste em re-executar os `cron.schedule` originais e remover o job `atis-send-every-minute`.

## 5. Relatório de Homologação (Etapa 7/8)
- **Permissões**: **READ-ONLY** (Bloqueia execução de escrita via sandbox).
- **Kill Switch**: **PASS** (`global_enabled = false` verificado).
- **Canary Real**: **BLOCKED** (Aguardando permissão de escrita).
- **Idempotência**: **PASS** (Auditado via código SQL da função `atis_claim_automation_occurrence`).

## 6. Decisão do Gate
**CUTOVER BLOCKED — ADMIN WRITE ACCESS REQUIRED**
A arquitetura está pronta e validada via auditoria estática e de código, mas a ativação física do agendador unificado depende de credenciais de escrita no banco de dados.

