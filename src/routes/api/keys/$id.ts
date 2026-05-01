import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getAuthedUserId } from "@/lib/api-key-server";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

export const Route = createFileRoute("/api/keys/$id")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: corsHeaders }),
      DELETE: async ({ request, params }) => {
        const userId = await getAuthedUserId(request);
        if (!userId) return json({ error: "Unauthorized" }, 401);

        const { error } = await supabaseAdmin
          .from("api_keys")
          .delete()
          .eq("id", params.id)
          .eq("user_id", userId);

        if (error) return json({ error: error.message }, 500);
        return json({ ok: true }, 200);
      },
    },
  },
});
