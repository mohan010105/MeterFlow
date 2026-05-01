import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { CheckCircle2, Zap, Crown, Sparkles, Loader2, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/auth";
import { billingApi, type Plan, type BillingSummary } from "@/lib/billing-client";
import { formatINR, formatNumber } from "@/lib/billing";
import { openCheckout } from "@/lib/razorpay-checkout";

export const Route = createFileRoute("/_app/subscription")({
  head: () => ({ meta: [{ title: "Choose Plan — MeterFlow" }] }),
  component: SubscriptionPage,
});

const SUBSCRIPTION_PLANS = [
  {
    slug: "free",
    name: "Free",
    price: 0,
    duration: "monthly",
    request_limit: 1000,
    features: ["1,000 requests / month", "Basic analytics", "Community support"],
    icon: Sparkles,
  },
  {
    slug: "pro-monthly",
    name: "Pro Monthly",
    price: 499,
    duration: "monthly",
    request_limit: 50000,
    overage_rate: 0.10,
    features: [
      "50,000 requests / month",
      "₹0.10 per 100 extra requests",
      "Standard support",
      "Detailed analytics",
    ],
    icon: Zap,
    popular: true,
  },
  {
    slug: "pro-6m",
    name: "Pro 6 Months",
    price: 2499,
    duration: "6 months",
    request_limit: 50000,
    overage_rate: 0.10,
    features: [
      "50,000 requests / month",
      "₹0.10 per 100 extra requests",
      "Priority support",
      "Detailed analytics",
      "Save ₹495 over 6 months",
    ],
    icon: Zap,
    savings: "Save 16%",
  },
  {
    slug: "pro-annual",
    name: "Pro Annual",
    price: 4999,
    duration: "yearly",
    request_limit: 50000,
    overage_rate: 0.10,
    features: [
      "50,000 requests / month",
      "₹0.10 per 100 extra requests",
      "24/7 Priority support",
      "Detailed analytics",
      "Save ₹989 over 12 months",
    ],
    icon: Crown,
    savings: "Best Value - Save 17%",
  },
];

function SubscriptionPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<BillingSummary | null>(null);
  const [processingPlan, setProcessingPlan] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const s = await billingApi.summary();
        setSummary(s);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    if (user) load();
  }, [user]);

  const handleChoosePlan = async (plan: typeof SUBSCRIPTION_PLANS[0]) => {
    if (plan.slug === "free") {
      toast.info("You're already on the Free plan");
      return;
    }
    
    setProcessingPlan(plan.slug);
    try {
      await openCheckout({
        plan_slug: plan.slug,
        description: `${plan.name} — ${plan.duration} subscription`,
        customerEmail: user?.email,
        customerName: (user?.user_metadata?.display_name as string) ?? user?.email,
      });
      
      toast.success("Plan upgraded successfully!");
      navigate({ to: "/billing" });
    } catch (e) {
      const msg = (e as Error).message;
      if (msg !== "Payment cancelled") {
        toast.error(msg || "Payment failed, try again");
      }
    } finally {
      setProcessingPlan(null);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const currentPlanSlug = summary?.plan.slug ?? "free";

  return (
    <div className="pb-12">
      <div className="mb-6 flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate({ to: "/billing" })}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <PageHeader 
          title="Subscription Plans" 
          description="Choose the plan that fits your scale. Save more with longer durations."
        />
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        {SUBSCRIPTION_PLANS.map((plan) => {
          const Icon = plan.icon;
          const isCurrent = plan.slug === currentPlanSlug;
          const isProcessing = processingPlan === plan.slug;
          
          return (
            <div
              key={plan.slug}
              className={`glass-card relative flex flex-col rounded-2xl p-6 transition-all duration-300 ${
                plan.popular 
                  ? "ring-2 ring-primary shadow-[0_0_20px_rgba(59,130,246,0.3)] scale-105 z-10" 
                  : "hover:border-primary/50"
              } ${isCurrent ? "opacity-90 grayscale-[0.5]" : ""}`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-primary px-4 py-1 text-xs font-bold text-primary-foreground shadow-lg">
                  MOST POPULAR
                </div>
              )}
              
              {plan.savings && (
                <div className="absolute top-4 right-4 rounded-full bg-success/20 px-2 py-0.5 text-[10px] font-bold text-success uppercase">
                  {plan.savings}
                </div>
              )}

              <div className="mb-4 flex items-center gap-3">
                <div className="rounded-xl bg-primary/10 p-2 text-primary">
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="font-display text-xl font-bold">{plan.name}</h3>
              </div>

              <div className="mb-1 flex items-baseline gap-1">
                <span className="text-3xl font-bold">{formatINR(plan.price)}</span>
                <span className="text-sm text-muted-foreground capitalize">
                  {plan.duration === "monthly" ? "/ mo" : `/ ${plan.duration}`}
                </span>
              </div>
              
              {plan.price > 0 && plan.duration !== "monthly" && (
                <div className="mb-4 text-xs text-muted-foreground">
                  Effective {formatINR(Math.round(plan.price / (plan.slug === "pro-6m" ? 6 : 12)))} / month
                </div>
              )}

              <div className="mb-6 mt-4 flex-1">
                <ul className="space-y-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                      <span className="text-foreground/80">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <Button
                onClick={() => handleChoosePlan(plan)}
                disabled={isCurrent || isProcessing}
                className={`w-full ${
                  plan.popular 
                    ? "bg-gradient-primary text-primary-foreground shadow-lg hover:brightness-110" 
                    : ""
                }`}
                variant={isCurrent ? "secondary" : plan.popular ? "default" : "outline"}
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : isCurrent ? (
                  "Active Plan"
                ) : (
                  "Choose Plan"
                )}
              </Button>
            </div>
          );
        })}
      </div>
      
      <div className="mt-12 rounded-2xl bg-muted/30 p-8 border border-border/50 text-center">
        <h4 className="font-display text-lg font-semibold mb-2">Need a custom plan?</h4>
        <p className="text-sm text-muted-foreground max-w-lg mx-auto mb-6">
          For high-volume APIs and enterprise needs, we offer custom request limits, 
          dedicated support, and SLA guarantees.
        </p>
        <Button variant="outline" asChild>
          <a href="mailto:sales@meterflow.app">Contact Enterprise Sales</a>
        </Button>
      </div>
    </div>
  );
}
