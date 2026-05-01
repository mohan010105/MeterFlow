import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getAuthedUserId } from "@/lib/api-key-server";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

export const Route = createFileRoute("/api/apis/list")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: corsHeaders }),
      GET: async ({ request }) => {
        const userId = await getAuthedUserId(request);
        if (!userId) return json({ error: "Unauthorized" }, 401);

        // Fetch APIs
        const { data: apisData, error: apisErr } = await supabaseAdmin
          .from("apis")
          .select("id, name, description, base_url, status, created_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: false });

        if (apisErr) {
          console.error("apis/list error", apisErr);
          return json({ error: "Failed to load APIs" }, 500);
        }

        // Fetch all user keys to compute counts
        const { data: keysData } = await supabaseAdmin
          .from("api_keys")
          .select("id, api_id")
          .eq("user_id", userId);

        // Fetch total request logs per user API
        const { data: usageData } = await supabaseAdmin
          .from("usage_logs")
          .select("id, api_id")
          .eq("user_id", userId);

        const keyCountMap: Record<string, number> = {};
        for (const k of keysData ?? []) {
          keyCountMap[k.api_id] = (keyCountMap[k.api_id] ?? 0) + 1;
        }

        const usageCountMap: Record<string, number> = {};
        for (const u of usageData ?? []) {
          if (u.api_id) usageCountMap[u.api_id] = (usageCountMap[u.api_id] ?? 0) + 1;
        }

        const apis = (apisData ?? []).map((a: any) => ({
          ...a,
          key_count: keyCountMap[a.id] ?? 0,
          total_requests: usageCountMap[a.id] ?? 0,
        }));

        return json({ apis }, 200);
      },
    },
  },
});
