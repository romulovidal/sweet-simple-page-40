# Plano de Remoção de Dependência da LOVABLE_API_KEY

Este plano visa remover todas as dependências funcionais de runtime do Lovable Cloud, permitindo que o projeto funcione de forma totalmente independente no seu próprio Supabase.

## Ações Realizadas

### 1. Refatoração da Cadeia de Provedores de IA (`supabase/functions/_shared/ai-fetch.ts`)
- Remover o Lovable AI Gateway como fallback.
- Remover as funções `tryLovable` e `_legacyGeminiOnly`.
- Atualizar `aiChatFetch` para ignorar `LOVABLE_API_KEY`.
- Atualizar `hasAnyAiKey` para não considerar `LOVABLE_API_KEY`.

### 2. Substituição do Provedor de TTS (`supabase/functions/tts-verse/index.ts`)
- O app utiliza atualmente o gateway do Lovable para acessar o modelo `openai/gpt-4o-mini-tts`.
- Substituiremos pela chamada direta à API da OpenAI.
- **Novo Secret Requerido:** `OPENAI_API_KEY`.
- O frontend continuará recebendo o áudio em formato MP3 como esperado.

### 3. Limpeza de Referências em Edge Functions
- **`exegetai`**: Remover checagem de `LOVABLE_API_KEY`.
- **`generate-push-message`**: Remover referência no erro e na checagem.
- **`ai-tools`**: Remover checagem e referência.
- **`culto-reminder`**: Remover checagem.
- **`atis-daily-devotional`**: Remover checagem.
- **`atis-birthday-greeting`**: Remover checagem.
- **`atis-broadcast-runner`**: Remover checagem.
- **`atis-daily-verse-dm`**: Remover checagem.
- **`classify-cantico`**: Garantir uso exclusivo de provedores configurados.
- **`atis-send`**: Remover logging desnecessário se houver.
- **`atis-instance`**: Remover referências ao hostname do Lovable na geração da URL de Webhook (usar `SUPABASE_URL` do ambiente).

### 4. Limpeza no Frontend (`src/`)
- **`PrivacyPage.tsx`**: Atualizar texto sobre provedores de IA (remover menção ao Lovable AI Gateway).
- **`PushPermissionPrompt.tsx`** e **`pushNotifications.ts`**: Remover checagem de hostname `lovableproject.com`.
- **`AtisDashboard.tsx`** e **`AtisLayout.tsx`**: Remover fallback de URL para `biblia-atalaia.lovable.app`.
- **`HarpaPage.tsx`**: Remover referências residuais se houver.
- **`integrations/lovable/index.ts`**: Este arquivo é gerado pelo editor, mas como não usaremos o Auth do Lovable, as referências de runtime serão removidas.

### 5. Configuração do Ambiente
- **`vite.config.ts`**: Remover `lovable-tagger` (plugin exclusivo do editor).
- **`package.json`**: Remover `@lovable.dev/cloud-auth-js` e `lovable-tagger`.

## Detalhes Técnicos
- **Provedor TTS:** OpenAI Direct (API `https://api.openai.com/v1/audio/speech`).
- **Modelo:** `tts-1` (equivalente ao usado via gateway).
- **Secret:** `OPENAI_API_KEY`. Obtenha em [platform.openai.com](https://platform.openai.com/api-keys).

## Comandos para Configuração do Novo Supabase (`karyuuhxeismshhxuokg`)
```bash
# Definir nova chave da OpenAI para TTS
supabase secrets set OPENAI_API_KEY=sua_chave_aqui --project-ref karyuuhxeismshhxuokg

# Remover segredo antigo (opcional, por limpeza)
supabase secrets unset LOVABLE_API_KEY --project-ref karyuuhxeismshhxuokg
```

## Redeploy das Edge Functions Alteradas
```bash
supabase functions deploy _shared ai-tools atis-birthday-greeting atis-broadcast-runner atis-daily-devotional atis-daily-verse-dm atis-instance classify-cantico culto-reminder exegetai generate-push-message tts-verse --project-ref karyuuhxeismshhxuokg
```
