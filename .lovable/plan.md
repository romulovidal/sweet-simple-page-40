# Homologação ATIS V2 - Etapa 6

Executando a homologação técnica do motor ATIS V2. Este plano segue o roteiro de 30 testes para validar a prontidão para produção.

## 1. Auditoria de Monitoramento (Realtime vs Polling)
- **Status**: Analisado `AtisLogs.tsx`.
- **Estratégia**: Atualmente utiliza **Refresh Manual** (botão de atualizar) e carregamento inicial via `useEffect`. Não há Supabase Realtime implementado no frontend para logs.
- **Veredito**: PASS (estratégia conservadora e segura).

## 2. Pre-Check do Ambiente
- **Ambiente**: Lovable Cloud (Supabase `hvdmobypsqksgkfrzhzf`).
- **Valores Originais (Referência)**:
    - `global_enabled`: true
    - `timezone`: America/Fortaleza
    - `quiet_hours_enabled`: true (22:00 - 07:00)
    - `retry_max`: 3
    - `atis_automation_logs`: Acessível (Read-only)

## 3. Roteiro de Testes (Resumo)
- **T01 - Automação Personalizada**: Validar criação via `AtisAutomations.tsx` (slug: `custom:hml_test_*`).
- **T02 - Ciclo de Sucesso**: Monitorar transição de estados no banco.
- **T03 - Idempotência**: Verificar `idempotency_key` via `atis_automation_logs`.
- **T06 - Group JID**: Confirmar preservação de `@g.us` no formulário e banco.
- **T22 - Sanitização**: Validar mascaramento recursivo em `AtisLogDetails.tsx`.
- **T30 - Auditoria de Escrita**: Confirmar que o frontend não possui `atisDb.from('atis_automation_logs').insert/update`.

## 4. Relatório Final
Ao final, apresentarei a tabela PASS/FAIL/BLOCKED para cada um dos 30 itens.
