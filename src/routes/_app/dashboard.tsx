import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { useAuth } from "@/context/auth";
import { supabase } from "@/integrations/supabase/client";
import { SkeletonDashboard } from "@/components/LoadingSkeleton";
import {
  Activity,
  KeyRound,
  BarChart3,
  CreditCard,
  Boxes,
  TrendingUp,
  ArrowRight,
  Copy,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — MeterFlow" }] }),
  beforeLoad: ({ context }) => {
    if (context.auth?.user?.email === "mohanrajit05@gmail.com") {
      throw redirect({ to: "/admin" });
    }
  },
  component: DashboardPage,
});

interface DashboardStats {
  apiCount: number;
  activeKeys: number;
  requests24h: number;
  totalRequests: number;
  currentPlan: string;
}

function DashboardPage() {
  const { user } = useAuth();
  const name =
    user?.user_metadata?.display_name || user?.email?.split("@")[0];
  const [stats, setStats] = useState<DashboardStats>({
    apiCount: 0,
    activeKeys: 0,
    requests24h: 0,
    totalRequests: 0,
    currentPlan: "Free",
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadStats = async () => {
    setLoading(true);
    setError(null);
    try {
      const since24h = new Date(
        Date.now() - 24 * 60 * 60 * 1000
      ).toISOString();

      const [apisRes, keysRes, totalRes, dayRes] = await Promise.all([
        supabase.from("apis").select("*", { count: "exact", head: true }),
        supabase
          .from("api_keys")
          .select("*", { count: "exact", head: true })
          .eq("status", "active"),
        supabase
          .from("usage_logs")
          .select("*", { count: "exact", head: true }),
        supabase
          .from("usage_logs")
          .select("*", { count: "exact", head: true })
          .gte("created_at", since24h),
      ]);

      // Try to get current plan
      let planName = "Free";
      try {
        const { data: subData } = await supabase
          .from("subscriptions")
          .select("plan")
          .eq("status", "active")
          .limit(1)
          .maybeSingle();
        if (subData && subData.plan) {
          planName = subData.plan;
        }
      } catch {}

      setStats({
        apiCount: apisRes.count ?? 0,
        activeKeys: keysRes.count ?? 0,
        requests24h: dayRes.count ?? 0,
        totalRequests: totalRes.count ?? 0,
        currentPlan: planName,
      });
    } catch {
      setError("Failed to load dashboard data. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    loadStats();
  }, [user]);

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`Copied ${label}`);
    } catch {
      toast.error("Failed to copy");
    }
  };

  if (loading) {
    return <SkeletonDashboard />;
  }

  if (error) {
    return (
      <>
        <PageHeader
          title={`Welcome${name ? `, ${name}` : ""}`}
          description="Here's what's happening with your APIs today."
        />
        <div className="glass-card flex flex-col items-center justify-center rounded-2xl px-6 py-16 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
            <Activity className="h-6 w-6 text-destructive" />
          </div>
          <h3 className="font-display text-lg font-semibold">Failed to load</h3>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">{error}</p>
          <button
            onClick={loadStats}
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-gradient-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            <RefreshCw className="h-4 w-4" /> Retry
          </button>
        </div>
      </>
    );
  }

  const cards = [
    {
      label: "APIs",
      value: String(stats.apiCount),
      icon: Boxes,
      hint: stats.apiCount === 0 ? "Register your first API" : "Total registered",
      to: "/apis",
    },
    {
      label: "Active Keys",
      value: String(stats.activeKeys),
      icon: KeyRound,
      hint: stats.activeKeys === 0 ? "No keys yet" : "Currently active",
      to: "/keys",
    },
    {
      label: "Requests (24h)",
      value: stats.requests24h.toLocaleString(),
      icon: BarChart3,
      hint:
        stats.requests24h === 0
          ? "No traffic yet"
          : `${stats.totalRequests.toLocaleString()} total`,
      to: "/usage",
    },
    {
      label: "Plan",
      value: stats.currentPlan,
      icon: CreditCard,
      hint: "Upgrade anytime",
      to: "/billing",
    },
  ];

  return (
    <>
      <PageHeader
        title={`Welcome${name ? `, ${name}` : ""}`}
        description="Here's what's happening with your APIs today."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((s) => {
          const Icon = s.icon;
          return (
            <Link
              key={s.label}
              to={s.to}
              className="glass-card group rounded-2xl p-5 transition-shadow hover:shadow-[var(--shadow-glow)]"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  {s.label}
                </span>
                <Icon className="h-4 w-4 text-primary" />
              </div>
              <div className="mt-3 font-display text-3xl font-bold">
                {s.value}
              </div>
              <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                <span>{s.hint}</span>
                <ArrowRight className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100" />
              </div>
            </Link>
          );
        })}
      </div>

      <div className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="glass-card rounded-2xl p-6">
          <h3 className="font-display text-lg font-semibold">Get started</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Three steps to your first metered request.
          </p>
          <ol className="mt-4 space-y-3 text-sm">
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-primary text-xs font-bold text-primary-foreground">
                1
              </span>
              <span>
                <Link
                  to="/apis"
                  className="font-medium text-primary hover:underline"
                >
                  Register an API
                </Link>{" "}
                in the APIs tab
              </span>
            </li>
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-primary text-xs font-bold text-primary-foreground">
                2
              </span>
              <span>
                <Link
                  to="/keys"
                  className="font-medium text-primary hover:underline"
                >
                  Generate an API key
                </Link>{" "}
                for your customer
              </span>
            </li>
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-primary text-xs font-bold text-primary-foreground">
                3
              </span>
              <span>
                Watch usage roll into{" "}
                <Link
                  to="/usage"
                  className="font-medium text-primary hover:underline"
                >
                  Analytics
                </Link>{" "}
                in real-time
              </span>
            </li>
          </ol>
        </div>

        <div className="glass-card rounded-2xl p-6">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            <h3 className="font-display text-lg font-semibold">
              Quick links
            </h3>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <Link
              to="/apis"
              className="rounded-xl border border-border/60 px-4 py-3 text-sm transition-colors hover:bg-muted/50"
            >
              <Boxes className="mb-1 h-4 w-4 text-primary" />
              <div className="font-medium">APIs</div>
              <div className="text-xs text-muted-foreground">
                Manage your APIs
              </div>
            </Link>
            <Link
              to="/keys"
              className="rounded-xl border border-border/60 px-4 py-3 text-sm transition-colors hover:bg-muted/50"
            >
              <KeyRound className="mb-1 h-4 w-4 text-primary" />
              <div className="font-medium">API Keys</div>
              <div className="text-xs text-muted-foreground">
                Generate & revoke
              </div>
            </Link>
            <Link
              to="/usage"
              className="rounded-xl border border-border/60 px-4 py-3 text-sm transition-colors hover:bg-muted/50"
            >
              <BarChart3 className="mb-1 h-4 w-4 text-primary" />
              <div className="font-medium">Usage</div>
              <div className="text-xs text-muted-foreground">
                Analytics & logs
              </div>
            </Link>
            <Link
              to="/billing"
              className="rounded-xl border border-border/60 px-4 py-3 text-sm transition-colors hover:bg-muted/50"
            >
              <CreditCard className="mb-1 h-4 w-4 text-primary" />
              <div className="font-medium">Billing</div>
              <div className="text-xs text-muted-foreground">
                Plans & invoices
              </div>
            </Link>
          </div>

          {/* User ID with copy */}
          {user?.id && (
            <div className="mt-4 border-t border-border/60 pt-4">
              <div className="text-xs text-muted-foreground mb-1">Your User ID</div>
              <div className="flex items-center gap-2">
                <code className="flex-1 truncate rounded bg-muted/50 px-2 py-1 text-xs font-mono text-muted-foreground">
                  {user.id}
                </code>
                <button
                  onClick={() => copyToClipboard(user.id, "User ID")}
                  className="shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                  title="Copy User ID"
                >
                  <Copy className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
