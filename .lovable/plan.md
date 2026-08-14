# ATIS V2 — Etapa 8: Plano de Cutover (Pacote Final)

Este documento contém os blocos de execução administrativa para a migração segura do scheduler legada para o motor ATIS V2.

## Status da Infraestrutura
- **pg_cron:** Disponível (`cron.schedule`, `cron.unschedule`, `cron.alter_job`).
- **Vault:** Disponível (`vault.secrets`).
- **Permissões:** BLOQUEADO (Read-Only).

## 1. Classificação e Inventário de Jobs

| Job Name | Status Final | Ação no Cutover | ID Detectado |
| :--- | :--- | :--- | :--- |
| `daily-verse-push-final` | **MIGRATED** | Desativar | 11 |
| `atis-daily-devotional-every-minute` | **MIGRATED** | Desativar | 18 |
| `atis-birthday-greeting-every-minute` | **MIGRATED** | Desativar | 19 |
| `atis-daily-verse-dm-every-minute` | **MIGRATED** | Desativar | 21 |
| `culto-reminder-every-minute` | **MIGRATED** | Desativar | 17 |
| `smart-notifications-daily` | **REQUIRED** | **Manter Ativo** | 15 |
| `atis-broadcast-runner-every-minute` | **REQUIRED** | **Manter Ativo** | 20 |
| `cleanup-old-data-daily` | **MAINTENANCE**| **Manter Ativo** | 16 |
| `atis-series-runner-every-minute` | **LEGACY_REQ** | **Manter Ativo** | 22 |
| `atis-plans-runner-every-minute` | **LEGACY_REQ** | **Manter Ativo** | 23 |
| `atis-welcome-runner-every-5min` | **LEGACY_REQ** | **Manter Ativo** | 24 |

---

## BLOCO A — PRE-CHECK READ-ONLY
Executar estas queries para validar o estado antes de qualquer alteração:
```sql
-- 1. Verificar permissões e Kill Switch
SELECT current_user, current_setting('default_transaction_read_only') as is_read_only;
SELECT global_enabled FROM public.atis_automation_settings WHERE id = 1;

-- 2. Confirmar jobs candidatos à migração (Devem estar ativos e com os IDs abaixo)
SELECT jobid, jobname, active FROM cron.job 
WHERE jobname IN (
    'daily-verse-push-final', 
    'atis-daily-devotional-every-minute', 
    'atis-birthday-greeting-every-minute', 
    'atis-daily-verse-dm-every-minute', 
    'culto-reminder-every-minute'
);

-- 3. Confirmar se o novo scheduler já existe (Deve retornar falso)
SELECT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'atis-send-every-minute') as v2_exists;

-- 4. Verificar disponibilidade do segredo no Vault (Pelo nome/descrição)
SELECT id, name, description FROM vault.secrets WHERE name = 'ATIS_SERVICE_ROLE_TOKEN';
```

---

## BLOCO B — SECRET CONFIGURATION
O administrador deve provisionar o token de acesso (Service Role) no Supabase Vault para evitar exposição em logs do `pg_cron`.

**Ação:** Criar um secret chamado `ATIS_SERVICE_ROLE_TOKEN` no Vault contendo a chave de serviço do projeto.
*Nota: Não imprimir o token em texto claro.*

---

## BLOCO C — CUTOVER
Executar a sequência abaixo somente após sucesso no Bloco A.

```sql
-- 1. Garantir que o motor V2 está em repouso (Segurança)
-- UPDATE public.atis_automation_settings SET global_enabled = false WHERE id = 1;

-- 2. Criação Idempotente do Scheduler V2 (Tick Global)
-- O comando utiliza uma subquery para buscar o segredo do Vault dinamicamente.
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

-- 3. Desativação Controlada dos Jobs MIGRATED (Via API Oficial)
-- Executar após validar que o atis-send está sendo chamado corretamente.
SELECT cron.alter_job(job_id := 11, active := false); -- daily-verse-push-final
SELECT cron.alter_job(job_id := 18, active := false); -- atis-daily-devotional-every-minute
SELECT cron.alter_job(job_id := 19, active := false); -- atis-birthday-greeting-every-minute
SELECT cron.alter_job(job_id := 21, active := false); -- atis-daily-verse-dm-every-minute
SELECT cron.alter_job(job_id := 17, active := false); -- culto-reminder-every-minute
```

---

## BLOCO D — ROLLBACK
Executar caso ocorram anomalias no tick global.

```sql
-- 1. Remover o Scheduler V2
SELECT cron.unschedule('atis-send-every-minute');

-- 2. Reativar Jobs Originais
SELECT cron.alter_job(job_id := 11, active := true);
SELECT cron.alter_job(job_id := 18, active := true);
SELECT cron.alter_job(job_id := 19, active := true);
SELECT cron.alter_job(job_id := 21, active := true);
SELECT cron.alter_job(job_id := 17, active := true);

-- Nota: Os outros 6 jobs nunca foram alterados, permanecendo ativos.
```

---

## Checklist Administrativa de Execução
1. [ ] Provisionar `ATIS_SERVICE_ROLE_TOKEN` no Vault.
2. [ ] Validar Bloco A (Snapshot atual).
3. [ ] Aplicar Item 2 do Bloco C (Criar tick).
4. [ ] Monitorar logs da Edge Function `atis-send` por 5 minutos.
5. [ ] Se a chamada `pg_net` → `atis-send` retornar 200, aplicar Item 3 do Bloco C (Desativar legados).
6. [ ] Reativar o motor global (`global_enabled = true`) conforme necessidade da Canary.

**PACOTE DE CUTOVER PRONTO — AGUARDANDO ADMIN WRITE**
