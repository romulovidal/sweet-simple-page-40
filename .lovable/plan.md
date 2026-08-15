# Plano de Estabilização de Notificações Push Nativas

Auditoria identificou que o sistema de Web Push está configurado, mas carece de logs e resiliência para diagnóstico de falhas no pipeline de entrega (FCM/Apple).

## Ações Técnicas

### 1. Diagnóstico e Observabilidade (Edge Functions)
- **send-push**: Adicionar logs detalhados para cada tentativa de envio via `webpush.sendNotification`, capturando erros específicos dos provedores (endpoint).
- **daily-verse-push**: Adicionar logs no processamento da fila e na chamada interna ao `send-push`.

### 2. Correção de Lógica de Horários
- Garantir que a `daily-verse-push` considere o fuso horário de Brasília (UTC-3) corretamente, pois o `pg_cron` roda em UTC.
- Validar se a busca por versículos agendados (`daily_verse_queue`) está filtrando corretamente pela data local.

### 3. Melhoria no Frontend Administrativo
- **AdminPushSender**: Exibir erros detalhados retornados pela Edge Function em vez de uma mensagem genérica de erro.
- **AdminDailyVerse**: Melhorar o feedback visual ao "Reenviar Versículo", mostrando se o problema foi a falta de versículo na fila ou erro na entrega.

### 4. Validação do Pipeline
- Executar disparo de teste manual via console para verificar se as chaves VAPID estão sendo aceitas pelos navegadores registrados.

## Detalhes Técnicos
- O banco possui 31 inscrições ativas.
- O histórico (`push_log`) mostra sucessos recentes, indicando que o pipeline básico funciona, mas falhas individuais (1-2 por envio) precisam ser mapeadas.
