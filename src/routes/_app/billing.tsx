import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  CreditCard,
  CheckCircle2,
  Download,
  Loader2,
  Sparkles,
  TrendingUp,
  XCircle,
  Crown,
  Zap,
  Building2,
  AlertCircle,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/auth";
import {
  billingApi,
  subscriptionApi,
  type BillingSummary,
  type Plan,
  type InvoiceRow,
  type PaymentRow,
} from "@/lib/billing-client";
import { formatINR, formatNumber, formatPeriodLabel } from "@/lib/billing";
import { openCheckout } from "@/lib/razorpay-checkout";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/billing")({
  head: () => ({ meta: [{ title: "Billing — MeterFlow" }] }),
  component: BillingPage,
});

const PLAN_ICON: Record<string, typeof Zap> = {
  free: Sparkles,
  pro: Zap,
  enterprise: Building2,
};

function BillingPage() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<BillingSummary | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionPlan, setActionPlan] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const refresh = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [s, p, i, pay] = await Promise.all([
        billingApi.summary(),
        billingApi.plans(),
        billingApi.invoices(),
        billingApi.payments(),
      ]);
      setSummary(s);
      setPlans(p.plans);
      setInvoices(i.invoices);
      setPayments(pay.payments);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const handleUpgrade = async (plan: Plan) => {
    if (plan.slug === "enterprise") {
      window.location.href = `mailto:sales@meterflow.app?subject=Enterprise%20plan%20enquiry`;
      return;
    }
    if (!summary) return;
    if (plan.id === summary.plan.id && summary.subscription.status === "active") {
      toast.info("You're already on this plan");
      return;
    }
    setActionPlan(plan.slug);
    try {
      const result = await openCheckout({
        plan_slug: plan.slug,
        description: `${plan.name} plan — monthly subscription`,
        customerEmail: user?.email,
        customerName:
          (user?.user_metadata?.display_name as string | undefined) ??
          user?.email,
      });
      toast.success(
        `Payment successful. You're now on the ${plan.name} plan.`
      );
      void result;
      await refresh(true);
    } catch (e) {
      const msg = (e as Error).message;
      if (msg !== "Payment cancelled") toast.error(msg);
    } finally {
      setActionPlan(null);
    }
  };

  const handlePayInvoice = async (invoice: InvoiceRow) => {
    if (invoice.status === "paid") return;
    setActionPlan(`inv:${invoice.id}`);
    try {
      await openCheckout({
        invoice_id: invoice.id,
        description: `Invoice ${invoice.invoice_number}`,
        customerEmail: user?.email,
      });
      toast.success("Invoice paid");
      await refresh(true);
    } catch (e) {
      const msg = (e as Error).message;
      if (msg !== "Payment cancelled") toast.error(msg);
    } finally {
      setActionPlan(null);
    }
  };

  const handleCancel = async () => {
    if (!confirm("Cancel auto-renewal? You'll keep access until the end of your billing period."))
      return;
    setCancelling(true);
    try {
      await subscriptionApi.cancel();
      toast.success("Auto-renewal cancelled");
      await refresh(true);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setCancelling(false);
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      await billingApi.generateInvoiceNow();
      toast.success("Invoice generated for last month");
      await refresh(true);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = async (invoice: InvoiceRow) => {
    setDownloadingId(invoice.id);
    try {
      const { url } = await billingApi.invoicePdfUrl(invoice.id);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setDownloadingId(null);
    }
  };

  if (loading) {
    return (
      <>
        <PageHeader title="Billing" description="Plans, invoices, and payment methods." />
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </>
    );
  }

  const currentPlanSlug = summary?.plan.slug ?? "free";
  const subscription = summary?.subscription;
  const usagePct = summary
    ? Math.min(100, Math.round(summary.usage_percent))
    : 0;
  const usageBarColor =
    usagePct >= 90
      ? "bg-destructive"
      : usagePct >= 60
        ? "bg-amber-500"
        : "bg-gradient-primary";

  return (
    <>
      <PageHeader
        title="Billing"
        description="Plans, usage, invoices, and payments."
        actions={
          <Button asChild className="bg-gradient-primary text-primary-foreground shadow-[var(--shadow-glow)]">
            <Link to="/subscription">
              <Zap className="mr-2 h-4 w-4" />
              Upgrade Plan
            </Link>
          </Button>
        }
      />

      {/* Top: current plan + usage + estimate */}
      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="glass-card rounded-2xl p-6 lg:col-span-2">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                Current plan
              </div>
              <div className="mt-1 flex items-center gap-3">
                <span className="font-display text-3xl font-bold">
                  {summary?.plan.name ?? "Free"}
                </span>
                <StatusBadge status={subscription?.status ?? "active"} />
                {subscription?.cancel_at_period_end && (
                  <span className="rounded-full bg-amber-500/15 px-2 py-1 text-xs font-medium text-amber-400">
                    Cancels on renewal
                  </span>
                )}
              </div>
              <div className="mt-1 text-sm text-muted-foreground">
                {summary && summary.plan.monthly_price > 0
                  ? `${formatINR(summary.plan.monthly_price)} / month`
                  : "Free tier"}
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                Renews
              </div>
              <div className="mt-1 font-display text-lg font-semibold">
                {subscription
                  ? new Date(subscription.current_period_end).toLocaleDateString(
                      "en-IN",
                      { day: "2-digit", month: "short", year: "numeric" }
                    )
                  : "—"}
              </div>
              {currentPlanSlug !== "free" && !subscription?.cancel_at_period_end && (
                <button
                  onClick={handleCancel}
                  disabled={cancelling}
                  className="mt-2 text-xs text-muted-foreground hover:text-destructive disabled:opacity-50"
                >
                  {cancelling ? "Cancelling…" : "Cancel auto-renew"}
                </button>
              )}
            </div>
          </div>

          {/* Usage bar */}
          <div className="mt-6">
            <div className="flex items-baseline justify-between text-sm">
              <span className="text-muted-foreground">Usage this month</span>
              <span className="font-medium">
                {summary ? formatNumber(summary.requests_used) : 0}
                {summary && summary.plan.request_limit > 0 && (
                  <span className="text-muted-foreground">
                    {" "}
                    / {formatNumber(summary.plan.request_limit)} requests
                  </span>
                )}
                {summary && summary.plan.request_limit === 0 && (
                  <span className="text-muted-foreground"> requests</span>
                )}
              </span>
            </div>
            <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-muted">
              {summary && summary.plan.request_limit > 0 && (
                <div
                  className={`h-full rounded-full transition-all ${usageBarColor}`}
                  style={{ width: `${usagePct}%` }}
                />
              )}
            </div>
            {summary && summary.overage_units > 0 && (
              <div className="mt-2 flex items-center gap-1.5 text-xs text-amber-400">
                <AlertCircle className="h-3.5 w-3.5" />
                {formatNumber(summary.overage_units)} requests over limit —
                billed at {formatINR(summary.plan.overage_rate)} per 100
              </div>
            )}
          </div>
        </div>

        <div className="glass-card rounded-2xl p-6">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            Estimated bill this month
          </div>
          <div className="mt-2 font-display text-4xl font-bold text-gradient">
            {summary ? formatINR(summary.total_amount) : "—"}
          </div>
          <div className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Base</span>
              <span>{summary ? formatINR(summary.base_amount) : "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Overage</span>
              <span>{summary ? formatINR(summary.overage_amount) : "—"}</span>
            </div>
          </div>
          <Button
            onClick={handleGenerate}
            disabled={generating}
            variant="outline"
            size="sm"
            className="mt-5 w-full"
          >
            {generating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating…
              </>
            ) : (
              "Generate invoice for last month"
            )}
          </Button>
        </div>
      </div>

      {/* Plan selector */}
      <div className="mb-6">
        <h3 className="mb-3 font-display text-lg font-semibold">
          Choose your plan
        </h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {plans.map((plan) => {
            const Icon = PLAN_ICON[plan.slug] ?? Crown;
            const isCurrent = plan.id === summary?.plan.id;
            const isLoading = actionPlan === plan.slug;
            const ctaLabel =
              plan.slug === "enterprise"
                ? "Contact sales"
                : isCurrent
                  ? "Current plan"
                  : plan.slug === "free"
                    ? "Downgrade"
                    : "Upgrade";
            return (
              <div
                key={plan.id}
                className={`glass-card relative flex flex-col rounded-2xl p-6 transition-all ${
                  isCurrent
                    ? "ring-2 ring-primary shadow-[var(--shadow-glow)]"
                    : ""
                } ${plan.slug === "pro" ? "border-primary/40" : ""}`}
              >
                {plan.slug === "pro" && !isCurrent && (
                  <span className="absolute -top-2.5 right-4 rounded-full bg-gradient-primary px-2.5 py-0.5 text-xs font-semibold text-primary-foreground shadow-[var(--shadow-glow)]">
                    Most popular
                  </span>
                )}
                <div className="flex items-center gap-2">
                  <Icon className="h-5 w-5 text-primary" />
                  <span className="font-display text-xl font-bold">
                    {plan.name}
                  </span>
                </div>
                <div className="mt-3 font-display text-3xl font-bold">
                  {plan.monthly_price > 0
                    ? formatINR(plan.monthly_price)
                    : plan.slug === "enterprise"
                      ? "Custom"
                      : "Free"}
                  {plan.monthly_price > 0 && (
                    <span className="text-base font-normal text-muted-foreground">
                      {" "}
                      / mo
                    </span>
                  )}
                </div>
                <div className="mt-1 text-sm text-muted-foreground">
                  {plan.request_limit > 0
                    ? `${formatNumber(plan.request_limit)} requests / month`
                    : "Custom volume"}
                </div>
                <ul className="mt-5 flex-1 space-y-2 text-sm">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  onClick={() => handleUpgrade(plan)}
                  disabled={isCurrent || isLoading}
                  className={`mt-6 w-full ${
                    plan.slug === "pro" && !isCurrent
                      ? "bg-gradient-primary text-primary-foreground shadow-[var(--shadow-glow)] hover:opacity-90"
                      : ""
                  }`}
                  variant={
                    isCurrent ? "secondary" : plan.slug === "pro" ? "default" : "outline"
                  }
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Opening…
                    </>
                  ) : (
                    ctaLabel
                  )}
                </Button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Invoices */}
      <div className="glass-card mb-6 rounded-2xl p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-display text-lg font-semibold">Invoices</h3>
          <span className="text-xs text-muted-foreground">
            {invoices.length} {invoices.length === 1 ? "invoice" : "invoices"}
          </span>
        </div>
        {invoices.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-12 text-center">
            <CreditCard className="mb-3 h-8 w-8 text-muted-foreground" />
            <div className="text-sm font-medium">No invoices yet</div>
            <div className="mt-1 text-xs text-muted-foreground">
              Invoices are generated on the 1st of each month.
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-2 font-medium">Invoice #</th>
                  <th className="px-3 py-2 font-medium">Period</th>
                  <th className="px-3 py-2 font-medium">Requests</th>
                  <th className="px-3 py-2 text-right font-medium">Amount</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr
                    key={inv.id}
                    className="border-b border-border/40 last:border-0"
                  >
                    <td className="px-3 py-3 font-mono text-xs">
                      {inv.invoice_number}
                    </td>
                    <td className="px-3 py-3">
                      {formatPeriodLabel(inv.period_start)}
                    </td>
                    <td className="px-3 py-3">
                      {formatNumber(inv.requests_used)}
                    </td>
                    <td className="px-3 py-3 text-right font-medium">
                      {formatINR(inv.total_amount)}
                    </td>
                    <td className="px-3 py-3">
                      <InvoiceStatus status={inv.status} />
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex justify-end gap-2">
                        {inv.status === "pending" && inv.total_amount > 0 && (
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => handlePayInvoice(inv)}
                            disabled={actionPlan === `inv:${inv.id}`}
                          >
                            {actionPlan === `inv:${inv.id}` ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              "Pay"
                            )}
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDownload(inv)}
                          disabled={!inv.pdf_path || downloadingId === inv.id}
                        >
                          {downloadingId === inv.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <>
                              <Download className="mr-1 h-3.5 w-3.5" />
                              PDF
                            </>
                          )}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Payment history */}
      {payments.length > 0 && (
        <div className="glass-card rounded-2xl p-6">
          <h3 className="mb-4 font-display text-lg font-semibold">
            Payment history
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-2 font-medium">Date</th>
                  <th className="px-3 py-2 font-medium">Payment ID</th>
                  <th className="px-3 py-2 text-right font-medium">Amount</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr
                    key={p.id}
                    className="border-b border-border/40 last:border-0"
                  >
                    <td className="px-3 py-3 text-muted-foreground">
                      {new Date(p.created_at).toLocaleString()}
                    </td>
                    <td className="px-3 py-3 font-mono text-xs">
                      {p.provider_payment_id ?? "—"}
                    </td>
                    <td className="px-3 py-3 text-right font-medium">
                      {formatINR(p.amount)}
                    </td>
                    <td className="px-3 py-3">
                      <PaymentStatus status={p.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    active: "bg-success/15 text-success",
    trialing: "bg-accent/15 text-accent",
    past_due: "bg-amber-500/15 text-amber-400",
    cancelled: "bg-muted text-muted-foreground",
    pending: "bg-muted text-muted-foreground",
  };
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
        map[status] ?? "bg-muted text-muted-foreground"
      }`}
    >
      {status.replace("_", " ")}
    </span>
  );
}

function InvoiceStatus({ status }: { status: string }) {
  if (status === "paid")
    return (
      <span className="inline-flex items-center gap-1 text-success">
        <CheckCircle2 className="h-3.5 w-3.5" />
        Paid
      </span>
    );
  if (status === "failed")
    return (
      <span className="inline-flex items-center gap-1 text-destructive">
        <XCircle className="h-3.5 w-3.5" />
        Failed
      </span>
    );
  if (status === "void")
    return <span className="text-muted-foreground">Void</span>;
  return (
    <span className="inline-flex items-center gap-1 text-amber-400">
      <TrendingUp className="h-3.5 w-3.5" />
      Pending
    </span>
  );
}

function PaymentStatus({ status }: { status: string }) {
  if (status === "captured")
    return (
      <span className="inline-flex items-center gap-1 text-success">
        <CheckCircle2 className="h-3.5 w-3.5" />
        Captured
      </span>
    );
  if (status === "failed")
    return (
      <span className="inline-flex items-center gap-1 text-destructive">
        <XCircle className="h-3.5 w-3.5" />
        Failed
      </span>
    );
  return <span className="capitalize text-muted-foreground">{status}</span>;
}
