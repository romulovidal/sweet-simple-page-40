# Remoção do Sistema ATIS

O usuário solicitou a remoção completa do sistema ATIS (Assistência Tecnológica de Informação aos Servos), tanto no frontend quanto no backend.

## Ações Frontend

1.  **Limpeza de Rotas**: Remover a rota `/atis` em `src/App.tsx`.
2.  **Limpeza do Painel Admin**: Remover o botão de acesso ao ATIS em `src/pages/AdminPanel.tsx`.
3.  **Remoção de Arquivos**: Excluir todo o diretório `src/components/atis/`.
4.  **Limpeza de Hooks e Utils**:
    *   Remover bypass do ATIS em `src/hooks/useIsAdmin.ts`.
    *   Excluir `src/pages/AtisPage.tsx`.
    *   Excluir `src/utils/atis-protection.ts`.
5.  **Limpeza de Assets**: Excluir `src/assets/atis-avatar.png.asset.json`.

## Ações Backend

1.  **Remoção de Tabelas**: Excluir todas as tabelas iniciadas com `atis_` no schema `public`.
2.  **Remoção de Funções**: Excluir funções iniciadas com `atis_` no schema `public`.
3.  **Remoção de Schedulers**: Desativar e remover todos os jobs no `pg_cron` relacionados ao ATIS.
4.  **Remoção de Edge Functions**: Excluir as funções do ATIS no Supabase.

## Detalhes Técnicos

### SQL de Limpeza do Banco
```sql
-- Remover tabelas
DROP TABLE IF EXISTS "public"."atis_groups" CASCADE;
DROP TABLE IF EXISTS "public"."atis_contacts" CASCADE;
DROP TABLE IF EXISTS "public"."atis_crisis_alerts" CASCADE;
DROP TABLE IF EXISTS "public"."atis_crisis_mutes" CASCADE;
DROP TABLE IF EXISTS "public"."atis_plan_subscribers" CASCADE;
DROP TABLE IF EXISTS "public"."atis_series_group_progress" CASCADE;
DROP TABLE IF EXISTS "public"."atis_series_subscribers" CASCADE;
DROP TABLE IF EXISTS "public"."atis_birthdays" CASCADE;
DROP TABLE IF EXISTS "public"."atis_series" CASCADE;
DROP TABLE IF EXISTS "public"."atis_send_ledger" CASCADE;
DROP TABLE IF EXISTS "public"."atis_messages_log" CASCADE;
DROP TABLE IF EXISTS "public"."atis_optouts" CASCADE;
DROP TABLE IF EXISTS "public"."atis_studies" CASCADE;
DROP TABLE IF EXISTS "public"."atis_broadcasts" CASCADE;
DROP TABLE IF EXISTS "public"."atis_config" CASCADE;
DROP TABLE IF EXISTS "public"."atis_automation_settings" CASCADE;
DROP TABLE IF EXISTS "public"."atis_notification_configs" CASCADE;
DROP TABLE IF EXISTS "public"."atis_notification_targets" CASCADE;
DROP TABLE IF EXISTS "public"."atis_automation_logs" CASCADE;
DROP TABLE IF EXISTS "public"."atis_automation_attempts" CASCADE;

-- Remover funções
DROP FUNCTION IF EXISTS "public"."atis_claim_automation_occurrence" CASCADE;
DROP FUNCTION IF EXISTS "public"."atis_guard_check" CASCADE;
DROP FUNCTION IF EXISTS "public"."atis_v2_set_updated_at" CASCADE;

-- Remover Cron Jobs
SELECT cron.unschedule('atis-daily-devotional-every-minute');
SELECT cron.unschedule('atis-birthday-greeting-every-minute');
SELECT cron.unschedule('atis-broadcast-runner-every-minute');
SELECT cron.unschedule('atis-daily-verse-dm-every-minute');
SELECT cron.unschedule('atis-series-runner-every-minute');
SELECT cron.unschedule('atis-plans-runner-every-minute');
SELECT cron.unschedule('atis-welcome-runner-every-5min');
SELECT cron.unschedule('atis-global-tick');
```

### Edge Functions a Remover
*   `atis-birthday-greeting`
*   `atis-broadcast-runner`
*   `atis-daily-devotional`
*   `atis-daily-verse-dm`
*   `atis-instance`
*   `atis-plans-runner`
*   `atis-send`
*   `atis-series-runner`
*   `atis-webhook`
*   `atis-welcome-runner`
