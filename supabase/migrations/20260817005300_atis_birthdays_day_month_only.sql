alter table public.atis_birthdays
  add column if not exists birth_day smallint,
  add column if not exists birth_month smallint;

update public.atis_birthdays
set birth_day = extract(day from birth_date)::smallint,
    birth_month = extract(month from birth_date)::smallint
where birth_day is null or birth_month is null;

alter table public.atis_birthdays
  alter column birth_day set not null,
  alter column birth_month set not null;

alter table public.atis_birthdays
  drop constraint if exists atis_birthdays_day_month_check;

alter table public.atis_birthdays
  add constraint atis_birthdays_day_month_check check (
    birth_month between 1 and 12
    and birth_day between 1 and 31
    and not (birth_month in (4,6,9,11) and birth_day > 30)
    and not (birth_month = 2 and birth_day > 29)
  );

-- A coluna legada continua existindo apenas para compatibilidade com código antigo.
-- O ano 2000 é um ano técnico canônico (bissexto), não o ano de nascimento.
update public.atis_birthdays
set birth_date = make_date(2000, birth_month, birth_day)
where birth_date is distinct from make_date(2000, birth_month, birth_day);

create or replace function public.atis_birthdays_sync_day_month()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.birth_day is null or new.birth_month is null then
    if new.birth_date is null then
      raise exception 'BIRTH_DAY_MONTH_REQUIRED';
    end if;
    new.birth_day := extract(day from new.birth_date)::smallint;
    new.birth_month := extract(month from new.birth_date)::smallint;
  end if;

  if new.birth_month < 1 or new.birth_month > 12
     or new.birth_day < 1 or new.birth_day > 31
     or (new.birth_month in (4,6,9,11) and new.birth_day > 30)
     or (new.birth_month = 2 and new.birth_day > 29) then
    raise exception 'INVALID_BIRTH_DAY_MONTH';
  end if;

  -- Compatibilidade: nunca persiste o ano real no ATIS.
  new.birth_date := make_date(2000, new.birth_month, new.birth_day);
  return new;
end;
$$;

drop trigger if exists trg_atis_birthdays_sync_day_month on public.atis_birthdays;
create trigger trg_atis_birthdays_sync_day_month
before insert or update of birth_date, birth_day, birth_month
on public.atis_birthdays
for each row execute function public.atis_birthdays_sync_day_month();

drop index if exists public.idx_atis_birthdays_active_date;
create index if not exists idx_atis_birthdays_active_month_day
  on public.atis_birthdays (is_active, birth_month, birth_day);

comment on column public.atis_birthdays.birth_day is 'Dia do aniversário (1-31). Fonte de verdade no ATIS.';
comment on column public.atis_birthdays.birth_month is 'Mês do aniversário (1-12). Fonte de verdade no ATIS.';
comment on column public.atis_birthdays.birth_date is 'Compatibilidade legada. O ano é sempre 2000 e não representa o ano de nascimento.';
