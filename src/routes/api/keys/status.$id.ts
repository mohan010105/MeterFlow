import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getAuthedUserId } from "@/lib/api-key-server";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const Body = z.object({ status: z.enum(["active", "inactive"]) });

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

export const Route = createFileRoute("/api/keys/status/$id")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: corsHeaders }),
      POST: async ({ request, params }) => {
        const userId = await getAuthedUserId(request);
        if (!userId) return json({ error: "Unauthorized" }, 401);

        let raw: unknown = {};
        try {
          const t = await request.text();
          raw = t ? JSON.parse(t) : {};
        } catch {
          return json({ error: "Invalid JSON" }, 400);
        }
        const parsed = Body.safeParse(raw);
        if (!parsed.success) return json({ error: "Invalid payload" }, 400);

        const { data, error } = await supabaseAdmin
          .from("api_keys")
          .update({ status: parsed.data.status })
          .eq("id", params.id)
          .eq("user_id", userId)
          .neq("status", "revoked")
          .select(
            "id, api_id, name, prefix, environment, status, created_at, expires_at, last_used_at, apis(name)"
          )
          .maybeSingle();

        if (error) return json({ error: error.message }, 500);
        if (!data) return json({ error: "Key not found or revoked" }, 404);

        const k: any = data;
        return json(
          {
            key: {
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
              api_name: k.apis?.name ?? null,
            },
          },
          200
        );
      },
    },
  },
});
