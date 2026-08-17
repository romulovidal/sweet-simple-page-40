create index if not exists atis_inbound_messages_conversation_history_idx
on public.atis_inbound_messages(instance_id, remote_jid, received_at desc)
where status = 'replied';

update public.atis_settings
set value = jsonb_set(
  coalesce(value, '{}'::jsonb),
  '{history_messages}',
  '20'::jsonb,
  true
)
where key = 'assistant';
