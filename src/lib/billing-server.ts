// Server-only billing helpers. Imported only by /src/routes/api/billing/*
// and /src/routes/hooks/* — never from client code.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  calculateBilling,
  currentMonthRange,
  generateInvoiceNumber,
  type PlanLike,
} from "@/lib/billing";
import { generateInvoicePdf } from "@/lib/invoice-pdf.server";

export interface PlanRow extends PlanLike {
  id: string;
  features: string[];
  sort_order: number;
  is_active: boolean;
  razorpay_plan_id: string | null;
  duration: string;
  price: number;
}

export async function getOrCreateActiveSubscription(userId: string) {
  const { data: existing, error } = await supabaseAdmin
    .from("subscriptions")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();

  if (existing) return existing;

  // Fetch free plan
  const { data: plans } = await supabaseAdmin
    .from("plans")
    .select("*");
  
  const freePlan = (plans ?? []).find(p => (p.slug === "free" || p.name.toLowerCase() === "free"));
  
  if (!freePlan) throw new Error("Database missing free plan configuration");

  const { data: newSub, error: insertErr } = await supabaseAdmin
    .from("subscriptions")
    .insert({
      user_id: userId,
      plan_id: freePlan.id,
      status: "active",
      current_period_start: new Date().toISOString(),
      current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    })
    .select("*")
    .single();

  if (insertErr) throw insertErr;
  return newSub;
}

