// Pure billing math — usable on both server and client.
// No imports from supabase clients here on purpose.

export interface PlanLike {
  slug: string;
  name: string;
  monthly_price: number;
  request_limit: number; // 0 = unlimited / custom
  overage_rate: number;
  duration?: string;
  price?: number;
}

export interface BillingBreakdown {
  base_amount: number;
  overage_amount: number;
  tax_amount: number;
  total_amount: number;
  overage_units: number; // requests above limit
  remaining: number; // remaining requests (0 if over)
  usage_percent: number; // 0..100+
}

/**
 * Calculate amounts in INR for a single billing period.
 * - For Free: base = 0, overage = 0 (overages are blocked, not billed).
 * - For Pro: base = monthly_price; overage = ceil(extra/100) * rate_per_100.
 * - For Enterprise (request_limit = 0): treat as unlimited; base = monthly_price.
 */
export function calculateBilling(
  plan: PlanLike,
  requestsUsed: number
): BillingBreakdown {
  const limit = plan.request_limit;
  const used = Math.max(0, requestsUsed);

  let overage_units = 0;
  let overage_amount = 0;

  if (limit > 0 && used > limit) {
    overage_units = used - limit;
    if (plan.slug !== "free" && plan.overage_rate > 0) {
      overage_amount =
        Math.ceil(overage_units / 100) * Number(plan.overage_rate);
    }
  }

  const base_amount = Number(plan.monthly_price) || 0;
  const subtotal = base_amount + overage_amount;
  // Tax placeholder (e.g. GST). Set to 0 for now to keep the engine honest.
  const tax_amount = 0;
  const total_amount = round2(subtotal + tax_amount);

  const remaining = limit > 0 ? Math.max(0, limit - used) : Infinity;
  const usage_percent =
    limit > 0 ? Math.round((used / limit) * 1000) / 10 : 0;

  return {
    base_amount: round2(base_amount),
    overage_amount: round2(overage_amount),
    tax_amount: round2(tax_amount),
    total_amount,
    overage_units,
    remaining: Number.isFinite(remaining) ? (remaining as number) : -1,
    usage_percent,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function formatINR(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat("en-IN").format(n);
}

/** Returns the [start, end) of the current calendar month in UTC. */
export function currentMonthRange(now: Date = new Date()): {
  start: Date;
  end: Date;
} {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)
  );
  return { start, end };
}

/** Returns the [start, end) of the previous calendar month in UTC. */
export function previousMonthRange(now: Date = new Date()): {
  start: Date;
  end: Date;
} {
  const start = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)
  );
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  return { start, end };
}

export function formatPeriodLabel(start: string | Date): string {
  const d = typeof start === "string" ? new Date(start) : start;
  return d.toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Generates a human-readable invoice number, e.g. MF-202604-AB12CD. */
export function generateInvoiceNumber(periodStart: Date): string {
  const yyyymm = `${periodStart.getUTCFullYear()}${String(
    periodStart.getUTCMonth() + 1
  ).padStart(2, "0")}`;
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `MF-${yyyymm}-${rand}`;
}
