-- =========================================================================
-- PLANS
-- =========================================================================
CREATE TABLE public.plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  monthly_price_inr numeric(10,2) NOT NULL DEFAULT 0,
  request_limit integer NOT NULL DEFAULT 0, -- 0 = custom/unlimited
  overage_rate_per_100 numeric(10,4) NOT NULL DEFAULT 0,
  features jsonb NOT NULL DEFAULT '[]'::jsonb,
  razorpay_plan_id text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Plans are viewable by authenticated users"
  ON public.plans FOR SELECT TO authenticated USING (true);

CREATE TRIGGER plans_set_updated_at
  BEFORE UPDATE ON public.plans
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================================
-- SUBSCRIPTIONS
-- =========================================================================
CREATE TABLE public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  plan_id uuid NOT NULL REFERENCES public.plans(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'active', -- active | trialing | past_due | cancelled | pending
  current_period_start timestamptz NOT NULL DEFAULT date_trunc('month', now()),
  current_period_end timestamptz NOT NULL DEFAULT (date_trunc('month', now()) + interval '1 month'),
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  cancelled_at timestamptz,
  razorpay_subscription_id text,
  razorpay_customer_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_subscriptions_user_id ON public.subscriptions(user_id);
CREATE INDEX idx_subscriptions_status ON public.subscriptions(status);
CREATE UNIQUE INDEX idx_subscriptions_user_active
  ON public.subscriptions(user_id) WHERE status IN ('active','trialing','past_due');

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own subscriptions"
  ON public.subscriptions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own subscriptions"
  ON public.subscriptions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own subscriptions"
  ON public.subscriptions FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER subscriptions_set_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================================
-- INVOICES
-- =========================================================================
CREATE TABLE public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  subscription_id uuid REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  plan_id uuid REFERENCES public.plans(id) ON DELETE SET NULL,
  invoice_number text NOT NULL UNIQUE,
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  requests_used integer NOT NULL DEFAULT 0,
  request_limit integer NOT NULL DEFAULT 0,
  base_amount numeric(10,2) NOT NULL DEFAULT 0,
  overage_amount numeric(10,2) NOT NULL DEFAULT 0,
  tax_amount numeric(10,2) NOT NULL DEFAULT 0,
  total_amount numeric(10,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'INR',
  status text NOT NULL DEFAULT 'pending', -- pending | paid | failed | void
  pdf_path text, -- storage path inside 'invoices' bucket
  paid_at timestamptz,
  razorpay_order_id text,
  razorpay_payment_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_invoices_user_id ON public.invoices(user_id);
CREATE INDEX idx_invoices_status ON public.invoices(status);
CREATE INDEX idx_invoices_period ON public.invoices(period_start, period_end);
CREATE UNIQUE INDEX idx_invoices_user_period
  ON public.invoices(user_id, period_start);

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own invoices"
  ON public.invoices FOR SELECT TO authenticated USING (auth.uid() = user_id);
-- Inserts/updates are server-only via service role; no user write policy.

CREATE TRIGGER invoices_set_updated_at
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================================
-- PAYMENTS
-- =========================================================================
CREATE TABLE public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  invoice_id uuid REFERENCES public.invoices(id) ON DELETE SET NULL,
  subscription_id uuid REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  provider text NOT NULL DEFAULT 'razorpay',
  provider_order_id text,
  provider_payment_id text,
  provider_signature text,
  amount numeric(10,2) NOT NULL,
  currency text NOT NULL DEFAULT 'INR',
  status text NOT NULL DEFAULT 'created', -- created | authorized | captured | failed | refunded
  notes jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_payments_user_id ON public.payments(user_id);
CREATE INDEX idx_payments_provider_payment_id ON public.payments(provider_payment_id);
CREATE INDEX idx_payments_status ON public.payments(status);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own payments"
  ON public.payments FOR SELECT TO authenticated USING (auth.uid() = user_id);
-- Writes are server-only via service role.

CREATE TRIGGER payments_set_updated_at
  BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================================
-- WEBHOOK EVENTS
-- =========================================================================
CREATE TABLE public.webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL DEFAULT 'razorpay',
  event_id text,
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  signature text,
  processed boolean NOT NULL DEFAULT false,
  processing_error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_webhook_events_event_id ON public.webhook_events(event_id);
CREATE INDEX idx_webhook_events_processed ON public.webhook_events(processed);

ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;
-- No user policies: server-only table.

-- =========================================================================
-- AUTO-SUBSCRIBE NEW USERS TO FREE PLAN
-- =========================================================================
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
-- SEED PLANS
-- =========================================================================
INSERT INTO public.plans (slug, name, monthly_price_inr, request_limit, overage_rate_per_100, features, sort_order)
VALUES
  ('free', 'Free', 0, 1000, 0,
    '["1,000 requests / month","Basic analytics","Community support"]'::jsonb, 1),
  ('pro', 'Pro', 499, 50000, 0.10,
    '["50,000 requests / month","Overage billing at \u20b90.10 / 100 requests","AI insights","Priority email support","CSV export"]'::jsonb, 2),
  ('enterprise', 'Enterprise', 0, 0, 0,
    '["Unlimited or custom volume","Dedicated infrastructure","SSO & audit logs","SLA & priority support","Custom contract"]'::jsonb, 3);

-- =========================================================================
-- STORAGE: invoices bucket (private)
-- =========================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('invoices', 'invoices', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users can read own invoice PDFs"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'invoices'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
-- Server (service role) handles writes; no user write policy.