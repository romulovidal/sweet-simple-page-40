/**
 * migration/atis-v2-global-cron.sql
 * PLANO DE CUTOVER ATIS V2.6
 */

begin;

-- 1. Remoção de crons substituídos pelo motor global atis-send
do $$
declare
  jname text;
  substituidos text[] := array[
    'atis-daily-devotional-every-minute',
    'atis-birthday-greeting-every-minute',
    'atis-daily-verse-dm-every-minute',
    'smart-notifications-daily'
  ];
begin
  foreach jname in array substituidos
  loop
    if exists (select 1 from cron.job where jobname = jname) then
      perform cron.unschedule(jname);
    end if;
  end loop;
end $$;

-- 2. Criação/Atualização do Tick Global (atis-send)
-- Garante que o job existe exatamente uma vez
do $$
begin
  if exists (select 1 from cron.job where jobname = 'atis-send-every-minute') then
    perform cron.unschedule('atis-send-every-minute');
  end if;
end $$;

select cron.schedule(
  'atis-send-every-minute',
  '* * * * *',
  $$ select private.edge_call('atis-send', jsonb_build_object('worker', 'global-tick')) $$
);

-- 3. Diagnóstico Final
select 
  jobname, 
  schedule, 
  active, 
  command 
from cron.job 
where jobname like 'atis-%' 
   or jobname like 'daily-%' 
   or jobname like 'culto-%'
order by jobname;

-- Verificação de unicidade do atis-send
do $$
declare
  cnt int;
begin
  select count(*) into cnt from cron.job where jobname = 'atis-send-every-minute';
  if cnt <> 1 then
    raise exception 'Erro na configuração do cron: atis-send deve existir exatamente 1 vez. Encontrados: %', cnt;
  end if;
end $$;

commit;
