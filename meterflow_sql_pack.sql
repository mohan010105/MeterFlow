-- ============================================
-- MeterFlow Final Supabase SQL Pack (Safe)
-- Handles existing tables by adding missing columns
-- ============================================

-- STEP 0: Enable UUID Extension
create extension if not exists pgcrypto;

-- ============================================
-- STEP 1: profiles — add missing columns
-- ============================================
-- profiles already exists with: id, name, email, role, plan, created_at
-- Missing: avatar_url
alter table profiles add column if not exists avatar_url text;

-- ============================================
-- STEP 2a: apis — add missing columns
-- ============================================
-- apis already exists with: id, owner_id, name, base_url, description, status, created_at, user_id
-- Missing: category, version
alter table apis add column if not exists category text;
alter table apis add column if not exists version text default 'v1';

-- ============================================
-- STEP 2b: api_keys — add missing columns
-- ============================================
-- api_keys already exists with: id, api_id, user_id, key_hash, prefix, status, environment, created_at, expires_at, name
-- Missing: owner_id, last_used_at
alter table api_keys add column if not exists owner_id uuid;
alter table api_keys add column if not exists last_used_at timestamptz;

-- ============================================
-- STEP 2c: usage_logs — add missing columns
-- ============================================
-- usage_logs already exists with: id, api_key_id, api_id, endpoint, method, status_code, latency_ms, ip, created_at
-- Missing: user_id, user_agent, ip_address
-- Note: existing column is "ip" but SQL pack wants "ip_address" — we'll add ip_address AND keep ip
alter table usage_logs add column if not exists user_id uuid references profiles(id) on delete cascade;
alter table usage_logs add column if not exists user_agent text;
alter table usage_logs add column if not exists ip_address text;

-- ============================================
-- STEP 3a: plans — CREATE (doesn't exist yet)
-- ============================================
create table if not exists plans (
  id uuid primary key default gen_random_uuid(),
  name text unique,
  monthly_price numeric default 0,
  request_limit int default 1000,
  overage_rate numeric default 0,
  features jsonb,
  created_at timestamptz default now()
);

-- ============================================
-- STEP 3b: subscriptions — CREATE (doesn't exist yet)
-- ============================================
create table if not exists subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  plan text default 'free',
  status text default 'active',
  provider text default 'manual',
  renewal_date timestamptz,
  created_at timestamptz default now()
);

-- ============================================
-- STEP 3c: invoices — add missing columns
-- ============================================
-- invoices already exists with: id, user_id, month, requests, amount, status, created_at
-- Missing: requests_used, base_amount, overage_amount, total_amount, pdf_url
alter table invoices add column if not exists requests_used int default 0;
alter table invoices add column if not exists base_amount numeric default 0;
alter table invoices add column if not exists overage_amount numeric default 0;
alter table invoices add column if not exists total_amount numeric default 0;
alter table invoices add column if not exists pdf_url text;

-- ============================================
-- STEP 3d: payments — add missing columns (already exists)
-- ============================================
-- payments already exists with: id, user_id, provider, provider_payment_id, amount, currency, status, created_at
-- All columns present — no changes needed

-- ============================================
-- STEP 3e: webhook_events — CREATE (doesn't exist yet)
-- ============================================
create table if not exists webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text,
  event_type text,
  payload jsonb,
  processed boolean default false,
  created_at timestamptz default now()
);

-- ============================================
-- STEP 4a: notifications — CREATE (doesn't exist yet)
-- ============================================
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  title text,
  message text,
  type text default 'info',
  is_read boolean default false,
  created_at timestamptz default now()
);

-- ============================================
-- STEP 4b: audit_logs — CREATE (doesn't exist yet)
-- ============================================
create table if not exists audit_logs (
  id bigint generated always as identity primary key,
  user_id uuid references profiles(id) on delete set null,
  action text,
  metadata jsonb,
  created_at timestamptz default now()
);

-- ============================================
-- STEP 5: Helpful Indexes
-- ============================================
create index if not exists idx_apis_user_id on apis(user_id);
create index if not exists idx_keys_user_id on api_keys(user_id);
create index if not exists idx_logs_user_id on usage_logs(user_id);
create index if not exists idx_logs_api_id on usage_logs(api_id);
create index if not exists idx_invoices_user_id on invoices(user_id);
create index if not exists idx_payments_user_id on payments(user_id);

-- ============================================
-- STEP 6: Seed Starter Plans
-- ============================================
insert into plans (name, monthly_price, request_limit, overage_rate)
values
('Free',0,1000,0),
('Pro',499,50000,0.10),
('Enterprise',9999,999999,0)
on conflict (name) do nothing;
