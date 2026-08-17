-- ATIS assistant inbound-message idempotency and safe auto-reply flags
CREATE TABLE IF NOT EXISTS public.atis_inbound_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id uuid REFERENCES public.atis_instances(id) ON DELETE CASCADE,
  provider_message_id text NOT NULL,
  remote_jid text NOT NULL,
  sender_name text,
  message_text text NOT NULL,
  is_group boolean NOT NULL DEFAULT false,
  assistant_route text,
  response_text text,
  status text NOT NULL DEFAULT 'received',
  error text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  CONSTRAINT atis_inbound_messages_status_check CHECK (status IN ('received','processing','replied','ignored','failed'))
);

CREATE UNIQUE INDEX IF NOT EXISTS atis_inbound_messages_provider_uidx
  ON public.atis_inbound_messages(instance_id, provider_message_id);
CREATE INDEX IF NOT EXISTS idx_atis_inbound_messages_received
  ON public.atis_inbound_messages(received_at DESC);

ALTER TABLE public.atis_inbound_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS atis_inbound_messages_admin_select ON public.atis_inbound_messages;
CREATE POLICY atis_inbound_messages_admin_select
  ON public.atis_inbound_messages FOR SELECT TO authenticated
  USING (public.has_role((SELECT auth.uid()), 'admin'::text));

UPDATE public.atis_settings
SET value = value || jsonb_build_object(
  'auto_reply_direct', true,
  'auto_reply_groups', false,
  'max_inbound_chars', 5000
), updated_at = now()
WHERE key = 'assistant';

COMMENT ON TABLE public.atis_inbound_messages IS
  'Idempotent inbound WhatsApp messages processed by the ATIS ministerial assistant. Group auto-replies remain disabled by default.';