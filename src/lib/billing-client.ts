// Client fetcher for /api/billing/* and /api/payments/* routes.
import { supabase } from "@/integrations/supabase/client";

async function authHeaders(): Promise<HeadersInit> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token
    ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }
    : { "Content-Type": "application/json" };
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = await authHeaders();
  const res = await fetch(path, {
    ...init,
    headers: { ...headers, ...(init.headers ?? {}) },
  });
  const text = await res.text();
  const body = text ? JSON.parse(text) : {};
  if (!res.ok) {
    throw new Error(body?.error ?? `Request failed (${res.status})`);
  }
  return body as T;
}

export interface Plan {
  id: string;
  slug: "free" | "pro" | "enterprise" | string;
  name: string;
  monthly_price: number;
  request_limit: number;
  overage_rate: number;
  features: string[];
  sort_order: number;
}

export interface SubscriptionRow {
  id: string;
  plan_id: string;
  status: string;
  current_period_start: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
  cancelled_at: string | null;
  razorpay_subscription_id: string | null;
}

export interface BillingSummary {
  plan: Plan;
  subscription: SubscriptionRow;
  period_start: string;
  period_end: string;
  requests_used: number;
  base_amount: number;
  overage_amount: number;
  total_amount: number;
  overage_units: number;
  remaining: number;
  usage_percent: number;
}

export interface InvoiceRow {
  id: string;
  invoice_number: string;
  period_start: string;
  period_end: string;
  requests_used: number;
  base_amount: number;
  overage_amount: number;
  total_amount: number;
  status: "pending" | "paid" | "failed" | "void";
  pdf_path: string | null;
  paid_at: string | null;
  razorpay_order_id: string | null;
  razorpay_payment_id: string | null;
  created_at: string;
}

export interface PaymentRow {
  id: string;
  amount: number;
  currency: string;
  status: string;
  provider_payment_id: string | null;
  created_at: string;
}

export const billingApi = {
  plans: () => request<{ plans: Plan[] }>("/api/billing/plans"),
  summary: () => request<BillingSummary>("/api/billing/calculate"),
  invoices: () => request<{ invoices: InvoiceRow[] }>("/api/billing/invoices"),
  invoicePdfUrl: (id: string) =>
    request<{ url: string }>(`/api/billing/invoice-pdf/${id}`),
  generateInvoiceNow: () =>
    request<{ invoice: InvoiceRow }>("/api/billing/generate-now", {
      method: "POST",
    }),
  payments: () => request<{ payments: PaymentRow[] }>("/api/payments/list"),
};

export const paymentsApi = {
  createOrder: (input: { plan_slug?: string; invoice_id?: string }) =>
    request<{
      order_id: string;
      amount: number;
      currency: string;
      key_id: string;
      invoice_id?: string;
    }>("/api/payments/create-order", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  verify: (input: {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  }) =>
    request<{ ok: true; subscription?: SubscriptionRow; invoice?: InvoiceRow }>(
      "/api/payments/verify",
      { method: "POST", body: JSON.stringify(input) }
    ),
};

export const subscriptionApi = {
  cancel: () =>
    request<{ subscription: SubscriptionRow }>("/api/subscription/cancel", {
      method: "POST",
    }),
};
