# ATIS V2 — Etapa 8: Inventário Final + Execução Controlada do Cutover

## Status Atual
- **Inventário:** CONCLUÍDO (11 jobs identificados).
- **Auditoria de Código:** CONCLUÍDO (Análise de efeitos colaterais em Edge Functions realizada).
- **Classificação:** CONCLUÍDO (Tabela 11x3 gerada).
- **Cutover:** BLOQUEADO (Banco de dados em modo READ-ONLY).

## 1. Inventário de Agendadores (pg_cron)
| ID | Job Name | Schedule | Target Function |
|----|----------|----------|-----------------|
| 11 | daily-verse-push-final | * * * * * | daily-verse-push |
| 15 | smart-notifications-daily | 0 12 * * * | smart-notifications |
| 16 | cleanup-old-data-daily | 0 6 * * * | (RPC public.cleanup_old_data) |
| 17 | culto-reminder-every-minute | * * * * * | culto-reminder |
| 18 | atis-daily-devotional-every-minute | * * * * * | atis-daily-devotional |
| 19 | atis-birthday-greeting-every-minute | * * * * * | atis-birthday-greeting |
| 20 | atis-broadcast-runner-every-minute | * * * * * | atis-broadcast-runner |
| 21 | atis-daily-verse-dm-every-minute | * * * * * | atis-daily-verse-dm |
| 22 | atis-series-runner-every-minute | * * * * * | atis-series-runner |
| 23 | atis-plans-runner-every-minute | * * * * * | atis-plans-runner |
| 24 | atis-welcome-runner-every-5min | */5 * * * * | atis-welcome-runner |

## 2. Classificação de Automacões
| Job Name | Status V2 | Motivo/Observação |
|----------|-----------|-------------------|
| daily-verse-push-final | MIGRATED | Já integrado com AtisEngine V2. |
| smart-notifications-daily | MIGRATED | Já integrado com AtisEngine V2. |
| cleanup-old-data-daily | MIGRATED | Função de manutenção global, compatível. |
| culto-reminder-every-minute | MIGRATED | Já integrado com AtisEngine V2. |
| atis-daily-devotional-every-minute | MIGRATED | Já integrado com AtisEngine V2. |
| atis-birthday-greeting-every-minute | MIGRATED | Já integrado com AtisEngine V2. |
| atis-broadcast-runner-every-minute | PARTIALLY_MIGRATED | V2 orquestra, mas expansão aguarda Fase 2. |
| atis-daily-verse-dm-every-minute | MIGRATED | Já integrado com AtisEngine V2. |
| atis-series-runner-every-minute | LEGACY_REQUIRED | Lógica de filtro temporal específica e granular. |
| atis-plans-runner-every-minute | LEGACY_REQUIRED | Efeito colateral: atualiza progresso individual (current_day). |
| atis-welcome-runner-every-5min | LEGACY_REQUIRED | Efeito colateral: marca atis_welcomed_at no perfil/contato. |

## 3. Lógica do Scheduler V2 (Tick Global)
O SQL abaixo consolidará as automações MIGRATED e PARTIALLY_MIGRATED no entrypoint unificado `atis-send`. Os agendadores LEGACY_REQUIRED permanecerão ativos para garantir a execução de seus efeitos colaterais.

```sql
-- 1. Desativar Jobs Legados (Exceto os de manutenção e os LEGACY_REQUIRED)
UPDATE cron.job SET active = false WHERE jobname IN (
    'daily-verse-push-final',
    'culto-reminder-every-minute',
    'atis-daily-devotional-every-minute',
    'atis-birthday-greeting-every-minute',
    'atis-broadcast-runner-every-minute',
    'atis-daily-verse-dm-every-minute',
    'smart-notifications-daily'
);

-- 2. Criar Tick Global V2
SELECT cron.schedule(
    'atis-send-every-minute',
    '* * * * *',
    $$
    SELECT net.http_post(
        url:='https://hvdmobypsqksgkfrzhzf.supabase.co/functions/v1/atis-send',
        headers:='{"Content-Type":"application/json","apikey":"{{ANON_KEY}}"}'::jsonb,
        body:='{}'::jsonb
    );
    $$
);
```

## 4. Plano de Rollback
O arquivo `migration/rollback-atis-v2-scheduler.sql` foi criado contendo as definições originais de todos os 11 jobs para restauração imediata em caso de falha crítica na orquestração unificada.

## 5. Resultado da Execução
**PASS:** Inventário, Auditoria, Classificação e Plano de SQL.
**FAIL:** N/A.
**BLOCKED:** Escrita no banco de dados (READ-ONLY). O motor V2 está pronto para ser "ligado" assim que as permissões forem restauradas.
