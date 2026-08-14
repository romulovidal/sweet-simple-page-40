/**
 * migration/verify-atis-v2-cron.sql
 * Verificação estrita do cutover ATIS V2.
 *
 * Não altera nada.
 * Falha com exception se o estado não estiver exatamente como esperado.
 */

do $$
declare
  r record;
  total_count integer;
  valid_count integer;
  errors text := '';
begin

  -- ============================================================
  -- 1. JOBS QUE DEVEM EXISTIR EXATAMENTE UMA VEZ
  -- ============================================================

  for r in
    select *
    from (
      values
        (
          'daily-verse-push-final',
          '* * * * *',
          'private.edge_call(''daily-verse-push'''
        ),
        (
          'culto-reminder-every-minute',
          '* * * * *',
          'private.edge_call(''culto-reminder'''
        ),
        (
          'atis-broadcast-runner-every-minute',
          '* * * * *',
          'private.edge_call(''atis-broadcast-runner'''
        ),
        (
          'atis-series-runner-every-minute',
          '* * * * *',
          'private.edge_call(''atis-series-runner'''
        ),
        (
          'atis-plans-runner-every-minute',
          '* * * * *',
          'private.edge_call(''atis-plans-runner'''
        ),
        (
          'atis-welcome-runner-every-5min',
          '*/5 * * * *',
          'private.edge_call(''atis-welcome-runner'''
        ),
        (
          'cleanup-old-data-daily',
          '0 6 * * *',
          'public.cleanup_old_data()'
        ),
        (
          'atis-send-every-minute',
          '* * * * *',
          'private.edge_call(''atis-send'''
        )
    ) as expected(jobname, expected_schedule, command_fragment)
  loop

    select
      count(*),
      count(*) filter (
        where active = true
          and schedule = r.expected_schedule
          and position(r.command_fragment in command) > 0
      )
    into total_count, valid_count
    from cron.job
    where jobname = r.jobname;

    if total_count <> 1 then
      errors := errors || format(
        E'\n- %s: esperado exatamente 1 job; encontrados %s.',
        r.jobname,
        total_count
      );

    elsif valid_count <> 1 then
      errors := errors || format(
        E'\n- %s: existe, mas active/schedule/command não correspondem ao esperado.',
        r.jobname
      );
    end if;

  end loop;


  -- ============================================================
  -- 2. JOBS QUE DEVEM TER SIDO REMOVIDOS
  -- ============================================================

  for r in
    select *
    from (
      values
        ('atis-daily-devotional-every-minute'),
        ('atis-birthday-greeting-every-minute'),
        ('atis-daily-verse-dm-every-minute'),
        ('smart-notifications-daily')
    ) as removed(jobname)
  loop

    select count(*)
    into total_count
    from cron.job
    where jobname = r.jobname;

    if total_count <> 0 then
      errors := errors || format(
        E'\n- %s: deveria estar removido, mas ainda existe.',
        r.jobname
      );
    end if;

  end loop;


  -- ============================================================
  -- 3. RESULTADO
  -- ============================================================

  if errors <> '' then
    raise exception
      E'VERIFICAÇÃO ATIS V2 FALHOU:%',
      errors;
  end if;

  raise notice 'ATIS V2 CRON: VERIFICAÇÃO APROVADA.';
end
$$;


-- ==============================================================
-- 4. RELATÓRIO VISUAL
-- ==============================================================

select
  jobname,
  schedule,
  active,
  command
from cron.job
where jobname in (
  'daily-verse-push-final',
  'culto-reminder-every-minute',
  'atis-broadcast-runner-every-minute',
  'atis-series-runner-every-minute',
  'atis-plans-runner-every-minute',
  'atis-welcome-runner-every-5min',
  'cleanup-old-data-daily',
  'atis-send-every-minute',
  'atis-daily-devotional-every-minute',
  'atis-birthday-greeting-every-minute',
  'atis-daily-verse-dm-every-minute',
  'smart-notifications-daily'
)
order by jobname;