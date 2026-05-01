-- Phase 6: extend api_keys with environment, expires_at, status
-- Backwards compatible: existing rows default to 'live' / 'active' / NULL expiry.

ALTER TABLE public.api_keys
  ADD COLUMN IF NOT EXISTS environment text NOT NULL DEFAULT 'live',
  ADD COLUMN IF NOT EXISTS expires_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';

-- Constrain environment + status to known values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'api_keys_environment_check'
  ) THEN
    ALTER TABLE public.api_keys
      ADD CONSTRAINT api_keys_environment_check
      CHECK (environment IN ('test', 'live'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'api_keys_status_check'
  ) THEN
    ALTER TABLE public.api_keys
      ADD CONSTRAINT api_keys_status_check
      CHECK (status IN ('active', 'inactive'));
  END IF;
END $$;

-- Backfill any NULLs (no-ops with defaults, kept for safety)
UPDATE public.api_keys SET environment = 'live' WHERE environment IS NULL;
UPDATE public.api_keys SET status = CASE WHEN revoked_at IS NULL THEN 'active' ELSE 'inactive' END WHERE status IS NULL;

-- Lookup index for /api/track (hash lookups dominate this workload)
CREATE INDEX IF NOT EXISTS api_keys_key_hash_idx ON public.api_keys (key_hash);
CREATE INDEX IF NOT EXISTS api_keys_user_id_created_at_idx ON public.api_keys (user_id, created_at DESC);