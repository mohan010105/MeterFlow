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

export const Route = createFileRoute("/api/keys/list")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: corsHeaders }),
      GET: async ({ request }) => {
        const userId = await getAuthedUserId(request);
        if (!userId) return json({ error: "Unauthorized" }, 401);

        const { data, error } = await supabaseAdmin
          .from("api_keys")
          .select(
            "id, api_id, name, prefix, environment, status, created_at, expires_at, last_used_at, apis(name)"
          )
          .eq("user_id", userId)
          .order("created_at", { ascending: false });

        if (error) {
          console.error("keys/list error", error);
          return json({ error: "Failed to load keys" }, 500);
        }

        const keys = (data ?? []).map((k: any) => ({
          id: k.id,
          api_id: k.api_id,
          name: k.name,
          prefix: k.prefix,
          environment: k.environment,
          status: k.status,
          revoked_at: k.status === "revoked" ? k.created_at : null,
          expires_at: k.expires_at,
          last_used_at: k.last_used_at ?? null,
          created_at: k.created_at,
          rate_limit_per_minute: 0,
          api_name: k.apis?.name ?? null,
        }));

        return json({ keys }, 200);
      },
    },
  },
});
