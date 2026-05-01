-- =========================================================================
-- PHASE 6 + 7 STABILIZATION — COMPLETE SCHEMA FIX
-- Run this in the Supabase SQL Editor.
-- Idempotent — safe to re-run.
-- =========================================================================

-- =========================================================================
-- 1. RELOAD SCHEMA CACHE (fixes "column not found in schema cache" errors)
-- =========================================================================
NOTIFY pgrst, 'reload schema';

-- =========================================================================
-- 2. APIS — add base_url and status columns
-- =========================================================================
ALTER TABLE public.apis
  ADD COLUMN IF NOT EXISTS base_url TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';

-- Constrain status to known values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'apis_status_check'
  ) THEN
    ALTER TABLE public.apis
      ADD CONSTRAINT apis_status_check
      CHECK (status IN ('active', 'inactive'));
  END IF;
END $$;

-- Ensure RLS is enabled
ALTER TABLE public.apis ENABLE ROW LEVEL SECURITY;

-- Idempotent RLS policies for apis
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'apis' AND policyname = 'Users can view own apis'
  ) THEN
    CREATE POLICY "Users can view own apis" ON public.apis
      FOR SELECT TO authenticated USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'apis' AND policyname = 'Users can insert own apis'
  ) THEN
    CREATE POLICY "Users can insert own apis" ON public.apis
      FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'apis' AND policyname = 'Users can update own apis'
  ) THEN
    CREATE POLICY "Users can update own apis" ON public.apis
      FOR UPDATE TO authenticated USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'apis' AND policyname = 'Users can delete own apis'
  ) THEN
    CREATE POLICY "Users can delete own apis" ON public.apis
      FOR DELETE TO authenticated USING (auth.uid() = user_id);
  END IF;
END $$;

-- =========================================================================
-- 3. API_KEYS — ensure all columns and policies
-- =========================================================================
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.api_keys
  ADD COLUMN IF NOT EXISTS environment TEXT NOT NULL DEFAULT 'live',
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS rate_limit_per_minute INTEGER NOT NULL DEFAULT 60;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'api_keys' AND policyname = 'Users can view own api keys'
  ) THEN
    CREATE POLICY "Users can view own api keys" ON public.api_keys
      FOR SELECT TO authenticated USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'api_keys' AND policyname = 'Users can insert own api keys'
  ) THEN
    CREATE POLICY "Users can insert own api keys" ON public.api_keys
      FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'api_keys' AND policyname = 'Users can update own api keys'
  ) THEN
    CREATE POLICY "Users can update own api keys" ON public.api_keys
      FOR UPDATE TO authenticated USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'api_keys' AND policyname = 'Users can delete own api keys'
  ) THEN
    CREATE POLICY "Users can delete own api keys" ON public.api_keys
      FOR DELETE TO authenticated USING (auth.uid() = user_id);
  END IF;
END $$;

-- =========================================================================
-- 4. USAGE_EVENTS — ensure RLS
-- =========================================================================
ALTER TABLE public.usage_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'usage_events' AND policyname = 'Users can view own usage events'
  ) THEN
    CREATE POLICY "Users can view own usage events" ON public.usage_events
      FOR SELECT TO authenticated USING (auth.uid() = user_id);
  END IF;
END $$;

-- =========================================================================
-- 5. PROFILES — ensure extended fields
-- =========================================================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS name TEXT,
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'developer',
  ADD COLUMN IF NOT EXISTS plan TEXT DEFAULT 'free';

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Users can view own profile'
  ) THEN
    CREATE POLICY "Users can view own profile"
      ON public.profiles FOR SELECT TO authenticated
      USING (auth.uid() = id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Users can insert own profile'
  ) THEN
    CREATE POLICY "Users can insert own profile"
      ON public.profiles FOR INSERT TO authenticated
      WITH CHECK (auth.uid() = id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Users can update own profile'
  ) THEN
    CREATE POLICY "Users can update own profile"
      ON public.profiles FOR UPDATE TO authenticated
      USING (auth.uid() = id);
  END IF;
END $$;

-- =========================================================================
-- 6. PLANS, SUBSCRIPTIONS, INVOICES, PAYMENTS — ensure RLS
-- =========================================================================
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'plans' AND policyname = 'Plans are viewable by authenticated users'
  ) THEN
    CREATE POLICY "Plans are viewable by authenticated users"
      ON public.plans FOR SELECT TO authenticated USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'subscriptions' AND policyname = 'Users can view own subscriptions'
  ) THEN
    CREATE POLICY "Users can view own subscriptions"
      ON public.subscriptions FOR SELECT TO authenticated USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'subscriptions' AND policyname = 'Users can insert own subscriptions'
  ) THEN
    CREATE POLICY "Users can insert own subscriptions"
      ON public.subscriptions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'subscriptions' AND policyname = 'Users can update own subscriptions'
  ) THEN
    CREATE POLICY "Users can update own subscriptions"
      ON public.subscriptions FOR UPDATE TO authenticated USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'invoices' AND policyname = 'Users can view own invoices'
  ) THEN
    CREATE POLICY "Users can view own invoices"
      ON public.invoices FOR SELECT TO authenticated USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'payments' AND policyname = 'Users can view own payments'
  ) THEN
    CREATE POLICY "Users can view own payments"
      ON public.payments FOR SELECT TO authenticated USING (auth.uid() = user_id);
  END IF;
END $$;

-- =========================================================================
-- 7. TRIGGERS — auto profile + auto free subscription
-- =========================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, name, display_name, email, role, plan)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.email,
    'developer',
    'free'
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    name = COALESCE(EXCLUDED.name, profiles.name),
    display_name = COALESCE(EXCLUDED.display_name, profiles.display_name);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.subscribe_new_user_to_free()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  free_plan_id uuid;
BEGIN
  SELECT id INTO free_plan_id FROM public.plans WHERE slug = 'free' LIMIT 1;
  IF free_plan_id IS NOT NULL THEN
    INSERT INTO public.subscriptions (user_id, plan_id, status)
    VALUES (NEW.id, free_plan_id, 'active')
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_subscribe ON auth.users;
CREATE TRIGGER on_auth_user_created_subscribe
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.subscribe_new_user_to_free();

-- =========================================================================
-- 8. SEED PLANS (idempotent)
-- =========================================================================
INSERT INTO public.plans (slug, name, monthly_price_inr, request_limit, overage_rate_per_100, features, sort_order)
VALUES
  ('free', 'Free', 0, 1000, 0,
    '["1,000 requests / month","Basic analytics","Community support"]'::jsonb, 1),
  ('pro', 'Pro', 499, 50000, 0.10,
    '["50,000 requests / month","Overage billing at ₹0.10 / 100 requests","AI insights","Priority email support","CSV export"]'::jsonb, 2),
  ('enterprise', 'Enterprise', 0, 0, 0,
    '["Unlimited or custom volume","Dedicated infrastructure","SSO & audit logs","SLA & priority support","Custom contract"]'::jsonb, 3)
ON CONFLICT (slug) DO NOTHING;

-- Final schema cache reload
NOTIFY pgrst, 'reload schema';
