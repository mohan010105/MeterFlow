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

export const Route = createFileRoute("/api/apis/details/$id")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: corsHeaders }),
      GET: async ({ request, params }) => {
        const userId = await getAuthedUserId(request);
        if (!userId) return json({ error: "Unauthorized" }, 401);

        const { data: api, error: apiErr } = await supabaseAdmin
          .from("apis")
          .select("id, name, description, base_url, status, created_at")
          .eq("id", params.id)
          .eq("user_id", userId)
          .maybeSingle();

        if (apiErr) return json({ error: apiErr.message }, 500);
        if (!api) return json({ error: "API not found" }, 404);

        return json({ api }, 200);
      },
    },
  },
});
