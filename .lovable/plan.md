# Plano de Reforma do Sistema ATIS e Notificações Centralizadas

O objetivo é transformar os diversos fluxos de mensagens (aniversários, devocionais, planos, séries, etc.) em um sistema centralizado, altamente configurável, com suporte robusto a grupos e prevenção de duplicidade.

## 1. Estrutura de Dados (Banco de Dados)

### Nova Tabela: `atis_notification_configs`
Centraliza as configurações de cada tipo de automação.
- `id`: uuid (primary key)
- `notification_type`: text (unique) - ex: 'devotional', 'birthday', 'verse', 'plan', 'series', 'culto', 'welcome'
- `enabled`: boolean
- `send_time`: time (HH:mm)
- `days_of_week`: int[] (0-6, onde 0 é domingo)
- `target_type`: text - 'all_contacts', 'all_profiles', 'specific_contacts', 'specific_profiles', 'all_groups', 'specific_groups', 'mixed'
- `target_ids`: uuid[] or text[] - IDs de contatos, perfis ou wa_group_ids
- `message_template`: text - Suporta placeholders como {nome}, {versiculo}, etc.
- `use_ai`: boolean
- `ai_prompt`: text (opcional)
- `retry_max`: int (default 3)
- `metadata`: jsonb - Configurações específicas (ex: include_reflection para versículo)
- `updated_at`: timestamptz

### Nova Tabela: `atis_automation_logs`
Histórico detalhado e controle de idempotência.
- `id`: uuid (primary key)
- `config_id`: uuid (references atis_notification_configs)
- `recipient_key`: text (wa_group_id ou phone formatado)
- `scheduled_date`: date
- `status`: text - 'pending', 'sent', 'failed', 'skipped'
- `attempts`: int
- `last_error`: text
- `external_id`: text (ID da mensagem na Evolution API)
- `created_at`: timestamptz
- `sent_at`: timestamptz

## 2. Refatoração do Backend (Edge Functions)

### Helper Centralizado: `_shared/atis-recipient-resolver.ts`
Unifica a lógica de "quem deve receber".
- Normalização de JIDs (@s.whatsapp.net para indivíduos, @g.us para grupos).
- Diferenciação entre números brutos, contatos do banco e perfis de usuários.
- Resolução de grupos baseada na tabela `atis_groups`.

### Helper de Idempotência: `_shared/atis-automation-helper.ts`
- Função `shouldSendToday(config, recipient)`: Verifica se já houve envio bem-sucedido ou se está em retry.
- Função `markAsSent(config, recipient, result)`: Registra o sucesso.
- Respeito ao "Horário Silencioso" configurado globalmente no `atis_antiban`.

### Atualização dos Runners
- `atis-daily-devotional`, `atis-birthday-greeting`, `atis-daily-verse-dm`:
  - Deixam de ler `admin_settings` diretamente com chaves hardcoded.
  - Passam a buscar a configuração em `atis_notification_configs`.
  - Usam o `safeSend` atualizado para garantir anti-ban e logs.

## 3. Painel Administrativo (Frontend)

### Nova Tela: `AtisAutomations.tsx`
- Interface de cartões para cada tipo de automação.
- Seleção visual de dias da semana.
- Seletor de grupos integrado (usando os grupos já importados).
- Editor de template com pré-visualização de placeholders.

### Melhoria em `AtisGroups.tsx`
- Sincronização de nomes de grupos da Evolution API para facilitar a identificação no seletor de destinos.

## 4. Cron Jobs
- Manutenção dos cron jobs existentes (que rodam a cada 1-5 minutos).
- Os scripts agora consultam `atis_notification_configs` e a tabela de logs para decidir se é o momento exato de disparar.

## Detalhes Técnicos de Implementação
- **Normalização de Grupos**: Garantir que o ID do grupo seja tratado literalmente (terminando em `@g.us`) e nunca passe por funções de limpeza de telefone.
- **Retry Exponencial**: Implementar um atraso crescente entre tentativas de falhas temporárias (HTTP 429/500).
- **Timezone**: Uso rigoroso de `America/Fortaleza` em todos os cálculos de "agora".
