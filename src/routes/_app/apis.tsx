import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Boxes,
  Copy,
  Edit2,
  ExternalLink,
  KeyRound,
  Plus,
  Power,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { SkeletonStatsGrid, SkeletonCardGrid } from "@/components/LoadingSkeleton";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/auth";
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
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

interface ApiRow {
  id: string;
  name: string;
  description: string | null;
  base_url: string | null;
  status: string;
  created_at: string;
  category?: string | null;
  version?: string | null;
  key_count?: number;
  total_requests?: number;
}

export const Route = createFileRoute("/_app/apis")({
  head: () => ({ meta: [{ title: "APIs — MeterFlow" }] }),
  component: ApisPage,
});

function ApisPage() {
  const { user } = useAuth();
  const [apis, setApis] = useState<ApiRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create / Edit modal
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [category, setCategory] = useState("");
  const [version, setVersion] = useState("v1");
  const [submitting, setSubmitting] = useState(false);

  // Delete confirmation
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Search / Filter
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 6;

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterStatus]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: apisData, error: apisErr } = await supabase
        .from("apis")
        .select("id, name, description, base_url, status, created_at, category, version")
        .order("created_at", { ascending: false });
      
      if (apisErr) {
        setError("Failed to load APIs: " + apisErr.message);
        setApis([]);
        setLoading(false);
        return;
      }

      const { data: keysData } = await supabase
        .from("api_keys")
        .select("api_id");

      const keyCountMap: Record<string, number> = {};
      for (const k of keysData ?? []) {
        keyCountMap[k.api_id] = (keyCountMap[k.api_id] ?? 0) + 1;
      }

      const { data: usageData } = await supabase
        .from("usage_logs")
        .select("api_id");

      const usageCountMap: Record<string, number> = {};
      for (const u of usageData ?? []) {
        if (u.api_id) usageCountMap[u.api_id] = (usageCountMap[u.api_id] ?? 0) + 1;
      }

      setApis(
        (apisData ?? []).map((a: any) => ({
          ...a,
          key_count: keyCountMap[a.id] ?? 0,
          total_requests: usageCountMap[a.id] ?? 0,
        }))
      );
    } catch (err) {
      setError("Failed to load APIs. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) load();
  }, [user]);

  const openCreate = () => {
    setEditingId(null);
    setName("");
    setDescription("");
    setBaseUrl("");
    setCategory("");
    setVersion("v1");
    setOpen(true);
  };

  const openEdit = (api: ApiRow) => {
    setEditingId(api.id);
    setName(api.name);
    setDescription(api.description ?? "");
    setBaseUrl(api.base_url ?? "");
    setCategory(api.category ?? "");
    setVersion(api.version ?? "v1");
    setOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const trimmedName = name.trim();
    const trimmedBaseUrl = baseUrl.trim();

    if (!trimmedName || !trimmedBaseUrl) {
      toast.error("API Name and Base URL are required");
      return;
    }

    setSubmitting(true);

    const payload = {
      name: trimmedName,
      description: description.trim() || null,
      base_url: trimmedBaseUrl,
      category: category.trim() || null,
      version: version.trim() || 'v1',
    };

    if (editingId) {
      const { error } = await supabase
        .from("apis")
        .update(payload)
        .eq("id", editingId);
      setSubmitting(false);
      if (error) {
        toast.error("Failed to update API: " + error.message);
        return;
      }
      toast.success("API updated");
    } else {
      const { error } = await supabase.from("apis").insert({
        ...payload,
        user_id: user.id,
        owner_id: user.id,
        status: "active",
      } as any);
      setSubmitting(false);
      if (error) {
        toast.error("Failed to create API: " + error.message);
        return;
      }
      toast.success("API created successfully!");
    }

    setOpen(false);
    setEditingId(null);
    setName("");
    setDescription("");
    setBaseUrl("");
    setCategory("");
    setVersion("v1");
    load();
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from("apis").delete().eq("id", deleteId);
    if (error) {
      toast.error("Failed to delete API: " + error.message);
      return;
    }
    toast.success("API deleted");
    setDeleteId(null);
    load();
  };

  const handleToggleStatus = async (api: ApiRow) => {
    const next = api.status === "active" ? "inactive" : "active";
    const { error } = await supabase
      .from("apis")
      .update({ status: next })
      .eq("id", api.id);
    if (error) {
      toast.error("Failed to update status: " + error.message);
      return;
    }
    toast.success(`API ${next === "active" ? "activated" : "deactivated"}`);
    load();
  };

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`Copied ${label}`);
    } catch {
      toast.error("Failed to copy to clipboard");
    }
  };

  const getTrackEndpoint = (apiId: string) =>
    `${window.location.origin}/api/track`;

  const filteredApis = apis.filter((api) => {
    const matchesSearch = 
      api.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      (api.base_url || "").toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = 
      filterStatus === "all" || api.status === filterStatus;

    return matchesSearch && matchesStatus;
  });

  const totalPages = Math.ceil(filteredApis.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedApis = filteredApis.slice(startIndex, startIndex + pageSize);

  return (
    <>
      <PageHeader
        title="APIs"
        description="Register and manage the APIs you want to meter."
        actions={
          <Button
            onClick={openCreate}
            className="bg-gradient-primary text-primary-foreground shadow-[var(--shadow-glow)]"
          >
            <Plus className="h-4 w-4" /> New API
          </Button>
        }
      />

      {loading ? (
        <>
          <SkeletonStatsGrid count={4} />
          <SkeletonCardGrid count={3} />
        </>
      ) : error ? (
        <div className="glass-card flex flex-col items-center justify-center rounded-2xl px-6 py-16 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
            <Boxes className="h-6 w-6 text-destructive" />
          </div>
          <h3 className="font-display text-lg font-semibold">Failed to load</h3>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">{error}</p>
          <Button
            onClick={load}
            className="mt-6 gap-2 bg-gradient-primary text-primary-foreground"
          >
            <RefreshCw className="h-4 w-4" /> Retry
          </Button>
        </div>
      ) : apis.length === 0 ? (
        <EmptyState
          icon={Boxes}
          title="No APIs registered yet"
          description="Register your first API to start issuing keys and metering requests."
          action={
            <Button
              onClick={openCreate}
              className="bg-gradient-primary text-primary-foreground"
            >
              <Plus className="h-4 w-4" /> Create API
            </Button>
          }
        />
      ) : (
        <>
          {/* Search & Filter bar */}
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1 max-w-md">
              <Input
                type="text"
                placeholder="Search APIs by name or URL..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-muted/30"
              />
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="status-filter" className="text-xs text-muted-foreground">Status:</Label>
              <select
                id="status-filter"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="rounded-md border border-border bg-background px-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="all">All</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>

          {/* Summary stats */}
          <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-5">
            <div className="glass-card rounded-xl p-4">
              <div className="text-xs text-muted-foreground">Total APIs</div>
              <div className="mt-1 font-display text-2xl font-bold">
                {apis.length}
              </div>
            </div>
            <div className="glass-card rounded-xl p-4">
              <div className="text-xs text-muted-foreground">Active</div>
              <div className="mt-1 font-display text-2xl font-bold text-primary">
                {apis.filter((a) => a.status === "active").length}
              </div>
            </div>
            <div className="glass-card rounded-xl p-4">
              <div className="text-xs text-muted-foreground">Inactive</div>
              <div className="mt-1 font-display text-2xl font-bold text-muted-foreground">
                {apis.filter((a) => a.status !== "active").length}
              </div>
            </div>
            <div className="glass-card rounded-xl p-4">
              <div className="text-xs text-muted-foreground">Total Keys</div>
              <div className="mt-1 font-display text-2xl font-bold">
                {apis.reduce((sum, a) => sum + (a.key_count ?? 0), 0)}
              </div>
            </div>
            <div className="glass-card rounded-xl p-4">
              <div className="text-xs text-muted-foreground">Total Requests</div>
              <div className="mt-1 font-display text-2xl font-bold text-primary">
                {apis.reduce((sum, a) => sum + (a.total_requests ?? 0), 0)}
              </div>
            </div>
          </div>

          {/* API cards */}
          {paginatedApis.length === 0 ? (
            <div className="glass-card flex flex-col items-center justify-center rounded-2xl p-12 text-center">
              <Boxes className="h-10 w-10 text-muted-foreground/60" />
              <h3 className="mt-4 font-display text-lg font-semibold">No APIs found</h3>
              <p className="mt-1 text-sm text-muted-foreground">Try adjusting your search or filter settings.</p>
            </div>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {paginatedApis.map((api) => (
                  <div
                    key={api.id}
                    className="glass-card group flex flex-col rounded-2xl p-5 transition-shadow hover:shadow-[var(--shadow-glow)]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-primary">
                        <Boxes className="h-5 w-5 text-primary-foreground" />
                      </div>
                      <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                        <button
                          onClick={() => openEdit(api)}
                          className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
                          title="Edit API"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleToggleStatus(api)}
                          className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
                          title={
                            api.status === "active" ? "Deactivate" : "Activate"
                          }
                        >
                          <Power className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setDeleteId(api.id)}
                          className="rounded-md p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                          title="Delete API"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    <div className="mt-4 flex items-center gap-2">
                      <h3 className="font-display text-lg font-semibold">
                        {api.name}
                      </h3>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          api.status === "active"
                            ? "bg-primary/10 text-primary"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {api.status}
                      </span>
                    </div>

                    {api.description && (
                      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                        {api.description}
                      </p>
                    )}

                    {/* Base URL with copy */}
                    {api.base_url && (
                      <div className="mt-2 flex items-center gap-2">
                        <code className="flex-1 truncate rounded bg-muted/50 px-2 py-1 text-xs font-mono text-muted-foreground">
                          {api.base_url}
                        </code>
                        <button
                          onClick={() => copyToClipboard(api.base_url!, "API URL")}
                          className="shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                          title="Copy API URL"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}

                    {/* Track endpoint with copy */}
                    <div className="mt-2 flex items-center gap-2">
                      <code className="flex-1 truncate rounded bg-muted/50 px-2 py-1 text-xs font-mono text-muted-foreground">
                        {getTrackEndpoint(api.id)}
                      </code>
                      <button
                        onClick={() => copyToClipboard(getTrackEndpoint(api.id), "Track endpoint")}
                        className="shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                        title="Copy Track Endpoint"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    {/* Category & Version */}
                    <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                      {api.category && (
                        <span className="rounded bg-muted/40 px-2 py-0.5">
                          Category: {api.category}
                        </span>
                      )}
                      <span className="rounded bg-muted/40 px-2 py-0.5">
                        Version: {api.version || "v1"}
                      </span>
                    </div>

                    <div className="mt-4 flex items-center justify-between border-t border-border/60 pt-4 text-xs text-muted-foreground">
                      <div className="flex flex-wrap items-center gap-3">
                        <span>
                          {new Date(api.created_at).toLocaleDateString()}
                        </span>
                        <span className="flex items-center gap-1">
                          <KeyRound className="h-3 w-3" />
                          {api.key_count ?? 0} keys
                        </span>
                        <span className="flex items-center gap-1 rounded-full bg-primary/5 px-1.5 py-0.5 text-primary">
                          {api.total_requests ?? 0} reqs
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Link
                          to="/usage"
                          className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                        >
                          <ExternalLink className="h-3 w-3" /> Analytics
                        </Link>
                        <Link
                          to="/keys"
                          search={{ apiId: api.id }}
                          className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                        >
                          <ExternalLink className="h-3 w-3" /> Keys
                        </Link>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="mt-6 flex items-center justify-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    Previous
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Page {currentPage} of {totalPages}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                  >
                    Next
                  </Button>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Edit API" : "New API"}
            </DialogTitle>
            <DialogDescription>
              {editingId
                ? "Update your API details."
                : "Give your API a name, required URL, and description."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="api-name">Name</Label>
              <Input
                id="api-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Payments API"
                required
                maxLength={120}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="api-base-url">Base URL</Label>
              <Input
                id="api-base-url"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="https://api.example.com"
                type="url"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="api-category">Category (optional)</Label>
                <Input
                  id="api-category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="AI, Payments, etc."
                  maxLength={50}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="api-version">Version</Label>
                <Input
                  id="api-version"
                  value={version}
                  onChange={(e) => setVersion(e.target.value)}
                  placeholder="v1"
                  maxLength={20}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="api-description">Description</Label>
              <Textarea
                id="api-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What does this API do?"
                maxLength={500}
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={submitting}
                className="bg-gradient-primary text-primary-foreground"
              >
                {submitting
                  ? editingId
                    ? "Saving…"
                    : "Creating…"
                  : editingId
                    ? "Save Changes"
                    : "Create API"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={deleteId !== null}
        onOpenChange={(v) => !v && setDeleteId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this API?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. All keys and usage statistics linked
              to this API will be deleted permanently.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
