# Plano de Reforma do Sistema ATIS V2

Implementação de um motor de automação centralizado, resiliente e idempotente, permitindo múltiplas configurações por tipo, suporte a grupos e gerenciamento avançado de destinatários.

## 1. Infraestrutura de Banco de Dados (SQL)

### Configurações Globais e Automações
- **`atis_automation_settings`**: Tabela única para configurações do motor (timezone padrão, limites globais, horário silencioso).
- **`atis_notification_configs`**: Definição das automações. Permite múltiplos registros do mesmo `notification_type`. Inclui `automation_mode` (automatic/manual), `send_times` (array de horários) e suporte a IA.
- **`atis_notification_targets`**: Tabela normalizada para destinatários (contatos, perfis, grupos @g.us, tags). Resolve o problema de tipos complexos no PostgreSQL.

### Controle e Idempotência
- **`atis_automation_logs`**: Registro atômico de cada tentativa de envio.
- **`idempotency_key`**: Constraint única composta por `config_id` + `recipient_key` + `scheduled_for`. Garante que nenhum runner duplicado envie a mesma mensagem.
- **Estados**: `scheduled`, `pending`, `processing`, `sent`, `failed`, `skipped`, `retrying`, `postponed`.

## 2. Refatoração do Backend (Edge Functions)

### Shared Helpers
- **`atis-recipient-resolver.ts`**: Lógica unificada para normalizar JIDs e expandir grupos/tags em listas de destinatários individuais ou JIDs de grupo.
- **`atis-automation-engine.ts`**: O "coração" que verifica o que está vencido, faz o claim atômico no banco, processa templates (com placeholders e IA) e invoca o `safeSend`.

### Runners
- Revisão completa de todos os runners (`daily-devotional`, `birthday-greeting`, `daily-verse-dm`, `broadcast`, `series`, `plans`, `welcome`, `culto-reminder`, `daily-verse-push`, `smart-notifications`).
- Migração gradual para o novo motor, preservando regras de negócio específicas de cada fluxo (ex: planos de leitura mantêm seu progresso individual).

## 3. Painel Administrativo (Frontend)

- **`AtisAutomations.tsx`**: Nova tela central para CRUD de automações.
- **`AtisAutomationLogs.tsx`**: Visualização detalhada de histórico com filtros e diagnóstico da Evolution API.
- **Ações de Teste**: Botão "Enviar teste" para validar configurações sem disparar para toda a base.

## 4. Estratégia de Migração e Backfill
- O script SQL incluirá a extração de dados atuais de `admin_settings` para popular as novas tabelas, garantindo que as configurações de horários e templates do usuário sejam preservadas.
- Inclusão de `INSERT ... ON CONFLICT` para seeds iniciais.

## Conteúdo Técnico
- SQL consolidado em `migration/atis-notifications-v2.sql`.
- Uso rigoroso de `America/Fortaleza` como fallback de timezone.
- Centralização de normalização de JIDs (impedindo `@s.whatsapp.net` duplo).
