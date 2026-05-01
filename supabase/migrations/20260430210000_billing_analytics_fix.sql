-- Phase 8: Billing Engine Stabilization
-- This migration ensures that the plans and invoices tables have all columns required by the billing logic.

-- 1. Plans Table Fixes
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE;
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;

-- Populate slugs based on name if they are null
UPDATE public.plans SET slug = LOWER(name) WHERE slug IS NULL;

-- 2. Invoices Table Fixes
-- Add descriptive columns for modern billing logic
ALTER TABLE public.invoices 
  ADD COLUMN IF NOT EXISTS subscription_id UUID REFERENCES public.subscriptions(id),
  ADD COLUMN IF NOT EXISTS plan_id UUID REFERENCES public.plans(id),
  ADD COLUMN IF NOT EXISTS invoice_number TEXT,
  ADD COLUMN IF NOT EXISTS period_start TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS period_end TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS request_limit INTEGER,
  ADD COLUMN IF NOT EXISTS tax_amount NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

-- Backfill existing invoices where possible
UPDATE public.invoices SET 
  requests_used = COALESCE(requests_used, requests, 0),
  total_amount = COALESCE(total_amount, amount, 0);

-- Notify schema reload
NOTIFY pgrst, 'reload schema';
