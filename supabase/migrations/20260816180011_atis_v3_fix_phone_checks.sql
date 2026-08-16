alter table public.atis_contacts drop constraint if exists atis_contacts_phone_e164_check;
alter table public.atis_contacts add constraint atis_contacts_phone_e164_check check (phone_e164 ~ '^[+][1-9][0-9]{7,14}$');

alter table public.atis_group_members drop constraint if exists atis_group_members_phone_e164_check;
alter table public.atis_group_members add constraint atis_group_members_phone_e164_check check (phone_e164 is null or phone_e164 ~ '^[+][1-9][0-9]{7,14}$');

alter table public.atis_message_targets drop constraint if exists atis_message_targets_phone_e164_check;
alter table public.atis_message_targets add constraint atis_message_targets_phone_e164_check check (phone_e164 is null or phone_e164 ~ '^[+][1-9][0-9]{7,14}$');
