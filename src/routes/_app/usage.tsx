import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  BarChart3,
  Clock,
  TrendingUp,
  CheckCircle2,
  XCircle,
  ChevronLeft,
  ChevronRight,
  Download,
} from "lucide-react";
import { toast } from "sonner";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/auth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface UsageEvent {
  id: string;
  api_id: string;
  endpoint: string | null;
  method: string | null;
  status_code: number | null;
  latency_ms: number | null;
  created_at: string;
  apis: { name: string } | null;
  api_keys: { prefix: string | null; environment: "test" | "live" } | null;
}

interface ApiOption {
  id: string;
  name: string;
}

const PAGE_SIZE = 20;

export const Route = createFileRoute("/_app/usage")({
  head: () => ({ meta: [{ title: "Usage Analytics — MeterFlow" }] }),
  component: UsagePage,
});

function UsagePage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [apis, setApis] = useState<ApiOption[]>([]);

  // Aggregates
  const [total, setTotal] = useState(0);
  const [last24h, setLast24h] = useState(0);
  const [successCount, setSuccessCount] = useState(0);
  const [errorCount, setErrorCount] = useState(0);
  const [avgLatency, setAvgLatency] = useState(0);
  const [activeApisCount, setActiveApisCount] = useState(0);

  const [perDay, setPerDay] = useState<
    { date: string; requests: number; errors: number }[]
  >([]);
  const [byApi, setByApi] = useState<{ name: string; count: number }[]>([]);
  const [byKey, setByKey] = useState<{ name: string; count: number }[]>([]);
  const [envSplit, setEnvSplit] = useState<{ test: number; live: number }>({
    test: 0,
    live: 0,
  });

  // Logs table
  const [events, setEvents] = useState<UsageEvent[]>([]);
  const [logsTotal, setLogsTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [filterApi, setFilterApi] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterEnv, setFilterEnv] = useState<string>("all");
  const [search, setSearch] = useState("");

  // Date range filter
  type DateRange = "24h" | "7d" | "30d" | "all" | "custom";
  const [dateRange, setDateRange] = useState<DateRange>("7d");
  const [customFrom, setCustomFrom] = useState<string>("");
  const [customTo, setCustomTo] = useState<string>("");

  const dateBounds = useMemo<{ from: string | null; to: string | null }>(() => {
    const now = Date.now();
    if (dateRange === "24h")
      return { from: new Date(now - 24 * 60 * 60 * 1000).toISOString(), to: null };
    if (dateRange === "7d")
      return { from: new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString(), to: null };
    if (dateRange === "30d")
      return { from: new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString(), to: null };
    if (dateRange === "custom") {
      return {
        from: customFrom ? new Date(customFrom).toISOString() : null,
        to: customTo ? new Date(customTo).toISOString() : null,
      };
    }
    return { from: null, to: null };
  }, [dateRange, customFrom, customTo]);

  // ---- Aggregates load (independent of filters) -------------------------
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

      const [apisRes, totalRes, dayRes, allLogsRes] = await Promise.all([
        supabase.from("apis").select("id, name, status").order("name"),
        supabase.from("usage_logs").select("*", { count: "exact", head: true }),
        supabase
          .from("usage_logs")
          .select("*", { count: "exact", head: true })
          .gte("created_at", since24h),
        supabase
          .from("usage_logs")
          .select("created_at, status_code, latency_ms, api_id, apis(name), api_keys(prefix, name, environment)")
          .gte("created_at", since30d)
          .order("created_at", { ascending: true })
          .limit(10000)
      ]);

      if (cancelled) return;

      const apisData = apisRes.data ?? [];
      setApis(apisData);
      setTotal(totalRes.count ?? 0);
      setLast24h(dayRes.count ?? 0);
      setActiveApisCount(apisData.filter(a => a.status === "active").length);

      const rows = (allLogsRes.data as any[]) ?? [];

      let success = 0;
      let errors = 0;
      let latencySum = 0;
      let latencyCount = 0;
      let envTest = 0;
      let envLive = 0;

      const dayMap = new Map<string, { requests: number; errors: number }>();
      for (let i = 29; i >= 0; i--) {
        const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
        const key = d.toISOString().slice(0, 10);
        dayMap.set(key, { requests: 0, errors: 0 });
      }

      const apiMap = new Map<string, { name: string; count: number }>();
      const keyMap = new Map<string, { name: string; count: number }>();

      for (const e of rows) {
        if (e.status_code != null) {
          if (e.status_code < 400) success++;
          else errors++;
        }
        if (e.latency_ms != null) {
          latencySum += e.latency_ms;
          latencyCount++;
        }

        const dateKey = e.created_at.slice(0, 10);
        const curDay = dayMap.get(dateKey);
        if (curDay) {
          curDay.requests++;
          if (e.status_code != null && e.status_code >= 400) curDay.errors++;
        }

        if (e.api_keys?.environment === "test") envTest++;
        else envLive++;

        const apiName = e.apis?.name ?? "Unknown API";
        const apiId = e.api_id;
        if (apiId) {
          const curApi = apiMap.get(apiId);
          if (curApi) curApi.count++;
          else apiMap.set(apiId, { name: apiName, count: 1 });
        }

        const keyPrefix = e.api_keys?.prefix ?? "Unknown";
        const keyName = e.api_keys?.name ? `${e.api_keys.name} (${keyPrefix})` : keyPrefix;
        const curKey = keyMap.get(keyPrefix);
        if (curKey) curKey.count++;
        else keyMap.set(keyPrefix, { name: keyName, count: 1 });
      }

      setSuccessCount(success);
      setErrorCount(errors);
      setAvgLatency(latencyCount > 0 ? Math.round(latencySum / latencyCount) : 0);
      setEnvSplit({ test: envTest, live: envLive });

      setPerDay(
        Array.from(dayMap.entries()).map(([date, v]) => ({
          date: new Date(date).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
          }),
          requests: v.requests,
          errors: v.errors,
        }))
      );

      setByApi(
        Array.from(apiMap.values())
          .sort((a, b) => b.count - a.count)
          .slice(0, 8)
      );

      setByKey(
        Array.from(keyMap.values())
          .sort((a, b) => b.count - a.count)
          .slice(0, 8)
      );

      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  // ---- Logs table (depends on filters/page) -----------------------------
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let query = supabase
        .from("usage_logs")
        .select(
          "id, api_id, endpoint, method, status_code, latency_ms, created_at, apis(name), api_keys(prefix, environment)",
          { count: "exact" }
        )
        .order("created_at", { ascending: false })
        .range(from, to);

      if (filterApi !== "all") query = query.eq("api_id", filterApi);
      if (search.trim())
        query = query.ilike("endpoint", `%${search.trim()}%`);
      if (filterStatus === "success") query = query.lt("status_code", 400);
      if (filterStatus === "error") query = query.gte("status_code", 400);
      if (dateBounds.from) query = query.gte("created_at", dateBounds.from);
      if (dateBounds.to) query = query.lte("created_at", dateBounds.to);

      const { data, count } = await query;
      if (cancelled) return;

      let rows = (data as unknown as UsageEvent[]) ?? [];
      if (filterEnv !== "all") {
        rows = rows.filter((r) => r.api_keys?.environment === filterEnv);
      }
      setEvents(rows);
      setLogsTotal(count ?? 0);
    })();
    return () => {
      cancelled = true;
    };
  }, [user, page, filterApi, filterStatus, filterEnv, search, dateBounds.from, dateBounds.to]);

  // Reset to page 0 whenever the date range changes
  useEffect(() => {
    setPage(0);
  }, [dateBounds.from, dateBounds.to]);

  const successRate = useMemo(() => {
    const sum = successCount + errorCount;
    return sum > 0 ? Math.round((successCount / sum) * 100) : 100;
  }, [successCount, errorCount]);
  const errorRate = 100 - successRate;
  const totalPages = Math.max(1, Math.ceil(logsTotal / PAGE_SIZE));

  const [exporting, setExporting] = useState(false);

  const exportCsv = async () => {
    if (!user) return;
    setExporting(true);
    try {
      let query = supabase
        .from("usage_logs")
        .select(
          "id, created_at, method, endpoint, status_code, latency_ms, apis(name), api_keys(prefix, environment)"
        )
        .order("created_at", { ascending: false })
        .limit(10000);

      if (filterApi !== "all") query = query.eq("api_id", filterApi);
      if (search.trim())
        query = query.ilike("endpoint", `%${search.trim()}%`);
      if (filterStatus === "success") query = query.lt("status_code", 400);
      if (filterStatus === "error") query = query.gte("status_code", 400);
      if (dateBounds.from) query = query.gte("created_at", dateBounds.from);
      if (dateBounds.to) query = query.lte("created_at", dateBounds.to);

      const { data, error } = await query;
      if (error) throw error;

      let rows = (data as any[]) ?? [];
      if (filterEnv !== "all") {
        rows = rows.filter((r) => r.api_keys?.environment === filterEnv);
      }

      const escape = (val: unknown) => {
        if (val == null) return "";
        const s = String(val);
        if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
        return s;
      };

      const header = [
        "id",
        "timestamp",
        "api",
        "key_prefix",
        "environment",
        "method",
        "endpoint",
        "status_code",
        "latency_ms",
      ];
      const lines = [header.join(",")];
      for (const r of rows) {
        lines.push(
          [
            r.id,
            r.created_at,
            r.apis?.name ?? "",
            r.api_keys?.prefix ?? "",
            r.api_keys?.environment ?? "",
            r.method ?? "",
            r.endpoint ?? "",
            r.status_code ?? "",
            r.latency_ms ?? "",
          ]
            .map(escape)
            .join(",")
        );
      }

      const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
      a.href = url;
      a.download = `meterflow-logs-${stamp}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(`Exported ${rows.length.toLocaleString()} rows`);
    } catch (e: any) {
      toast.error(e?.message ?? "Export failed");
    } finally {
      setExporting(false);
    }
  };


  return (
    <>
      <PageHeader
        title="Usage Analytics"
        description="Real-time request volume, error trends, and per-API breakdowns."
      />

      {loading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : total === 0 ? (
        <EmptyState
          icon={BarChart3}
          title="No usage data yet"
          description="POST to /api/track with an Authorization: Bearer <key> header to record events."
        />
      ) : (
        <div className="space-y-6">
          {/* KPI cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <KpiCard
              icon={TrendingUp}
              label="Total requests"
              value={total.toLocaleString()}
            />
            <KpiCard
              icon={Activity}
              label="Requests today"
              value={last24h.toLocaleString()}
            />
            <KpiCard
              icon={CheckCircle2}
              label="Success rate"
              value={`${successRate}%`}
              hint={`${successCount.toLocaleString()} successful`}
              tone="success"
            />
            <KpiCard
              icon={XCircle}
              label="Error rate"
              value={`${errorRate}%`}
              hint={`${errorCount.toLocaleString()} errors`}
              tone={errorRate > 5 ? "destructive" : "muted"}
            />
            <KpiCard
              icon={Clock}
              label="Avg latency"
              value={`${avgLatency} ms`}
              hint="Across all calls"
            />
            <KpiCard
              icon={BarChart3}
              label="Active APIs"
              value={activeApisCount.toLocaleString()}
            />
          </div>

          {/* Charts row 1 */}
          <div className="grid gap-4 lg:grid-cols-2">
            <ChartCard
              title="Requests over time"
              description="Last 30 days"
            >
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={perDay} margin={{ left: -16, right: 8, top: 8 }}>
                  <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{
                      background: "var(--popover)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="requests"
                    stroke="var(--primary)"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Error vs success ratio" description="Breakdown of request status">
              {successCount + errorCount === 0 ? (
                <div className="grid h-60 place-items-center text-sm text-muted-foreground">
                  No data
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie
                      data={[
                        { name: "Success", value: successCount },
                        { name: "Error", value: errorCount },
                      ]}
                      dataKey="value"
                      innerRadius={50}
                      outerRadius={85}
                      paddingAngle={2}
                    >
                      <Cell fill="var(--success)" />
                      <Cell fill="var(--destructive)" />
                    </Pie>
                    <Legend
                      iconType="circle"
                      wrapperStyle={{ fontSize: 12, color: "var(--muted-foreground)" }}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "var(--popover)",
                        border: "1px solid var(--border)",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </ChartCard>
          </div>

          {/* Charts row 2 */}
          <div className="grid gap-4 lg:grid-cols-2">
            <ChartCard title="Requests per API" description="Top 8 by volume">
              {byApi.length === 0 ? (
                <div className="grid h-60 place-items-center text-sm text-muted-foreground">
                  No data
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart
                    data={byApi}
                    layout="vertical"
                    margin={{ left: 8, right: 8, top: 8 }}
                  >
                    <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis
                      dataKey="name"
                      type="category"
                      stroke="var(--muted-foreground)"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      width={90}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "var(--popover)",
                        border: "1px solid var(--border)",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                    />
                    <Bar dataKey="count" fill="var(--primary)" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>

            <ChartCard title="API key usage distribution" description="Top 8 keys by volume">
              {byKey.length === 0 ? (
                <div className="grid h-60 place-items-center text-sm text-muted-foreground">
                  No data
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart
                    data={byKey}
                    layout="vertical"
                    margin={{ left: 8, right: 8, top: 8 }}
                  >
                    <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis
                      dataKey="name"
                      type="category"
                      stroke="var(--muted-foreground)"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      width={90}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "var(--popover)",
                        border: "1px solid var(--border)",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                    />
                    <Bar dataKey="count" fill="var(--accent)" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>
          </div>

          {/* Logs */}
          <div className="glass-card overflow-hidden rounded-2xl">
            <div className="flex flex-col gap-3 border-b border-border/60 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
              <h3 className="font-display text-lg font-semibold">Request logs</h3>
              <div className="flex flex-wrap gap-2">
                <Input
                  placeholder="Search endpoint…"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(0);
                  }}
                  className="w-48"
                />
                <Select
                  value={filterApi}
                  onValueChange={(v) => {
                    setFilterApi(v);
                    setPage(0);
                  }}
                >
                  <SelectTrigger className="w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All APIs</SelectItem>
                    {apis.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={filterEnv}
                  onValueChange={(v) => {
                    setFilterEnv(v);
                    setPage(0);
                  }}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All envs</SelectItem>
                    <SelectItem value="live">Live</SelectItem>
                    <SelectItem value="test">Test</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={filterStatus}
                  onValueChange={(v) => {
                    setFilterStatus(v);
                    setPage(0);
                  }}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    <SelectItem value="success">Success</SelectItem>
                    <SelectItem value="error">Errors</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={dateRange}
                  onValueChange={(v) => setDateRange(v as DateRange)}
                >
                  <SelectTrigger className="w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="24h">Last 24 hours</SelectItem>
                    <SelectItem value="7d">Last 7 days</SelectItem>
                    <SelectItem value="30d">Last 30 days</SelectItem>
                    <SelectItem value="all">All time</SelectItem>
                    <SelectItem value="custom">Custom range</SelectItem>
                  </SelectContent>
                </Select>
                {dateRange === "custom" && (
                  <>
                    <Input
                      type="datetime-local"
                      value={customFrom}
                      onChange={(e) => setCustomFrom(e.target.value)}
                      className="w-44"
                      title="From"
                    />
                    <Input
                      type="datetime-local"
                      value={customTo}
                      onChange={(e) => setCustomTo(e.target.value)}
                      className="w-44"
                      title="To"
                    />
                  </>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={exportCsv}
                  disabled={exporting || logsTotal === 0}
                  title="Export current filtered view as CSV"
                >
                  <Download className="h-4 w-4" />
                  {exporting ? "Exporting…" : "Export CSV"}
                </Button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-border/60 bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">When</th>
                    <th className="px-4 py-3">API</th>
                    <th className="px-4 py-3">Key</th>
                    <th className="px-4 py-3">Method</th>
                    <th className="px-4 py-3">Endpoint</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Latency</th>
                  </tr>
                </thead>
                <tbody>
                  {events.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-4 py-10 text-center text-muted-foreground"
                      >
                        No matching events
                      </td>
                    </tr>
                  ) : (
                    events.map((e) => (
                      <tr
                        key={e.id}
                        className="border-b border-border/40 last:border-0"
                      >
                        <td className="px-4 py-3 text-muted-foreground">
                          {new Date(e.created_at).toLocaleString()}
                        </td>
                        <td className="px-4 py-3">{e.apis?.name ?? "—"}</td>
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                          {e.api_keys?.prefix ?? "—"}…
                        </td>
                        <td className="px-4 py-3 font-mono text-xs">
                          {e.method ?? "—"}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                          {e.endpoint ?? "—"}
                        </td>
                        <td className="px-4 py-3">
                          {e.status_code ? (
                            <span
                              className={`rounded-full px-2 py-0.5 text-xs ${
                                e.status_code < 400
                                  ? "bg-primary/10 text-primary"
                                  : "bg-destructive/10 text-destructive"
                              }`}
                            >
                              {e.status_code}
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="px-4 py-3 text-right text-muted-foreground">
                          {e.latency_ms != null ? `${e.latency_ms} ms` : "—"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between border-t border-border/60 px-6 py-3 text-sm">
              <div className="text-muted-foreground">
                {logsTotal === 0
                  ? "0 results"
                  : `Showing ${page * PAGE_SIZE + 1}–${Math.min(
                      (page + 1) * PAGE_SIZE,
                      logsTotal
                    )} of ${logsTotal.toLocaleString()}`}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={page === 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-xs text-muted-foreground">
                  Page {page + 1} / {totalPages}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={page >= totalPages - 1}
                  onClick={() => setPage((p) => p + 1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  hint,
  tone = "primary",
}: {
  icon: typeof Activity;
  label: string;
  value: string;
  hint?: string;
  tone?: "primary" | "success" | "destructive" | "muted";
}) {
  const toneCls =
    tone === "success"
      ? "bg-success/15 text-success"
      : tone === "destructive"
        ? "bg-destructive/15 text-destructive"
        : tone === "muted"
          ? "bg-muted text-muted-foreground"
          : "bg-gradient-primary text-primary-foreground";
  return (
    <div className="glass-card rounded-2xl p-6">
      <div
        className={`mb-3 flex h-10 w-10 items-center justify-center rounded-lg ${toneCls}`}
      >
        <Icon className="h-5 w-5" />
      </div>
      <div className="text-2xl font-bold">{value}</div>
      <div className="mt-1 text-sm text-muted-foreground">{label}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

function ChartCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="glass-card rounded-2xl p-6">
      <div className="mb-4">
        <h3 className="font-display text-lg font-semibold">{title}</h3>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      {children}
    </div>
  );
}
