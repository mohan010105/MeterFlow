import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Check,
  Copy,
  KeyRound,
  Pencil,
  Plus,
  Power,
  RefreshCw,
  Search,
  ShieldOff,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { SkeletonStatsGrid, SkeletonTable } from "@/components/LoadingSkeleton";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/auth";
import { keysApi, type KeyListRow } from "@/lib/api-keys-client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ApiOption {
  id: string;
  name: string;
}

type EnvFilter = "all" | "test" | "live";
type StatusFilter = "all" | "active" | "inactive" | "revoked";

export const Route = createFileRoute("/_app/keys")({
  head: () => ({ meta: [{ title: "API Keys — MeterFlow" }] }),
  validateSearch: (search: Record<string, unknown>) => ({
    apiId: typeof search.apiId === "string" ? search.apiId : undefined,
  }),
  component: KeysPage,
});

function statusOf(k: KeyListRow): "active" | "inactive" | "revoked" | "expired" {
  if (k.revoked_at) return "revoked";
  if (k.expires_at && new Date(k.expires_at).getTime() <= Date.now())
    return "expired";
  return k.status;
}

function StatusBadge({ k }: { k: KeyListRow }) {
  const s = statusOf(k);
  const cls =
    s === "active"
      ? "bg-primary/10 text-primary"
      : s === "inactive"
        ? "bg-muted text-muted-foreground"
        : s === "expired"
          ? "bg-amber-500/10 text-amber-500"
          : "bg-destructive/10 text-destructive";
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs capitalize ${cls}`}>
      {s}
    </span>
  );
}

function EnvBadge({ env }: { env: "test" | "live" }) {
  const cls =
    env === "live"
      ? "bg-primary/10 text-primary"
      : "bg-blue-500/10 text-blue-400";
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
      {env}
    </span>
  );
}

function KeysPage() {
  const { user } = useAuth();
  const { apiId: initialApiId } = Route.useSearch();
  const [apis, setApis] = useState<ApiOption[]>([]);
  const [keys, setKeys] = useState<KeyListRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Create modal state
  const [open, setOpen] = useState(false);
  const [selectedApiId, setSelectedApiId] = useState<string>(initialApiId ?? "");
  const [name, setName] = useState("");
  const [environment, setEnvironment] = useState<"test" | "live">("test");
  const [expiresAt, setExpiresAt] = useState<string>("");
  const [rateLimit, setRateLimit] = useState<string>("60");
  const [submitting, setSubmitting] = useState(false);
  const [createdPlaintext, setCreatedPlaintext] = useState<string | null>(null);

  // Revoke confirm
  const [revokeId, setRevokeId] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [envFilter, setEnvFilter] = useState<EnvFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  // Inline rate-limit editing
  const [editingRateId, setEditingRateId] = useState<string | null>(null);
  const [editingRateValue, setEditingRateValue] = useState<string>("");
  const [savingRate, setSavingRate] = useState(false);

  // Per-key usage in the last 60s (api_key_id -> count)
  const [recentUsage, setRecentUsage] = useState<Record<string, number>>({});

  const filteredKeys = useMemo(() => {
    return keys
      .filter((k) => (initialApiId ? k.api_id === initialApiId : true))
      .filter((k) => (envFilter === "all" ? true : k.environment === envFilter))
      .filter((k) => {
        if (statusFilter === "all") return true;
        const s = statusOf(k);
        return s === statusFilter;
      })
      .filter((k) => {
        if (!search.trim()) return true;
        const q = search.toLowerCase();
        return (
          k.prefix?.toLowerCase().includes(q) ||
          k.name.toLowerCase().includes(q) ||
          (k.api_name ?? "").toLowerCase().includes(q)
        );
      });
  }, [keys, initialApiId, envFilter, statusFilter, search]);

  const lastUsed = useMemo(() => {
    const usedTimes = keys
      .map((k) => k.last_used_at)
      .filter(Boolean)
      .map((t) => new Date(t!).getTime());
    if (usedTimes.length === 0) return "Never";
    const maxTime = Math.max(...usedTimes);
    return new Date(maxTime).toLocaleDateString();
  }, [keys]);

  const load = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [apisRes, keysRes] = await Promise.all([
        supabase.from("apis").select("id, name").order("name"),
        keysApi.list(),
      ]);
      if (apisRes.error) toast.error(apisRes.error.message);
      setApis(apisRes.data ?? []);
      setKeys(keysRes.keys);
    } catch (e: any) {
      setLoadError(e?.message ?? "Failed to load keys");
    } finally {
      setLoading(false);
    }
  };

  const loadRecentUsage = async () => {
    const sinceIso = new Date(Date.now() - 60_000).toISOString();
    // RLS already scopes this to the current user's events.
    const { data, error } = await supabase
      .from("usage_logs")
      .select("api_key_id")
      .gte("created_at", sinceIso)
      .limit(10000);
    if (error) {
      // Non-fatal — just skip the indicator on failure.
      return;
    }
    const counts: Record<string, number> = {};
    for (const row of (data as { api_key_id: string }[] | null) ?? []) {
      counts[row.api_key_id] = (counts[row.api_key_id] ?? 0) + 1;
    }
    setRecentUsage(counts);
  };

  useEffect(() => {
    if (!user) return;
    load();
    loadRecentUsage();
    // Refresh the rate-limit usage indicator every 15s.
    const t = setInterval(loadRecentUsage, 15_000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const openCreate = () => {
    if (apis.length === 0) {
      toast.error("Create an API first");
      return;
    }
    setSelectedApiId(initialApiId ?? apis[0]?.id ?? "");
    setName("");
    setEnvironment("test");
    setExpiresAt("");
    setRateLimit("60");
    setCreatedPlaintext(null);
    setOpen(true);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedApiId || !name.trim()) return;
    setSubmitting(true);
    try {
      const expires_iso = expiresAt
        ? new Date(expiresAt).toISOString()
        : null;
      const parsedRate = Number.parseInt(rateLimit, 10);
      const rate_limit_per_minute = Number.isFinite(parsedRate) && parsedRate >= 0
        ? parsedRate
        : 60;
      const { plaintext } = await keysApi.create({
        api_id: selectedApiId,
        name: name.trim(),
        environment,
        expires_at: expires_iso,
        rate_limit_per_minute,
      });
      setCreatedPlaintext(plaintext);
      load();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to create key");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRevoke = async () => {
    if (!revokeId) return;
    try {
      await keysApi.revoke(revokeId);
      toast.success("Key revoked");
      setRevokeId(null);
      load();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to revoke");
    }
  };

  const handleRegenerate = async (id: string) => {
    if (!confirm("Regenerate key? The old key will stop working immediately.")) return;
    try {
      const { plaintext } = await keysApi.regenerate(id);
      setCreatedPlaintext(plaintext);
      setOpen(true);
      load();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to regenerate");
    }
  };

  const handleToggleStatus = async (k: KeyListRow) => {
    const next = k.status === "active" ? "inactive" : "active";
    try {
      await keysApi.toggleStatus(k.id, next);
      toast.success(`Key ${next === "active" ? "activated" : "deactivated"}`);
      load();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to update key");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Permanently delete this key?")) return;
    try {
      await keysApi.remove(id);
      toast.success("Key deleted");
      load();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to delete");
    }
  };

  const copyKey = async (text: string) => {
    await navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  const startEditRate = (k: KeyListRow) => {
    setEditingRateId(k.id);
    setEditingRateValue(String(k.rate_limit_per_minute));
  };

  const cancelEditRate = () => {
    setEditingRateId(null);
    setEditingRateValue("");
  };

  const saveEditRate = async (id: string) => {
    const parsed = Number.parseInt(editingRateValue, 10);
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100000) {
      toast.error("Rate limit must be between 0 and 100000");
      return;
    }
    setSavingRate(true);
    try {
      const { key } = await keysApi.updateRateLimit(id, parsed);
      setKeys((prev) => prev.map((k) => (k.id === id ? { ...k, rate_limit_per_minute: key.rate_limit_per_minute } : k)));
      toast.success("Rate limit updated");
      cancelEditRate();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to update rate limit");
    } finally {
      setSavingRate(false);
    }
  };

  const closeDialog = () => {
    setOpen(false);
    setCreatedPlaintext(null);
    setName("");
  };

  return (
    <>
      <PageHeader
        title="API Keys"
        description="Issue, scope, and revoke keys for your customers."
        actions={
          <Button
            onClick={openCreate}
            className="bg-gradient-primary text-primary-foreground shadow-[var(--shadow-glow)]"
          >
            <Plus className="h-4 w-4" /> Generate key
          </Button>
        }
      />

      {loading ? (
        <>
          <SkeletonStatsGrid count={4} />
          <SkeletonTable rows={5} cols={9} />
        </>
      ) : loadError ? (
        <div className="glass-card flex flex-col items-center justify-center rounded-2xl px-6 py-16 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
            <KeyRound className="h-6 w-6 text-destructive" />
          </div>
          <h3 className="font-display text-lg font-semibold">Failed to load</h3>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">{loadError}</p>
          <Button onClick={load} className="mt-6 gap-2 bg-gradient-primary text-primary-foreground">
            <RefreshCw className="h-4 w-4" /> Retry
          </Button>
        </div>
      ) : apis.length === 0 ? (
        <EmptyState
          icon={KeyRound}
          title="No APIs registered"
          description="Register an API first, then generate keys to share with customers."
          action={
            <Link to="/apis">
              <Button className="bg-gradient-primary text-primary-foreground">
                Go to APIs
              </Button>
            </Link>
          }
        />
      ) : (
        <>
          {/* Key stats cards */}
          <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="glass-card rounded-xl p-4">
              <div className="text-xs text-muted-foreground">Total Keys</div>
              <div className="mt-1 font-display text-2xl font-bold">{keys.length}</div>
            </div>
            <div className="glass-card rounded-xl p-4">
              <div className="text-xs text-muted-foreground">Active</div>
              <div className="mt-1 font-display text-2xl font-bold text-primary">
                {keys.filter((k) => statusOf(k) === "active").length}
              </div>
            </div>
            <div className="glass-card rounded-xl p-4">
              <div className="text-xs text-muted-foreground">Revoked</div>
              <div className="mt-1 font-display text-2xl font-bold text-destructive">
                {keys.filter((k) => statusOf(k) === "revoked").length}
              </div>
            </div>
            <div className="glass-card rounded-xl p-4">
              <div className="text-xs text-muted-foreground">Last Used</div>
              <div className="mt-1 font-display text-2xl font-bold text-amber-500">
                {lastUsed}
              </div>
            </div>
          </div>

          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, prefix, or API…"
                className="pl-9"
              />
            </div>
            <Select value={envFilter} onValueChange={(v) => setEnvFilter(v as EnvFilter)}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All environments</SelectItem>
                <SelectItem value="live">Live</SelectItem>
                <SelectItem value="test">Test</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={statusFilter}
              onValueChange={(v) => setStatusFilter(v as StatusFilter)}
            >
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="revoked">Revoked</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {filteredKeys.length === 0 ? (
            <EmptyState
              icon={KeyRound}
              title="No matching keys"
              description="Adjust your filters or generate a new key."
            />
          ) : (
            <div className="glass-card overflow-x-auto rounded-2xl">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-border/60 bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">API</th>
                    <th className="px-4 py-3">Env</th>
                    <th className="px-4 py-3">Prefix</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Rate limit</th>
                    <th className="px-4 py-3">Expires</th>
                    <th className="px-4 py-3">Created</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredKeys.map((k) => {
                    const s = statusOf(k);
                    const isRevoked = s === "revoked";
                    return (
                      <tr
                        key={k.id}
                        className="border-b border-border/40 last:border-0"
                      >
                        <td className="px-4 py-3 font-medium">{k.name}</td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {k.api_name ?? "—"}
                        </td>
                        <td className="px-4 py-3">
                          <EnvBadge env={k.environment} />
                        </td>
                        <td className="px-4 py-3 font-mono text-xs">
                          {k.prefix}…
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge k={k} />
                        </td>
                        <td className="px-4 py-3">
                          {editingRateId === k.id ? (
                            <div className="flex items-center gap-1">
                              <Input
                                type="number"
                                min={0}
                                max={100000}
                                value={editingRateValue}
                                onChange={(e) => setEditingRateValue(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") saveEditRate(k.id);
                                  if (e.key === "Escape") cancelEditRate();
                                }}
                                className="h-8 w-20 text-xs"
                                autoFocus
                                disabled={savingRate}
                              />
                              <button
                                onClick={() => saveEditRate(k.id)}
                                disabled={savingRate}
                                className="rounded-md p-1 text-primary hover:bg-primary/10 disabled:opacity-50"
                                title="Save"
                              >
                                <Check className="h-4 w-4" />
                              </button>
                              <button
                                onClick={cancelEditRate}
                                disabled={savingRate}
                                className="rounded-md p-1 text-muted-foreground hover:bg-muted disabled:opacity-50"
                                title="Cancel"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex flex-col gap-0.5">
                              <button
                                onClick={() => !isRevoked && startEditRate(k)}
                                disabled={isRevoked}
                                className="group inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
                                title={isRevoked ? "Revoked keys cannot be edited" : "Click to edit"}
                              >
                                <span className="font-mono">
                                  {k.rate_limit_per_minute === 0
                                    ? "∞"
                                    : `${k.rate_limit_per_minute}/min`}
                                </span>
                                {!isRevoked && (
                                  <Pencil className="h-3 w-3 text-muted-foreground opacity-0 transition group-hover:opacity-100" />
                                )}
                              </button>
                              {(() => {
                                const used = recentUsage[k.id] ?? 0;
                                if (used === 0 && k.rate_limit_per_minute === 0) return null;
                                if (k.rate_limit_per_minute === 0) {
                                  return (
                                    <span className="px-2 font-mono text-[10px] text-muted-foreground">
                                      {used} in last 60s
                                    </span>
                                  );
                                }
                                const pct = Math.min(
                                  100,
                                  Math.round((used / k.rate_limit_per_minute) * 100)
                                );
                                const tone =
                                  pct >= 90
                                    ? "text-destructive"
                                    : pct >= 60
                                      ? "text-amber-500"
                                      : "text-muted-foreground";
                                return (
                                  <div className="flex items-center gap-1.5 px-2">
                                    <div className="h-1 w-16 overflow-hidden rounded-full bg-muted">
                                      <div
                                        className={`h-full rounded-full ${
                                          pct >= 90
                                            ? "bg-destructive"
                                            : pct >= 60
                                              ? "bg-amber-500"
                                              : "bg-primary"
                                        }`}
                                        style={{ width: `${pct}%` }}
                                      />
                                    </div>
                                    <span className={`font-mono text-[10px] ${tone}`}>
                                      {used}/{k.rate_limit_per_minute}
                                    </span>
                                  </div>
                                );
                              })()}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {k.expires_at
                            ? new Date(k.expires_at).toLocaleDateString()
                            : "—"}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {new Date(k.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end gap-1">
                            {!isRevoked && (
                              <button
                                onClick={() => handleToggleStatus(k)}
                                className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
                                title={
                                  k.status === "active" ? "Deactivate" : "Activate"
                                }
                              >
                                <Power className="h-4 w-4" />
                              </button>
                            )}
                            {!isRevoked && (
                              <button
                                onClick={() => handleRegenerate(k.id)}
                                className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
                                title="Regenerate"
                              >
                                <RefreshCw className="h-4 w-4" />
                              </button>
                            )}
                            {!isRevoked && (
                              <button
                                onClick={() => setRevokeId(k.id)}
                                className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
                                title="Revoke"
                              >
                                <ShieldOff className="h-4 w-4" />
                              </button>
                            )}
                            <button
                              onClick={() => handleDelete(k.id)}
                              className="rounded-md p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                              title="Delete"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : closeDialog())}>
        <DialogContent>
          {createdPlaintext ? (
            <>
              <DialogHeader>
                <DialogTitle>Your new API key</DialogTitle>
                <DialogDescription>
                  Copy this key now — you won't be able to see it again.
                </DialogDescription>
              </DialogHeader>
              <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/40 p-3">
                <code className="flex-1 break-all font-mono text-sm">
                  {createdPlaintext}
                </code>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => copyKey(createdPlaintext)}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <DialogFooter>
                <Button
                  onClick={closeDialog}
                  className="bg-gradient-primary text-primary-foreground"
                >
                  Done
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Generate API Key</DialogTitle>
                <DialogDescription>
                  Issue a new key for one of your APIs.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="space-y-2">
                  <Label>API</Label>
                  <Select
                    value={selectedApiId}
                    onValueChange={setSelectedApiId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select API" />
                    </SelectTrigger>
                    <SelectContent>
                      {apis.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Environment</Label>
                  <Select
                    value={environment}
                    onValueChange={(v) => setEnvironment(v as "test" | "live")}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="test">
                        Test — for development (mf_test_…)
                      </SelectItem>
                      <SelectItem value="live">
                        Live — for production (mf_live_…)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="key-name">Key name</Label>
                  <Input
                    id="key-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Production server"
                    required
                    maxLength={120}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="key-expires">
                    Expires at <span className="text-muted-foreground">(optional)</span>
                  </Label>
                  <Input
                    id="key-expires"
                    type="datetime-local"
                    value={expiresAt}
                    onChange={(e) => setExpiresAt(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="key-rate-limit">
                    Rate limit{" "}
                    <span className="text-muted-foreground">
                      (requests/min, 0 = unlimited)
                    </span>
                  </Label>
                  <Input
                    id="key-rate-limit"
                    type="number"
                    min={0}
                    max={100000}
                    value={rateLimit}
                    onChange={(e) => setRateLimit(e.target.value)}
                  />
                </div>
                <DialogFooter>
                  <Button type="button" variant="ghost" onClick={closeDialog}>
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={submitting || !selectedApiId}
                    className="bg-gradient-primary text-primary-foreground"
                  >
                    {submitting ? "Generating…" : "Generate key"}
                  </Button>
                </DialogFooter>
              </form>
            </>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={revokeId !== null}
        onOpenChange={(v) => !v && setRevokeId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke this API key?</AlertDialogTitle>
            <AlertDialogDescription>
              The key will stop working immediately and cannot be reactivated.
              You can regenerate a new key for the same API afterwards.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRevoke}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Revoke
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
