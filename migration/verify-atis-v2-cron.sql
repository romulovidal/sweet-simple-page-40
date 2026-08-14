/**
 * migration/verify-atis-v2-cron.sql
 * Verificador específico para o estado pós-cutover do ATIS V2.
 */

with expected_jobs as (
  select unnest(array[
    'daily-verse-push-final',
    'culto-reminder-every-minute',
    'atis-broadcast-runner-every-minute',
    'atis-series-runner-every-minute',
    'atis-plans-runner-every-minute',
    'atis-welcome-runner-every-5min',
    'cleanup-old-data-daily',
    'atis-send-every-minute'
  ]) as name
),
removed_jobs as (
  select unnest(array[
    'atis-daily-devotional-every-minute',
    'atis-birthday-greeting-every-minute',
    'atis-daily-verse-dm-every-minute',
    'smart-notifications-daily'
  ]) as name
)
select 
  j.jobname,
  j.schedule,
  j.active,
  case 
    when j.jobname in (select name from expected_jobs) then '✅ PRESENTE (OK)'
    when j.jobname in (select name from removed_jobs) then '❌ DEVERIA ESTAR REMOVIDO'
    else '⚠️ DESCONHECIDO'
  end as status
from cron.job j
where j.jobname in (select name from expected_jobs)
   or j.jobname in (select name from removed_jobs)
order by j.jobname;
