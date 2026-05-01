-- Phase 9: Subscription-based Billing with Razorpay
-- This migration adds new plan columns and seeds the 3 specific plan durations.

-- 1. Update Plans Table
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS duration TEXT DEFAULT 'monthly';
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS price NUMERIC;

-- 2. Update Payments & Invoices for Razorpay
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS provider_order_id TEXT;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS provider_signature TEXT;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS notes JSONB;

ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS razorpay_order_id TEXT;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS razorpay_payment_id TEXT;

-- 2. Seed/Update Plans
-- Free Plan (Ensure slug and features)
UPDATE public.plans 
SET slug = 'free', 
    duration = 'monthly', 
    price = 0, 
    features = '["1,000 requests / month", "Basic analytics", "Community support"]'::jsonb
WHERE name = 'Free' OR slug = 'free';

-- Pro Monthly
INSERT INTO public.plans (slug, name, price, monthly_price, request_limit, overage_rate, duration, features, sort_order)
VALUES ('pro-monthly', 'Pro Monthly', 499, 499, 50000, 0.10, 'monthly', 
  '["50,000 requests / month", "₹0.10 per 100 extra requests", "Standard support", "Detailed analytics"]'::jsonb, 10)
ON CONFLICT (slug) DO UPDATE SET 
  price = EXCLUDED.price, 
  monthly_price = EXCLUDED.monthly_price, 
  request_limit = EXCLUDED.request_limit,
  features = EXCLUDED.features;

-- Pro 6 Months
INSERT INTO public.plans (slug, name, price, monthly_price, request_limit, overage_rate, duration, features, sort_order)
VALUES ('pro-6m', 'Pro 6 Months', 2499, 416, 50000, 0.10, '6 months', 
  '["50,000 requests / month", "₹0.10 per 100 extra requests", "Priority support", "Detailed analytics", "Save ₹495 over 6 months"]'::jsonb, 20)
ON CONFLICT (slug) DO UPDATE SET 
  price = EXCLUDED.price, 
  monthly_price = EXCLUDED.monthly_price, 
  request_limit = EXCLUDED.request_limit,
  features = EXCLUDED.features;

-- Pro Annual
INSERT INTO public.plans (slug, name, price, monthly_price, request_limit, overage_rate, duration, features, sort_order)
VALUES ('pro-annual', 'Pro Annual', 4999, 416, 50000, 0.10, 'yearly', 
  '["50,000 requests / month", "₹0.10 per 100 extra requests", "24/7 Priority support", "Detailed analytics", "Save ₹989 over 12 months"]'::jsonb, 30)
ON CONFLICT (slug) DO UPDATE SET 
  price = EXCLUDED.price, 
  monthly_price = EXCLUDED.monthly_price, 
  request_limit = EXCLUDED.request_limit,
  features = EXCLUDED.features;

-- 3. Notify schema reload
NOTIFY pgrst, 'reload schema';
