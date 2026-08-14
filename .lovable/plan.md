# ATIS V2 — Etapa 8: Plano de Cutover Corrigido

## Status de Auditoria
- **Inventário:** 11 agendadores detectados.
- **Auditoria de Código:** Concluída.
- **Segurança:** `atis-send` requer autenticação via Service Role para invocar o Runner V2 com segurança total (dado que o Runner gerencia idempotência e disparos em massa).

## 1. Revalidação e Classificação Final

| Job | Classificação | Será Desativado? | Substituto | Motivo |
| :--- | :--- | :--- | :--- | :--- |
| `daily-verse-push-final` | MIGRATED | **SIM** | `atis-send` | Lógica temporal de janela coberta pelo Runner V2. |
| `atis-daily-devotional-...` | MIGRATED | **SIM** | `atis-send` | Lógica de geração e envio 100% via AtisEngine V2. |
| `atis-birthday-greeting-...` | MIGRATED | **SIM** | `atis-send` | Lógica de busca e envio coberta pelo AtisEngine V2. |
| `atis-daily-verse-dm-...` | MIGRATED | **SIM** | `atis-send` | Lógica de envio coberta pelo AtisEngine V2. |
| `culto-reminder-...` | MIGRATED | **SIM** | `atis-send` | Lógica de lembrete coberta pelo AtisEngine V2. |
| `smart-notifications-daily` | **REQUIRED** | **NÃO** | N/A | Depende do cron 12:00 para elegibilidade pontual. |
| `atis-broadcast-runner-...` | **REQUIRED** | **NÃO** | N/A | Fase 2 pendente; motor V2 ainda não expande targets. |
| `cleanup-old-data-daily` | **MAINTENANCE** | **NÃO** | N/A | Manutenção de infraestrutura (RPC public). |
| `atis-series-runner-...` | **LEGACY_REQUIRED**| **NÃO** | N/A | Lógica de filtro temporal granular específica. |
| `atis-plans-runner-...` | **LEGACY_REQUIRED**| **NÃO** | N/A | Atualiza `current_day` (efeito colateral de progresso). |
| `atis-welcome-runner-...` | **LEGACY_REQUIRED**| **NÃO** | N/A | Atualiza `atis_welcomed_at` (efeito colateral de perfil). |

## 2. Segurança e Autenticação
O `atis-send` deve ser invocado via **SERVICE_ROLE_KEY**.
- Chamadas via `anon` não são autorizadas para execução de automações críticas.
- O SQL deve utilizar o mecanismo de injeção de segredos do ambiente de produção.

## 3. BLOCO A — PRE-CHECK (Somente Leitura)
```sql
-- 1. Verificar permissões e estado global
SELECT current_user, current_setting('default_transaction_read_only');
SELECT * FROM public.atis_automation_settings WHERE id = 1;

-- 2. Snapshot de jobs ativos
SELECT jobid, jobname, schedule, active FROM cron.job WHERE active = true;

-- 3. Verificar se o novo agendador já existe
SELECT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'atis-send-every-minute');
```

## 4. BLOCO B — CUTOVER (Administrativo)
```sql
-- 1. Criação Idempotente do Scheduler V2
-- Nota: Substituir [SERVICE_ROLE_KEY] no momento da execução administrativa real.
SELECT cron.schedule(
    'atis-send-every-minute',
    '* * * * *',
    $$
    SELECT net.http_post(
        url:='https://hvdmobypsqksgkfrzhzf.supabase.co/functions/v1/atis-send',
        headers:='{"Content-Type":"application/json","Authorization":"Bearer [SERVICE_ROLE_KEY]"}'::jsonb,
        body:='{}'::jsonb
    );
    $$
) WHERE NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'atis-send-every-minute');

-- 2. Desativação Segura de Jobs MIGRATED
-- Utilizamos a função oficial cron.unschedule ou UPDATE conforme suporte local.
UPDATE cron.job 
SET active = false 
WHERE jobname IN (
    'daily-verse-push-final',
    'atis-daily-devotional-every-minute',
    'atis-birthday-greeting-every-minute',
    'atis-daily-verse-dm-every-minute',
    'culto-reminder-every-minute'
);
```

## 5. BLOCO C — ROLLBACK (Restauração)
```sql
-- 1. Remover Scheduler V2
SELECT cron.unschedule('atis-send-every-minute');

-- 2. Reativar Jobs Legados
UPDATE cron.job 
SET active = true 
WHERE jobname IN (
    'daily-verse-push-final',
    'atis-daily-devotional-every-minute',
    'atis-birthday-greeting-every-minute',
    'atis-daily-verse-dm-every-minute',
    'culto-reminder-every-minute'
);
```

## 6. Resultado Esperado dos Jobs

### Permanecem Ativos (REQUIRED/MAINTENANCE)
- `smart-notifications-daily`
- `atis-broadcast-runner-every-minute`
- `cleanup-old-data-daily`
- `atis-series-runner-every-minute`
- `atis-plans-runner-every-minute`
- `atis-welcome-runner-every-5min`

### Serão Desativados (MIGRATED)
- `daily-verse-push-final`
- `atis-daily-devotional-every-minute`
- `atis-birthday-greeting-every-minute`
- `atis-daily-verse-dm-every-minute`
- `culto-reminder-every-minute`

### Novo Scheduler
- `atis-send-every-minute` (Tick Global)

---
**PLANO DE CUTOVER CORRIGIDO — EXECUÇÃO BLOQUEADA POR READ-ONLY**
