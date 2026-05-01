-- APIs table
CREATE TABLE public.apis (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_apis_user_id ON public.apis(user_id);

ALTER TABLE public.apis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own apis" ON public.apis
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own apis" ON public.apis
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own apis" ON public.apis
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own apis" ON public.apis
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER apis_set_updated_at
  BEFORE UPDATE ON public.apis
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- API Keys table
CREATE TABLE public.api_keys (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  api_id UUID NOT NULL REFERENCES public.apis(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  key_prefix TEXT NOT NULL,
  last_used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_api_keys_api_id ON public.api_keys(api_id);
CREATE INDEX idx_api_keys_user_id ON public.api_keys(user_id);
CREATE INDEX idx_api_keys_key_hash ON public.api_keys(key_hash);

ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own api keys" ON public.api_keys
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own api keys" ON public.api_keys
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own api keys" ON public.api_keys
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own api keys" ON public.api_keys
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Usage Events table (append-only log)
CREATE TABLE public.usage_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  api_id UUID NOT NULL REFERENCES public.apis(id) ON DELETE CASCADE,
  api_key_id UUID NOT NULL REFERENCES public.api_keys(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT,
  method TEXT,
  status_code INTEGER,
  latency_ms INTEGER,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_usage_events_api_id_created ON public.usage_events(api_id, created_at DESC);
CREATE INDEX idx_usage_events_user_id_created ON public.usage_events(user_id, created_at DESC);
CREATE INDEX idx_usage_events_api_key_id ON public.usage_events(api_key_id);

ALTER TABLE public.usage_events ENABLE ROW LEVEL SECURITY;

-- Users can only read their own usage. No insert/update/delete policies:
-- writes happen via server route using service role after key validation.
CREATE POLICY "Users can view own usage events" ON public.usage_events
  FOR SELECT TO authenticated USING (auth.uid() = user_id);