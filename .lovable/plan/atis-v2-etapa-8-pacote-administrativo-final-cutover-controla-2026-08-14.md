# ATIS V2 — Etapa 8: Pacote Administrativo Final (Cutover Controlado)

Este pacote define a estratégia de transição em duas fases para o motor ATIS V2, priorizando a segurança e a validação dinâmica.

## 1. Classificação Operacional de Jobs

| Job Name | Categoria | Ação |
| :--- | :--- | :--- |
| `daily-verse-push-final` (ID: 11) | **MIGRATED** | Desativar (Fase C2) |
| `atis-daily-devotional-...` (ID: 18) | **MIGRATED** | Desativar (Fase C2) |
| `atis-birthday-greeting-...` (ID: 19) | **MIGRATED** | Desativar (Fase C2) |
| `atis-daily-verse-dm-...` (ID: 21) | **MIGRATED** | Desativar (Fase C2) |
| `culto-reminder-...` (ID: 17) | **MIGRATED** | Desativar (Fase C2) |
| **Outros 6 jobs** (IDs: 15, 16, 20, 22, 23, 24) | **REQUIRED** | **MANTER ATIVOS** |

---

## BLOCO A — PRE-CHECK READ-ONLY
```sql
-- 1. Estado da Transação e Kill Switch
SELECT current_user, current_setting('default_transaction_read_only') as is_read_only;
SELECT global_enabled FROM public.atis_automation_settings WHERE id = 1;

-- 2. Validar Existência de Segredos
SELECT name, description FROM vault.secrets WHERE name = 'ATIS_SERVICE_ROLE_TOKEN';

-- 3. Snapshot dos Jobs Migrados (Confirmar IDs 11, 18, 19, 21, 17)
SELECT jobid, jobname, active FROM cron.job 
WHERE jobname IN ('daily-verse-push-final', 'atis-daily-devotional-every-minute', 'atis-birthday-greeting-every-minute', 'atis-daily-verse-dm-every-minute', 'culto-reminder-every-minute');

-- 4. Confirmar Ausência do Scheduler V2
SELECT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'atis-send-every-minute') as v2_exists;
```

---

## BLOCO B — SECRET CONFIGURATION
O administrador deve garantir que a Service Role do projeto está provisionada no Vault.
- **Secret Name:** `ATIS_SERVICE_ROLE_TOKEN`
- **Tabela:** `vault.secrets`

---

## BLOCO C1 — INSTALAÇÃO DO SCHEDULER V2
*Nota: Esta fase não altera os jobs legados.*

```sql
-- 1. Confirmar motor OFF (Obrigatório para a fase de instalação)
-- UPDATE public.atis_automation_settings SET global_enabled = false WHERE id = 1;

-- 2. Criação Idempotente do Tick Global
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'atis-send-every-minute') THEN
        PERFORM cron.schedule(
            'atis-send-every-minute',
            '* * * * *',
            $cron$
            SELECT net.http_post(
                url:='https://hvdmobypsqksgkfrzhzf.supabase.co/functions/v1/atis-send',
                headers:=(
                    SELECT jsonb_build_object(
                        'Content-Type', 'application/json',
                        'Authorization', 'Bearer ' || decrypted_secret
                    )
                    FROM vault.decrypted_secrets 
                    WHERE name = 'ATIS_SERVICE_ROLE_TOKEN'
                    LIMIT 1
                ),
                body:='{}'::jsonb
            );
            $cron$
        );
    END IF;
END $$;
```

---

## BLOCO C1-VERIFY — VALIDAÇÃO DINÂMICA
Aguardar 2-5 minutos e executar:
```sql
-- 1. Verificar histórico de execução do pg_cron
SELECT runid, jobid, start_time, end_time, status, return_message 
FROM cron.job_run_details 
WHERE command LIKE '%atis-send%' 
ORDER BY start_time DESC 
LIMIT 5;

-- 2. Verificar fila do pg_net (Respostas HTTP)
-- Nota: Caso a tabela net.http_response não esteja acessível, validar via logs da Edge Function.
-- SELECT * FROM net.http_request_queue WHERE url LIKE '%atis-send%' ORDER BY created_at DESC LIMIT 5;
```
**CRITÉRIO DE SUCESSO:** `status = 'succeeded'` no `job_run_details` e resposta `200 OK` na Edge Function (conferir via dashboard/logs).

---

## BLOCO C2 — CUTOVER (DESATIVAÇÃO DOS LEGADOS)
*Executar apenas se C1-VERIFY for bem-sucedido.*

```sql
-- Desativar SOMENTE os 5 jobs classificados como MIGRATED
SELECT cron.alter_job(job_id := 11, active := false); -- daily-verse-push-final
SELECT cron.alter_job(job_id := 18, active := false); -- atis-daily-devotional-every-minute
SELECT cron.alter_job(job_id := 19, active := false); -- atis-birthday-greeting-every-minute
SELECT cron.alter_job(job_id := 21, active := false); -- atis-daily-verse-dm-every-minute
SELECT cron.alter_job(job_id := 17, active := false); -- culto-reminder-every-minute

-- Manter os outros 6 jobs ATIVOS conforme classificação final.
```

---

## BLOCO D1 — ROLLBACK (ANTES DO CUTOVER)
*Se o scheduler V2 falhar na instalação ou validação.*
```sql
SELECT cron.unschedule('atis-send-every-minute');
-- Nenhum legado a reativar, pois C2 não foi executado.
```

## BLOCO D2 — ROLLBACK (PÓS-CUTOVER)
*Se anomalias surgirem após desligar os legados.*
```sql
-- 1. Reativar Jobs Originais
SELECT cron.alter_job(job_id := 11, active := true);
SELECT cron.alter_job(job_id := 18, active := true);
SELECT cron.alter_job(job_id := 19, active := true);
SELECT cron.alter_job(job_id := 21, active := true);
SELECT cron.alter_job(job_id := 17, active := true);

-- 2. Remover V2 (Opcional, dependendo da investigação)
-- SELECT cron.unschedule('atis-send-every-minute');
```

---
**PACOTE ADMINISTRATIVO FINAL PRONTO — AGUARDANDO ADMIN WRITE**
*(Execução bloqueada por ambiente Read-Only)*
