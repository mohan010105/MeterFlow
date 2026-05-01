import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  Sparkles,
  AlertTriangle,
  Lightbulb,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/auth";

interface Anomaly {
  severity: "low" | "medium" | "high";
  title: string;
  detail: string;
}
interface Insights {
  summary: string;
  anomalies: Anomaly[];
  recommendations: string[];
}

export const Route = createFileRoute("/_app/insights")({
  head: () => ({ meta: [{ title: "AI Insights — MeterFlow" }] }),
  component: InsightsPage,
});

function InsightsPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [insights, setInsights] = useState<Insights | null>(null);
  const [generatedAt, setGeneratedAt] = useState<Date | null>(null);

  const generate = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Compute stats from RLS-scoped queries on the client side.
      const since24h = new Date(
        Date.now() - 24 * 60 * 60 * 1000
      ).toISOString();
      const since7d = new Date(
        Date.now() - 7 * 24 * 60 * 60 * 1000
      ).toISOString();

      const [
        totalRes,
        dayRes,
        recentRes,
        weekRes,
        byApiRes,
        byEndpointRes,
      ] = await Promise.all([
        supabase
          .from("usage_logs")
          .select("*", { count: "exact", head: true }),
        supabase
          .from("usage_logs")
          .select("*", { count: "exact", head: true })
          .gte("created_at", since24h),
        supabase
          .from("usage_logs")
          .select("status_code, latency_ms")
          .order("created_at", { ascending: false })
          .limit(500),
        supabase
          .from("usage_logs")
          .select("created_at, status_code, api_keys(environment)")
          .gte("created_at", since7d)
          .limit(5000),
        supabase
          .from("usage_logs")
          .select("api_id, apis(name)")
          .limit(5000),
        supabase
          .from("usage_logs")
          .select("endpoint")
          .not("endpoint", "is", null)
          .limit(5000),
      ]);

      const total = totalRes.count ?? 0;
      const last24h = dayRes.count ?? 0;

      const recent = (recentRes.data as
        | { status_code: number | null; latency_ms: number | null }[]
        | null) ?? [];
      let successCount = 0;
      let errorCount = 0;
      let latSum = 0;
      let latN = 0;
      for (const r of recent) {
        if (r.status_code != null) {
          if (r.status_code < 400) successCount++;
          else errorCount++;
        }
        if (r.latency_ms != null) {
          latSum += r.latency_ms;
          latN++;
        }
      }
      const avgLatencyMs = latN > 0 ? Math.round(latSum / latN) : 0;
      const successRate = total > 0 ? (successCount / (successCount + errorCount)) * 100 : 100;

      // Per-day
      const dayMap = new Map<string, { count: number; errors: number }>();
      for (let i = 6; i >= 0; i--) {
        const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
        dayMap.set(d.toISOString().slice(0, 10), { count: 0, errors: 0 });
      }
      let envTest = 0;
      let envLive = 0;
      for (const row of (weekRes.data as
        | {
          created_at: string;
          status_code: number | null;
          api_keys: { environment: "test" | "live" } | null;
        }[]
        | null) ?? []) {
        const k = row.created_at.slice(0, 10);
        const cur = dayMap.get(k);
        if (cur) {
          cur.count++;
          if (row.status_code != null && row.status_code >= 400) cur.errors++;
        }
        if (row.api_keys?.environment === "test") envTest++;
        else if (row.api_keys?.environment === "live") envLive++;
      }
      const perDay = Array.from(dayMap.entries()).map(([date, v]) => ({
        date,
        count: v.count,
        errors: v.errors,
      }));

      // Top APIs
      const apiMap = new Map<string, { name: string; count: number }>();
      for (const row of (byApiRes.data as
        | { api_id: string; apis: { name: string } | null }[]
        | null) ?? []) {
        const name = row.apis?.name ?? "Unknown API";
        const cur = apiMap.get(row.api_id);
        if (cur) cur.count++;
        else apiMap.set(row.api_id, { name, count: 1 });
      }
      const topApis = Array.from(apiMap.values())
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      // Top endpoints
      const epMap = new Map<string, number>();
      for (const row of (byEndpointRes.data as
        | { endpoint: string | null }[]
        | null) ?? []) {
        if (!row.endpoint) continue;
        epMap.set(row.endpoint, (epMap.get(row.endpoint) ?? 0) + 1);
      }
      const topEndpoints = Array.from(epMap.entries())
        .map(([endpoint, count]) => ({ endpoint, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      const payload = {
        total,
        last24h,
        successCount,
        errorCount,
        avgLatencyMs,
        topApis,
        topEndpoints,
        perDay,
        envSplit: { test: envTest, live: envLive },
      };

      // Heuristic fallback insights
      const heuristics: string[] = [];
      if (perDay.length >= 2) {
        const last = perDay[perDay.length - 1].count;
        const prev = perDay[perDay.length - 2].count;
        if (prev > 0) {
          const diff = ((last - prev) / prev) * 100;
          if (diff !== 0) {
            heuristics.push(`Your API usage ${diff > 0 ? "increased" : "decreased"} by ${Math.abs(Math.round(diff))}% recently.`);
          }
        }
      }
      if (topEndpoints.length > 0) {
        heuristics.push(`Most used endpoint is ${topEndpoints[0].endpoint}`);
      }

      if (total === 0) {
        setInsights({
          summary: "No usage data available yet. Start using your APIs to see insights.",
          anomalies: [],
          recommendations: ["Register an API and generate a key to get started.", "Send your first request to see analytics here."],
        });
        return;
      }

      const { data, error } = await supabase.functions.invoke(
        "usage-insights",
        { body: payload }
      );

      if (error || !data || (data as { error?: string }).error) {
        console.error("AI Insights Error:", error || data);
        if (heuristics.length > 0) {
          setInsights({
            summary: heuristics.join(" ") + " (Note: AI detailed analysis currently unavailable)",
            anomalies: [],
            recommendations: ["Ensure your API keys are correctly configured.", "Monitor high-traffic endpoints."],
          });
        } else {
          setInsights({
            summary: "Unable to generate AI insights at this time. Please try again later.",
            anomalies: [],
            recommendations: ["Check your connectivity.", "Ensure there is recent activity on your APIs."],
          });
        }
        return;
      }

      const aiInsights = data as Insights;
      // Prepend heuristics to AI summary if not already present
      if (heuristics.length > 0 && !aiInsights.summary.includes(heuristics[0].split(" ")[0])) {
        aiInsights.summary = heuristics.join(" ") + " " + aiInsights.summary;
      }

      setInsights(aiInsights);
      setGeneratedAt(new Date());
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message ?? "Failed to generate insights");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <PageHeader
        title="AI Insights"
        description="Plain-English analysis of your usage trends and anomalies, powered by Mohan Raj."
        actions={
          <Button
            onClick={generate}
            disabled={loading}
            className="bg-gradient-primary text-primary-foreground shadow-[var(--shadow-glow)]"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Analyzing…
              </>
            ) : insights ? (
              <>
                <RefreshCw className="h-4 w-4" /> Regenerate
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" /> Generate insights
              </>
            )}
          </Button>
        }
      />

      {!insights && !loading && (
        <div className="glass-card flex flex-col items-center justify-center rounded-2xl px-6 py-16 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-primary shadow-[var(--shadow-glow)]">
            <Sparkles className="h-6 w-6 text-primary-foreground" />
          </div>
          <h3 className="font-display text-lg font-semibold">
            Ready to analyze your usage
          </h3>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            We'll summarize traffic patterns, surface error spikes and latency
            outliers, and recommend next steps.
          </p>
        </div>
      )}

      {loading && !insights && (
        <div className="glass-card grid place-items-center rounded-2xl px-6 py-16 text-center">
          <Loader2 className="mb-3 h-6 w-6 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">
            Crunching numbers and asking the AI…
          </p>
        </div>
      )}

      {insights && (
        <div className="space-y-6">
          {generatedAt && (
            <div className="text-xs text-muted-foreground">
              Generated {generatedAt.toLocaleString()}
            </div>
          )}

          <div className="glass-card rounded-2xl p-6">
            <div className="mb-3 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <h3 className="font-display text-lg font-semibold">Summary</h3>
            </div>
            <p className="text-sm leading-relaxed text-foreground/90">
              {insights.summary}
            </p>
          </div>

          <div className="glass-card rounded-2xl p-6">
            <div className="mb-3 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-400" />
              <h3 className="font-display text-lg font-semibold">Anomalies</h3>
            </div>
            {insights.anomalies.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No anomalies detected. Everything looks healthy.
              </p>
            ) : (
              <div className="space-y-3">
                {insights.anomalies.map((a, i) => (
                  <AnomalyCard key={i} anomaly={a} />
                ))}
              </div>
            )}
          </div>

          <div className="glass-card rounded-2xl p-6">
            <div className="mb-3 flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-primary-glow" />
              <h3 className="font-display text-lg font-semibold">
                Recommendations
              </h3>
            </div>
            {insights.recommendations.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No specific recommendations right now.
              </p>
            ) : (
              <ul className="space-y-2 text-sm">
                {insights.recommendations.map((r, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                    <span className="text-foreground/90">{r}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function AnomalyCard({ anomaly }: { anomaly: Anomaly }) {
  const toneCls =
    anomaly.severity === "high"
      ? "border-destructive/40 bg-destructive/10"
      : anomaly.severity === "medium"
        ? "border-amber-500/40 bg-amber-500/10"
        : "border-border/60 bg-muted/30";
  const badgeCls =
    anomaly.severity === "high"
      ? "bg-destructive/20 text-destructive"
      : anomaly.severity === "medium"
        ? "bg-amber-500/20 text-amber-400"
        : "bg-muted text-muted-foreground";
  return (
    <div className={`rounded-xl border p-4 ${toneCls}`}>
      <div className="mb-1 flex items-center gap-2">
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${badgeCls}`}
        >
          {anomaly.severity}
        </span>
        <h4 className="font-medium">{anomaly.title}</h4>
      </div>
      <p className="text-sm text-muted-foreground">{anomaly.detail}</p>
    </div>
  );
}
