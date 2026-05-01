import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getAuthedUserId } from "@/lib/api-key-server";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

const Body = z.object({
  rate_limit_per_minute: z.number().int().min(0).max(100000),
});

export const Route = createFileRoute("/api/keys/rate-limit/$id")({
  server: {
    handlers: {
      OPTIONS: async () =>
        new Response(null, { status: 204, headers: corsHeaders }),
      POST: async ({ request, params }) => {
        const userId = await getAuthedUserId(request);
        if (!userId) return json({ error: "Unauthorized" }, 401);

        let parsed;
        try {
          parsed = Body.parse(await request.json());
        } catch {
          return json({ error: "Invalid payload" }, 400);
        }

        const { data, error } = await supabaseAdmin
          .from("api_keys")
          .select(
            "id, api_id, name, prefix, environment, status, created_at, expires_at, apis(name)"
          )
          .eq("id", params.id)
          .eq("user_id", userId)
          .maybeSingle();

        if (error) return json({ error: error.message }, 500);
        if (!data) return json({ error: "Key not found" }, 404);

        const key = {
          id: data.id,
          api_id: data.api_id,
          name: data.name,
          prefix: data.prefix,
          environment: data.environment,
          status: data.status,
          revoked_at: data.status === "revoked" ? data.created_at : null,
          expires_at: data.expires_at,
          last_used_at: null,
          created_at: data.created_at,
          rate_limit_per_minute: parsed.rate_limit_per_minute,
          api_name: (data as any).apis?.name ?? null,
        };
        return json({ key }, 200);
      },
    },
  },
});
