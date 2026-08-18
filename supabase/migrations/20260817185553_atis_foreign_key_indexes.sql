-- Add covering indexes for ATIS foreign keys reported by the Supabase
-- Performance Advisor. These indexes reduce FK maintenance/join cost as the
-- related tables grow.

create index if not exists atis_birthdays_created_by_idx
  on public.atis_birthdays(created_by);

create index if not exists atis_destination_profiles_updated_by_idx
  on public.atis_destination_profiles(updated_by);

create index if not exists atis_groups_registered_by_idx
  on public.atis_groups(registered_by);

create index if not exists atis_individuals_created_by_idx
  on public.atis_individuals(created_by);

create index if not exists atis_prayer_requests_instance_id_idx
  on public.atis_prayer_requests(instance_id);

create index if not exists atis_prayer_requests_contact_id_idx
  on public.atis_prayer_requests(contact_id);

create index if not exists atis_prayer_requests_individual_id_idx
  on public.atis_prayer_requests(individual_id);

create index if not exists atis_unanswered_questions_resolved_by_idx
  on public.atis_unanswered_questions(resolved_by);
