import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/auth";
import { PageHeader } from "@/components/PageHeader";
import { SkeletonDashboard } from "@/components/LoadingSkeleton";
import { toast } from "sonner";
import {
  Activity,
  Boxes,
  CreditCard,
  Users,
  DollarSign,
  RefreshCw,
  XCircle,
} from "lucide-react";
import { ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip } from "recharts";

export const Route = createFileRoute("/_app/admin")({
  head: () => ({ meta: [{ title: "Admin Dashboard — MeterFlow" }] }),
  beforeLoad: ({ context }) => {
    if (!context.auth) return;
    if (!context.auth.isLoading && (!context.auth.isAuthenticated || context.auth.user?.email !== "mohanrajit05@gmail.com")) {
      throw redirect({
        to: "/dashboard",
      });
    }
  },
  component: AdminDashboardPage,
});

interface AdminStats {
  totalUsers: number;
  totalApis: number;
  totalRequests: number;
  totalRevenue: number;
}

function AdminDashboardPage() {
  const { user, isLoading, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<AdminStats>({
    totalUsers: 0,
    totalApis: 0,
    totalRequests: 0,
    totalRevenue: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recentApis, setRecentApis] = useState<any[]>([]);
  const [recentUsers, setRecentUsers] = useState<any[]>([]);
  const [perDay, setPerDay] = useState<any[]>([]);

  const loadAdminData = async () => {
    if (!user || user.email !== "mohanrajit05@gmail.com") return;
    setLoading(true);
    setError(null);
    try {
      // Queries requested in instructions
      const [usersRes, apisRes, usageRes, revRes] = await Promise.all([
        supabase.from("profiles").select("*", { count: "exact", head: true }),
        supabase.from("apis").select("*", { count: "exact", head: true }),
        supabase.from("usage_logs").select("*", { count: "exact", head: true }),
        supabase.from("invoices").select("total_amount").eq("status", "paid")
      ]);

      if (usersRes.error) throw new Error(usersRes.error.message);
      if (apisRes.error) throw new Error(apisRes.error.message);
      if (usageRes.error) throw new Error(usageRes.error.message);
      if (revRes.error) throw new Error(revRes.error.message);

      // Sum values in frontend
      const totalRevenue = (revRes.data || []).reduce((sum, inv) => sum + (inv.total_amount || 0), 0);

      setStats({
        totalUsers: usersRes.count ?? 0,
        totalApis: apisRes.count ?? 0,
        totalRequests: usageRes.count ?? 0,
        totalRevenue,
      });

      // Enhance: Recent APIs, Users, Chart
      try {
        const [recentApisRes, recentUsersRes, usageLogsRes] = await Promise.all([
          supabase.from("apis").select("id, name, status, created_at").order("created_at", { ascending: false }).limit(5),
          supabase.from("profiles").select("id, email, created_at").order("created_at", { ascending: false }).limit(5),
          supabase.from("usage_logs").select("created_at").order("created_at", { ascending: true }).limit(5000)
        ]);

        if (recentApisRes.data) setRecentApis(recentApisRes.data);
        if (recentUsersRes.data) setRecentUsers(recentUsersRes.data);

        if (usageLogsRes.data && usageLogsRes.data.length > 0) {
          const dayMap = new Map<string, number>();
          for (let i = 29; i >= 0; i--) {
            const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
            const key = d.toISOString().slice(0, 10);
            dayMap.set(key, 0);
          }

          for (const row of usageLogsRes.data) {
            if (row.created_at) {
              const dateKey = row.created_at.slice(0, 10);
              if (dayMap.has(dateKey)) {
                dayMap.set(dateKey, (dayMap.get(dateKey) || 0) + 1);
              }
            }
          }

          setPerDay(
            Array.from(dayMap.entries()).map(([date, count]) => ({
              date: new Date(date).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
              }),
              requests: count,
            }))
          );
        }
      } catch (e) {
        console.error("Failed to load enhanced admin data:", e);
      }

    } catch (err: any) {
      setError(err.message || "Failed to load admin metrics.");
      toast.error("Failed to fetch admin data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated || user?.email !== "mohanrajit05@gmail.com") {
      navigate({ to: "/dashboard" });
      return;
    }
    loadAdminData();
  }, [isLoading, isAuthenticated, user, navigate]);

  if (loading) {
    return <SkeletonDashboard />;
  }

  if (error) {
    // UX alert requirement: black background + white text
    return (
      <div className="p-6 bg-black text-white border border-destructive rounded-2xl flex flex-col items-center justify-center text-center py-16 shadow-2xl">
        <XCircle className="h-14 w-14 text-destructive mb-4 animate-pulse" />
        <h3 className="font-display text-xl font-bold tracking-tight">Admin Access Error</h3>
        <p className="mt-2 text-sm text-gray-300 max-w-sm leading-relaxed">{error}</p>
        <button
          onClick={loadAdminData}
          className="mt-8 inline-flex items-center gap-2 bg-white text-black px-5 py-2.5 rounded-xl font-medium text-sm hover:bg-gray-200 transition-all duration-200 shadow-sm hover:scale-[1.02]"
        >
          <RefreshCw className="h-4 w-4" /> Retry
        </button>
      </div>
    );
  }

  const cards = [
    {
      label: "Total Users",
      value: stats.totalUsers.toLocaleString(),
      icon: Users,
    },
    {
      label: "Total APIs",
      value: stats.totalApis.toLocaleString(),
      icon: Boxes,
    },
    {
      label: "Total API Requests",
      value: stats.totalRequests.toLocaleString(),
      icon: Activity,
    },
    {
      label: "Total Revenue",
      value: `$${stats.totalRevenue.toLocaleString()}`,
      icon: DollarSign,
    },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <PageHeader
        title="Platform Admin"
        description="Global overview of MeterFlow usage and monetization."
      />

      {/* 4 summary cards grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className="glass-card rounded-2xl p-6 transition-all duration-300 hover:shadow-[var(--shadow-glow)] hover:-translate-y-1"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">
                  {card.label}
                </span>
                <div className="p-2 bg-primary/10 rounded-xl">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
              </div>
              <div className="mt-4 font-display text-3xl font-bold tracking-tight">
                {card.value}
              </div>
            </div>
          );
        })}
      </div>

      {perDay.length > 0 && (
        <div className="glass-card rounded-2xl p-6 transition-all duration-300">
          <h3 className="font-display text-lg font-semibold mb-4">Global Requests (Last 30 Days)</h3>
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
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Recent Users */}
        <div className="glass-card rounded-2xl p-6 transition-all duration-300">
          <h3 className="font-display text-lg font-semibold mb-4 flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" /> Recent Users
          </h3>
          {recentUsers.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-8 bg-muted/10 rounded-xl border border-dashed border-border">
              No users found
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-border/60 text-xs text-muted-foreground uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-2">Email</th>
                    <th className="px-4 py-2">Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {recentUsers.map((u) => (
                    <tr key={u.id} className="border-b border-border/40 last:border-0 transition-colors hover:bg-muted/20">
                      <td className="px-4 py-3 font-medium truncate max-w-[220px]" title={u.email}>{u.email}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {new Date(u.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Recent APIs */}
        <div className="glass-card rounded-2xl p-6 transition-all duration-300">
          <h3 className="font-display text-lg font-semibold mb-4 flex items-center gap-2">
            <Boxes className="h-5 w-5 text-primary" /> Recent APIs
          </h3>
          {recentApis.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-8 bg-muted/10 rounded-xl border border-dashed border-border">
              No APIs found
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-border/60 text-xs text-muted-foreground uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-2">API Name</th>
                    <th className="px-4 py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentApis.map((a) => (
                    <tr key={a.id} className="border-b border-border/40 last:border-0 transition-colors hover:bg-muted/20">
                      <td className="px-4 py-3 font-medium">{a.name}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            a.status === "active"
                              ? "bg-primary/10 text-primary"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {a.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
