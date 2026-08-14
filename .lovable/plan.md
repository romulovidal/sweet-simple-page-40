# Plano: Finalização do Frontend Administrativo ATIS V2

Finalizar a interface administrativa do ATIS V2 para gerenciar automações, logs e configurações globais, utilizando a infraestrutura de backend já existente.

## User Review Required

> [!IMPORTANT]
> - O frontend consumirá as tabelas `atis_notification_configs`, `atis_automation_logs` e `atis_automation_settings`.
> - Automações de sistema (ex: `system:welcome`, `system:broadcasts`) terão proteções visuais para evitar exclusão ou edições que quebrem a semântica técnica (como horários sentinela `00:00`).

## Proposed Changes

### 1. Auditoria e Saneamento
- Analisar os componentes existentes em `src/components/atis/` para reaproveitar lógica.
- Remover telas duplicadas e centralizar a navegação no `AtisLayout`.

### 2. Gestão de Automações (`AtisAutomations.tsx`)
- Implementar listagem completa baseada em `atis_notification_configs`.
- Adicionar suporte a badges "Sistema" para registros protegidos.
- Criar formulário de criação/edição com suporte a:
  - Seleção de dias da semana (0-6).
  - Timepicker para horários.
  - Configuração de IA e Destinatários (targets).
  - Validação para não permitir exclusão de automações de sistema.

### 3. Gestão de Destinatários
- Criar seletor amigável para os tipos suportados: `profile`, `contact`, `group`, `tag`, `jid_individual`, `all_authenticated`.
- Garantir que IDs de grupos (`@g.us`) sejam preservados sem normalização para telefone.

### 4. Configurações Globais (`AtisConfig.tsx` / `AtisAdvancedSettings.tsx`)
- Unificar ou ajustar os componentes para consumir `atis_automation_settings`.
- Mapear campos como `global_enabled`, `quiet_hours`, `anti-ban caps` com labels amigáveis em português.
- Adicionar aviso explicativo sobre o funcionamento do Horário Silencioso (reagendamento automático).

### 5. Logs e Monitoramento (`AtisLogs.tsx`)
- Exibir tabela detalhada de `atis_automation_logs`.
- Incluir status com badges coloridos: `scheduled`, `pending`, `processing`, `retrying`, `sent`, `failed`, `skipped`.

## Technical Details

- **Database**: Uso exclusivo de `atisDb` (helper atual) para interagir com o Supabase.
- **Componentes**: Reaproveitamento de `shadcn/ui` (Dialogs, Tabs, Select, Switch, etc).
- **Timezone**: Padrão `America/Fortaleza` em conformidade com o backend.
- **Segurança**: Verificação de role `admin` já implementada em `AtisPage.tsx`.

