## Objetivo
Conectar o Painel Atis à sua instância Evolution API no Railway, criar as edge functions de envio e recebimento de mensagens do WhatsApp e deixar tudo pronto pra escanear o QR Code.

## Credenciais recebidas
- URL: `https://evolution-api-production-f172b.up.railway.app`
- KEY: `atalaia_7K9mP2xQ8vN4wR6tY3uH5jL1sD0fG`

## O que vai ser feito

### 1. Salvar credenciais como secrets do backend
- `EVOLUTION_API_URL` = URL acima
- `EVOLUTION_API_KEY` = KEY acima
- `ATIS_WEBHOOK_SECRET` = gerado automático (protege o webhook contra chamadas falsas)

### 2. Criar 3 edge functions

- **`atis-instance`** — cria/verifica a instância "atis" na Evolution e retorna o **QR Code** pra você escanear no WhatsApp. Também mostra status (connected/disconnected).
- **`atis-send`** — envia mensagem de texto pra um número ou grupo. Vai ser usado pelos broadcasts, aniversariantes, estudos e testes manuais.
- **`atis-webhook`** — recebe as mensagens do WhatsApp que chegam na Evolution, aplica as regras do `atis_config` (bot ativo, "só quando mencionado", palavras-gatilho, comandos habilitados), e responde. Grava tudo em `atis_messages_log`.

### 3. Atualizar o painel Atis (frontend)
- **Dashboard**: trocar o card "Evolution offline" por status real (chama `atis-instance` e mostra connected/disconnected + botão "Ver QR Code").
- **Config**: botão "Testar conexão" e botão "Conectar WhatsApp" (abre modal com o QR Code).
- **Contatos/Grupos**: botão "Enviar teste" que chama `atis-send`.
- **Broadcasts**: botão "Enviar agora" além do agendamento.

### 4. Configurar o webhook na Evolution
Depois que as functions subirem, eu te passo **1 URL única** pra colar no Railway (variável `WEBHOOK_GLOBAL_URL`) ou no painel da Evolution. Só isso — nada de terminal, nada de curl.

### 5. Passo final manual (só você pode fazer)
Escanear o QR Code no WhatsApp do número que vai ser o Atis:
- WhatsApp → Configurações → Aparelhos conectados → Conectar aparelho → apontar câmera pro QR que vai aparecer no painel.

## Detalhes técnicos
- Todas as functions usam `verify_jwt = false` no config só quando necessário (webhook precisa ser público; as outras exigem admin logado).
- Autenticação da Evolution: header `apikey: <EVOLUTION_API_KEY>` em todas as chamadas.
- Webhook validado por header `x-webhook-secret` contra `ATIS_WEBHOOK_SECRET`.
- Rate limit reaproveitando `supabase/functions/_shared/rate-limit.ts`.
- Logs de erro vão pro `atis_messages_log` com `status='error'` pra você ver no painel de Logs.

## O que fica pra depois (não entra agora)
- Cron de aniversariantes automáticos (depende do WhatsApp já estar conectado).
- Cron de estudos ministeriais.
- Integração de push do app com respostas do bot.

Aprova pra eu implementar?