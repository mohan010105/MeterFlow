ALTER TABLE public.api_keys
  ADD COLUMN IF NOT EXISTS rate_limit_per_minute integer NOT NULL DEFAULT 60;

ALTER TABLE public.api_keys
  ADD CONSTRAINT api_keys_rate_limit_positive CHECK (rate_limit_per_minute >= 0);

CREATE INDEX IF NOT EXISTS usage_events_api_key_id_created_at_idx
  ON public.usage_events (api_key_id, created_at DESC);
