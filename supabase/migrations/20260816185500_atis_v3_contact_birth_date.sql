alter table public.atis_contacts
  add column if not exists birth_date date;

create index if not exists atis_contacts_birth_date_idx
  on public.atis_contacts ((extract(month from birth_date)), (extract(day from birth_date)))
  where birth_date is not null and is_active = true and whatsapp_opt_in = true;