export async function getPlanById(planId: string): Promise<PlanRow | null> {
  const { data, error } = await supabaseAdmin
    .from("plans")
    .select("*")
    .eq("id", planId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getPlanBySlug(slug: string): Promise<PlanRow | null> {
  const { data: plans, error } = await supabaseAdmin
    .from("plans")
    .select("*");
  if (error) throw error;

  const SLUG_MAP: Record<string, string> = {
    'Free': 'free',
    'Pro': 'pro-monthly',
    'Pro Monthly': 'pro-monthly',
    'Pro 6 Months': 'pro-6m',
    'Pro Annual': 'pro-annual'
  };

  const plan = (plans ?? []).find(p => {
    // If slug column exists and has value, use it. 
    // Otherwise fallback to name mapping or slugified name.
    const pSlug = p.slug || SLUG_MAP[p.name] || p.name.toLowerCase().replace(/ /g, '-');
    return pSlug === slug || p.slug === slug || p.name.toLowerCase() === slug.toLowerCase();
  });
  
  return (plan as PlanRow) || null;
}

/** Counts usage_events for this user in [start, end). */
export async function countRequests(
  userId: string,
  start: Date,
  end: Date
): Promise<number> {
  const { count, error } = await supabaseAdmin
    .from("usage_logs")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", start.toISOString())
    .lt("created_at", end.toISOString());
  if (error) throw error;
  return count ?? 0;
}

export async function generateOrUpdateInvoiceForUser(
  userId: string,
  periodStart: Date,
  periodEnd: Date,
  userEmail: string | null
) {
  const subscription = await getOrCreateActiveSubscription(userId);
  const plan = await getPlanById(subscription.plan_id);
  if (!plan) throw new Error("Plan missing for subscription");

  const requestsUsed = await countRequests(userId, periodStart, periodEnd);
  const breakdown = calculateBilling(plan, requestsUsed);

  const { data: existing } = await supabaseAdmin
    .from("invoices")
    .select("*")
    .eq("user_id", userId)
    .eq("period_start", periodStart.toISOString())
    .maybeSingle();

  if (existing) {
    if (existing.status === "paid") {
      return existing;
    }
    // Build update object based on what might exist.
    const updateData: any = {
      requests_used: requestsUsed,
      base_amount: breakdown.base_amount,
      overage_amount: breakdown.overage_amount,
      tax_amount: breakdown.tax_amount,
      total_amount: breakdown.total_amount,
      status: breakdown.total_amount === 0 ? "paid" : "pending",
      paid_at: breakdown.total_amount === 0 ? new Date().toISOString() : existing.paid_at,
      // Fallbacks for older schema
      requests: requestsUsed,
      amount: breakdown.total_amount,
    };

    const { data: updated, error: updateErr } = await supabaseAdmin
      .from("invoices")
      .update(updateData)
      .eq("id", existing.id)
      .select("*")
      .single();
    if (updateErr) throw updateErr;
    return updated;
  }

  const invoiceNumber = generateInvoiceNumber(periodStart);
  const insertData: any = {
    user_id: userId,
    subscription_id: subscription.id,
    plan_id: plan.id,
    invoice_number: invoiceNumber,
    period_start: periodStart.toISOString(),
    period_end: periodEnd.toISOString(),
    requests_used: requestsUsed,
    request_limit: plan.request_limit,
    base_amount: breakdown.base_amount,
    overage_amount: breakdown.overage_amount,
    tax_amount: breakdown.tax_amount,
    total_amount: breakdown.total_amount,
    currency: "INR",
    status: breakdown.total_amount === 0 ? "paid" : "pending",
    paid_at: breakdown.total_amount === 0 ? new Date().toISOString() : null,
    // Fallbacks
    month: periodStart.toISOString().slice(0, 7),
    requests: requestsUsed,
    amount: breakdown.total_amount,
  };

  const { data: inserted, error: insertErr } = await supabaseAdmin
    .from("invoices")
    .insert(insertData)
    .select("*")
    .single();

  if (insertErr) throw insertErr;
  return inserted;
}

/**
 * Builds the live billing summary for the current month.
 */
export async function buildCurrentSummary(userId: string) {
  const subscription = await getOrCreateActiveSubscription(userId);
  const plan = await getPlanById(subscription.plan_id);
  if (!plan) throw new Error("Plan not found");

  const { start, end } = currentMonthRange();
  const requests_used = await countRequests(userId, start, end);
  const breakdown = calculateBilling(plan, requests_used);

  // Store/Update invoice
  try {
    const { data: userData } = await supabaseAdmin.auth.admin.getUserById(userId);
    const email = userData?.user?.email ?? null;
    await generateOrUpdateInvoiceForUser(userId, start, end, email);
  } catch (e) {
    console.error("Failed to store billing invoice summary", e);
  }

  return {
    plan,
    subscription,
    period_start: start.toISOString(),
    period_end: end.toISOString(),
    requests_used,
    ...breakdown,
  };
}

/**
 * Generates an invoice for a single user for the given period.
 * - Idempotent on (user_id, period_start) via the unique index.
 * - Builds and uploads the PDF, stores the storage path on the row.
 * Returns the invoice row (existing or newly created).
 */
export async function generateInvoiceForUser(
  userId: string,
  periodStart: Date,
  periodEnd: Date,
  userEmail: string | null
) {
  // Short-circuit if invoice already exists for this period.
  const { data: existing } = await supabaseAdmin
    .from("invoices")
    .select("*")
    .eq("user_id", userId)
    .eq("period_start", periodStart.toISOString())
    .maybeSingle();
  if (existing) return existing;

  const subscription = await getOrCreateActiveSubscription(userId);
  const plan = await getPlanById(subscription.plan_id);
  if (!plan) throw new Error("Plan missing for subscription");

  const requestsUsed = await countRequests(userId, periodStart, periodEnd);
  const breakdown = calculateBilling(plan, requestsUsed);

  // Skip producing an invoice for free users with no overage and no base.
  if (
    plan.slug === "free" &&
    breakdown.total_amount === 0 &&
    breakdown.overage_amount === 0
  ) {
    // Still record a $0 invoice so users see history.
  }

  const invoiceNumber = generateInvoiceNumber(periodStart);
  const insertData: any = {
    user_id: userId,
    subscription_id: subscription.id,
    plan_id: plan.id,
    invoice_number: invoiceNumber,
    period_start: periodStart.toISOString(),
    period_end: periodEnd.toISOString(),
    requests_used: requestsUsed,
    request_limit: plan.request_limit,
    base_amount: breakdown.base_amount,
    overage_amount: breakdown.overage_amount,
    tax_amount: breakdown.tax_amount,
    total_amount: breakdown.total_amount,
    currency: "INR",
    status: breakdown.total_amount === 0 ? "paid" : "pending",
    paid_at: breakdown.total_amount === 0 ? new Date().toISOString() : null,
    // Fallbacks
    month: periodStart.toISOString().slice(0, 7),
    requests: requestsUsed,
    amount: breakdown.total_amount,
  };

  const { data: inserted, error: insertErr } = await supabaseAdmin
    .from("invoices")
    .insert(insertData)
    .select("*")
    .single();

  if (insertErr) {
    // Race: another job inserted the same period. Fetch and return it.
    const { data: again } = await supabaseAdmin
      .from("invoices")
      .select("*")
      .eq("user_id", userId)
      .eq("period_start", periodStart.toISOString())
      .maybeSingle();
    if (again) return again;
    throw insertErr;
  }

  // Generate + upload PDF (best-effort; failures don't break the invoice).
  try {
    const pdfBytes = await generateInvoicePdf({
      invoiceNumber: inserted.invoice_number,
      customerEmail: userEmail ?? "Customer",
      planName: plan.name,
      periodStart,
      periodEnd,
      requestsUsed,
      requestLimit: plan.request_limit,
      baseAmount: breakdown.base_amount,
      overageAmount: breakdown.overage_amount,
      overageUnits: breakdown.overage_units,
      overageRatePer100: plan.overage_rate_per_100,
      taxAmount: breakdown.tax_amount,
      totalAmount: breakdown.total_amount,
      status: inserted.status,
    });

    const path = `${userId}/${inserted.id}.pdf`;
    const { error: upErr } = await supabaseAdmin.storage
      .from("invoices")
      .upload(path, pdfBytes, {
        contentType: "application/pdf",
        upsert: true,
      });
    if (upErr) {
      console.error("invoice pdf upload failed", upErr);
    } else {
      await supabaseAdmin
        .from("invoices")
        .update({ pdf_path: path })
        .eq("id", inserted.id);
      inserted.pdf_path = path;
    }
  } catch (e) {
    console.error("invoice pdf generation failed", e);
  }

  return inserted;
}
