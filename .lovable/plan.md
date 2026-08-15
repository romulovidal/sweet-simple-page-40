# Plano de Refatoração ATIS V2 — Painel Administrativo

Este plano visa alinhar o frontend do ATIS com o backend real no projeto `karyuuhxeismshhxuokg`, eliminando inconsistências e consolidando a arquitetura V2.

## Etapa 1: Sincronização de Componentes Legados (Devocional e Aniversário)
- **Arquivo:** `src/components/atis/AtisDailyDevotional.tsx` e `src/components/atis/AtisBirthdayAuto.tsx`.
- **Mudança:** Remover o gerenciamento local de grupos e utilizar a interface de `atis_notification_targets` por baixo dos panos (ou redirecionar o usuário para a aba de automações).
- **Objetivo:** Garantir que a fonte de verdade para alvos seja sempre a tabela `atis_notification_targets`.

## Etapa 2: Consolidação do AtisAutomations
- **Mudança:** Garantir que o salvamento de `metadata` em `AtisAutomations.tsx` não sobrescreva chaves essenciais do backend.
- **Melhoria:** Adicionar aviso visual claro quando uma automação `system:*` ou `legacy:*` está sendo editada, indicando que ela possui regras específicas no motor V2.

## Etapa 3: Auditoria de Disparo Manual
- **Mudança:** Revisar o botão "Enviar agora" nos componentes para garantir que eles chamem a Edge Function correta passando o `config_id` correto, permitindo que o log de execução seja registrado no histórico central.

## Etapa 4: Dashboard Centralizado
- **Mudança:** Atualizar `AtisDashboard.tsx` para buscar métricas de `atis_automation_logs` em vez de contar apenas mensagens brutas em `atis_messages_log`, refletindo melhor o status das automações.

## Etapa 5: Validação de Build e Tipagem
- Garantir que todas as alterações respeitem os tipos definidos no `atisDb` e `supabase/types.ts`.
