# Plano de Refatoração Definitiva do Painel Administrativo ATIS

Este plano visa alinhar 100% o frontend administrativo do ATIS com a arquitetura backend V2, garantindo consistência, integridade de dados e eliminação de fluxos legados redundantes.

## 1. Padronização do Motor V2 (Automations & Groups)
- **AtisAutomations.tsx**: 
    - Corrigir o salvamento de `metadata` para garantir que o motor global do backend receba as configurações específicas de cada automação (ex: prompts de IA, configurações de retry).
    - Validar o fluxo de `atis_notification_targets` para que a adição/remoção de destinatários seja atômica.
- **AtisGroups.tsx**:
    - Garantir que `notification_times` e `notification_types` sejam salvos corretamente como JSON no banco, respeitando o contrato esperado pelas Edge Functions.
    - Unificar a listagem de tipos de notificação com as chaves reais utilizadas no backend.

## 2. Refatoração de Componentes "Sistema" (Legados)
- **AtisDailyDevotional.tsx** & **AtisBirthdayAuto.tsx**:
    - Remover a lógica de gestão local de grupos. Estes componentes passarão a ser atalhos de configuração para as automações `legacy:atis_daily_devotional` e `legacy:atis_birthday_greeting`.
    - Redirecionar a gestão de "quem recebe" para a aba de Automações V2 (Targets), mantendo na UI apenas o switch de habilitar/desabilitar e o horário.

## 3. Sincronização de Status e Logs
- **AtisLogs.tsx** & **AtisLogDetails.tsx**:
    - Garantir que todos os status do runner (`processing`, `retrying`, `skipped`, etc.) sejam visualmente mapeados e detalhados.
    - Sanitização rigorosa de secrets nos payloads de log para evitar vazamento de chaves de API.
- **AtisDashboard.tsx**:
    - Atualizar métricas para refletir o estado das tabelas V2 (`atis_automation_logs` em vez de lógicas dispersas).

## 4. Segurança e Permissões
- Reforçar o uso de `useIsAdmin` em todas as rotas de mutação.
- Garantir que campos de identidade e chaves de sistema (`source_key`) permaneçam bloqueados para edição manual, evitando quebra da integração com o cron.

## Detalhes Técnicos
- Uso extensivo de `atisDb` para centralizar o acesso ao Supabase.
- Migração de lógicas de "Send Now" para invocar as Edge Functions corretas com parâmetros de override (ex: `force: true`).
- Padronização de datas para o timezone "America/Fortaleza" em toda a interface.
