# Plan - Removal of Lovable Dependencies

Migration of AI services to direct providers and cleanup of Lovable-specific integrations after migrating to a self-managed Supabase instance.

## Proposed Changes

### 1. TTS Migration (Edge Function)
- **File**: `supabase/functions/tts-verse/index.ts`
- **Action**: Replace `LOVABLE_API_KEY` with `OPENAI_API_KEY`.
- **Action**: Change the upstream URL to `https://api.openai.com/v1/audio/speech`.
- **Action**: Ensure the model is set to `gpt-4o-mini-tts` (preserving current behavior).
- **Action**: Maintain the same MP3 output and Brazilian Portuguese instructions.

### 2. AI Chain Cleanup (Shared Helper)
- **File**: `supabase/functions/_shared/ai-fetch.ts`
- **Action**: Remove `LOVABLE_URL` and `LOVABLE_API_KEY` from the provider chain.
- **Action**: Update `hasAnyAiKey` and `aiChatFetch` to only consider Groq, xAI, and Gemini.

### 3. Webhook URL Dynamic Construction
- **File**: `supabase/functions/atis-instance/index.ts`
- **Action**: Ensure `webhookUrl` is derived only from `SUPABASE_URL`.
- **Action**: Remove any hardcoded references or fallbacks to Lovable domains.

### 4. Integration & Package Cleanup
- **File**: `package.json` & `vite.config.ts`
- **Action**: Remove `lovable-tagger` (dev tool).
- **Action**: Remove `@lovable.dev/cloud-auth-js` after verifying `supabase/client.ts` uses standard `@supabase/supabase-js`.
- **File**: `src/integrations/lovable/index.ts`
- **Action**: Delete this file as it is a wrapper for the cloud-auth-js and is not used in the project's runtime (auth uses standard Supabase).

### 5. UI & Content Updates
- **File**: `src/pages/PrivacyPage.tsx`
- **Action**: Update text to mention direct provider integrations instead of "Lovable AI Gateway".
- **File**: `src/components/atis/AtisDashboard.tsx` & `AtisLayout.tsx`
- **Action**: Remove `biblia-atalaia.lovable.app` hostname checks/fallbacks used for assets.
- **File**: `src/lib/pushNotifications.ts` & `src/components/PushPermissionPrompt.tsx`
- **Action**: Clean up mentions of Lovable environment if they are just fallbacks.

## Technical Details
- **Redeploy List**: The following Edge Functions must be redeployed because they import `_shared/ai-fetch.ts`:
  - `ai-tools`
  - `atis-birthday-greeting`
  - `atis-broadcast-runner`
  - `atis-daily-devotional`
  - `atis-daily-verse-dm`
  - `atis-series-runner`
  - `atis-webhook`
  - `classify-cantico`
  - `culto-reminder`
  - `exegetai`
  - `generate-push-message`
  - `smart-notifications`
- **Deploy Command**: `supabase functions deploy ai-tools atis-birthday-greeting atis-broadcast-runner atis-daily-devotional atis-daily-verse-dm atis-series-runner atis-webhook classify-cantico culto-reminder exegetai generate-push-message smart-notifications tts-verse atis-instance`

## Verification Plan
- [ ] Run `npm run build` to ensure no package removal broke the frontend.
- [ ] Run a global search for `LOVABLE_API_KEY` to ensure total removal.
- [ ] Run a global search for `ai.gateway.lovable.dev` to ensure total removal.
- [ ] Check `atis-instance` logic for webhook URL generation.
- [ ] Verify that `src/integrations/supabase/client.ts` does not depend on the deleted integration.
