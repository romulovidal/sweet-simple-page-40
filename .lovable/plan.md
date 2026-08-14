# Plano: Etapa 2 — Gestão de Automações ATIS V2

Este plano visa finalizar a interface de gerenciamento de automações (`atis_notification_configs`), implementando proteções rigorosas para automações de sistema e permitindo a criação/edição segura de automações personalizadas.

## Mudanças Técnicas

### 1. Auditoria e Tipagem
- Identificar schema real de `atis_notification_configs` (baseado na migration e types encontrados):
    - `id` (uuid)
    - `source_key` (text, UNIQUE) — Este é o nosso "source" para identificação de sistema.
    - `name` (text)
    - `notification_type` (text)
    - `enabled` (boolean)
    - `automation_mode` (text: 'automatic', 'manual')
    - `send_times` (time[])
    - `timezone` (text)
    - `days_of_week` (integer[])
    - `message_template` (text)
    - `use_ai` (boolean)
    - `ai_prompt` (text)
    - `retry_enabled` (boolean)
    - `retry_max` (integer)
    - `delay_between_messages_ms` (integer)
    - `metadata` (jsonb)
- Atualizar a tipagem `Automation` em `AtisAutomations.tsx` para refletir esses campos.

### 2. Componente de Listagem (AtisAutomations.tsx)
- Implementar badges dinâmicos:
    - **Sistema**: Se `source_key` começar com `system:`.
    - **Personalizada**: Caso contrário.
- Exclusão Protegida:
    - Ocultar botão de exclusão para registros `system:*`.
    - Adicionar verificação no handler de delete para bloquear operações em registros protegidos.
- Edição de Sistema:
    - Bloquear alteração de `source_key` e `notification_type`.
    - Bloquear campos técnicos identificados como "sentinela" (ex: horários específicos dependendo do tipo).
    - Manter campos administrativos editáveis (ex: `enabled`, `send_times` para a maioria, `message_template`, `use_ai`).

### 3. Formulário de Edição/Criação
- Criar um diálogo de formulário unificado (usando `Dialog` do shadcn/ui).
- Suporte a múltiplos horários (`send_times` como array de strings "HH:mm").
- Interface amigável para `days_of_week` (0-6).
- Preservação de dados:
    - Usar `update` parcial no Supabase.
    - Carregar o objeto `metadata` existente e mesclar apenas chaves alteradas.
    - **Crítico**: Manter `atis_notification_targets` intactos (não mexer neles nesta etapa, apenas garantir que não sejam apagados por falta de campo no formulário).

### 4. Proteção de Dados (Targets e JSON)
- Garantir que nenhum JID (ex: `@g.us`) seja alterado ou normalizado.
- Preservar chaves desconhecidas em objetos JSONB.

## Cenários de Validação (A-F)
- **Cenário A (Sistema)**: Editar `enabled` em `system:welcome` e salvar. Verificar se `source_key` e `notification_type` não mudaram.
- **Cenário B (Exclusão)**: Tentar chamar delete em um ID de sistema via console/inspeção e validar erro amigável.
- **Cenário C (Personalizada)**: Criar nova automação "Aviso de Reunião" e testar fluxo completo.
- **Cenário D (Horário Técnico)**: Validar se `00:00` é preservado em registros de `broadcasts` ou `welcome`.
- **Cenário E (JID)**: Simular salvamento em registro que possua targets vinculados (via DB) e garantir que a relação não quebrou.
- **Cenário F (JSON)**: Adicionar chave manual no `metadata` via backend e salvar via frontend. Chave deve permanecer.

## Observações
- A timezone padrão será sempre "America/Fortaleza".
- Não haverá migração de dados das tabelas legadas nesta etapa (consolidação futura).
