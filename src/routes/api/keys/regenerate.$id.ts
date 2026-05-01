import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getAuthedUserId } from "@/lib/api-key-server";
import { generateApiKey, hashApiKey, keyPrefix } from "@/lib/api-key";

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

export const Route = createFileRoute("/api/keys/regenerate/$id")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: corsHeaders }),
      POST: async ({ request, params }) => {
        const userId = await getAuthedUserId(request);
        if (!userId) return json({ error: "Unauthorized" }, 401);

        const { data: existing, error: lookupErr } = await supabaseAdmin
          .from("api_keys")
          .select("id, environment")
          .eq("id", params.id)
          .eq("user_id", userId)
          .maybeSingle();
        if (lookupErr) return json({ error: lookupErr.message }, 500);
        if (!existing) return json({ error: "Key not found" }, 404);

        const env = (existing.environment as "test" | "live") ?? "live";
        const plaintext = generateApiKey(env);
        const key_hash = await hashApiKey(plaintext);

        const { data, error } = await supabaseAdmin
          .from("api_keys")
          .update({
            key_hash,
            prefix: keyPrefix(plaintext),
            status: "active",
          })
          .eq("id", params.id)
          .eq("user_id", userId)
          .select(
            "id, api_id, name, prefix, environment, status, created_at, expires_at, last_used_at, apis(name)"
          )
          .single();

        if (error || !data) return json({ error: error?.message ?? "Failed" }, 500);

        const k: any = data;
        return json(
          {
            plaintext,
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
