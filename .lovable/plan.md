# Plano de Implementação - Etapa 4: Logs e Monitoramento ATIS V2

Implementação de uma interface de observabilidade para o motor ATIS V2, permitindo o acompanhamento em tempo real (sob demanda) das execuções, falhas e agendamentos.

## User Review Required

> [!IMPORTANT]
> A interface será estritamente de **leitura**. Nenhuma ação de escrita (reenviar, deletar, editar) será implementada nesta etapa para garantir a integridade do motor de automação.

## Detalhes Técnicos

### 1. Auditoria de Dados
- **Tabela Principal**: `atis_automation_logs`
- **Campos Operacionais**: `status`, `recipient_key`, `scheduled_for`, `attempts`, `last_error`, `processed_at`, `next_retry_at`.
- **Relacionamentos**: Join com `atis_notification_configs` para exibir o nome amigável da automação.
- **Histórico de Tentativas**: Visualização da tabela `atis_automation_attempts` nos detalhes do log (quando disponível).

### 2. Status e Identidade Visual
Mapeamento de status para labels em Português e badges coloridas:
- `scheduled`: Agendado (Cinza/Amarelo)
- `pending`: Pendente (Azul claro)
- `processing`: Processando (Azul com spinner)
- `retrying`: Tentando novamente (Laranja)
- `sent`: Enviado (Verde)
- `failed`: Falhou (Vermelho)
- `skipped`: Ignorado (Roxo/Cinza)

### 3. Funcionalidades da Interface
- **Filtros Avançados**: Por status, automação (source_key) e período temporal.
- **Paginação Server-side**: 25 registros por página para performance.
- **Sanitização de Segurança**: Payloads nos detalhes do log terão chaves sensíveis (`token`, `secret`, `api_key`) mascaradas.
- **Resolução de JIDs**: Preservação total de identificadores de grupo (`@g.us`) e individuais (`@s.whatsapp.net`).
- **Timezone**: Exibição ajustada para `America/Fortaleza`.

### 4. Componentes
- `AtisLogs.tsx`: Refatoração da tabela principal.
- `AtisLogDetails.tsx`: Diálogo para inspeção técnica profunda de um registro específico.
- `atisLogDb.ts`: Helper de acesso a dados para logs e tentativas.

## Métricas de Sucesso
- Carregamento instantâneo via paginação.
- Identificação clara do motivo de "Skipped" ou "Failed".
- Mobile friendly (uso de cards em telas pequenas).
