---
name: Etapa 6 - Homologação ATIS V2
description: Roteiro técnico de homologação e auditoria pré-produção do motor ATIS V2.
type: feature
---
# Etapa 6: Homologação ATIS V2

Este plano detalha a execução dos 30 testes de homologação para o motor ATIS V2, focando em segurança, idempotência e integridade configuracional.

## Snapshot das Configurações Originais (ID: 1)
- **global_enabled**: false
- **timezone**: America/Fortaleza
- **quiet_hours_enabled**: true
- **quiet_hours_start**: 22:00:00
- **quiet_hours_end**: 04:00:00
- **daily_global_cap**: 250
- **daily_recipient_cap**: 3
- **daily_group_cap**: 3
- **hourly_cap**: 20
- **max_messages_per_minute**: 20
- **min_gap_ms**: 12000
- **max_gap_ms**: 45000
- **jitter_max_ms**: 9000
- **retry_max**: 3
- **retry_interval_minutes**: 15

## Mecanismo de Idempotência Identificado
- **Tabela**: `atis_automation_logs`
- **Coluna**: `idempotency_key` (UNIQUE)
- **Fórmula**: `${config.id}:${recipient.recipientKey}:${occurrenceKey}`
- **Claim Atômico**: Função RPC `atis_claim_automation_occurrence` que utiliza `FOR UPDATE` implícito (via RLS/SQL) e transições de status (`scheduled/pending/retrying` -> `processing`) com lease de 5 minutos.

## Roteiro de Testes (T01-T30)

### Homologação Estrutural e Funcional
- **T01-T08**: Validação de Automações e Targets (Profile, Contact, JIDs, Tags).
- **T10-T16**: Validação do Motor (Quiet Hours, Caps, Delay, Retry, Failed, Skipped).
- **T17-T20**: Validação de Registros de Sistema (Split-brain, Sentinelas 00:00).
- **T21-T25**: Auditoria Técnica (Logs, Sanitização, Status, Mobile, Concorrência).
- **T26-T30**: Validação Final (Reload, Global Switch, Auditoria Read-only).

## Regras de Execução
- Testes dinâmicos só recebem PASS se o comportamento for efetivamente observado no banco/logs.
- Testes de JID comparam valores literais: Original -> Banco -> Log.
- Restauração garantida de todas as configurações alteradas.
- Gate final: Aprovado ou Não Aprovado para Produção.
