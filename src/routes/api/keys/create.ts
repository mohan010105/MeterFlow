import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getAuthedUserId } from "@/lib/api-key-server";
import { generateApiKey, hashApiKey, keyPrefix } from "@/lib/api-key";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const Body = z.object({
  api_id: z.string().uuid(),
  name: z.string().min(1).max(120),
  environment: z.enum(["test", "live"]),
  expires_at: z.string().datetime().nullable().optional(),
  rate_limit_per_minute: z.number().int().min(0).max(100000).optional(),
});

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

export const Route = createFileRoute("/api/keys/create")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: corsHeaders }),
      POST: async ({ request }) => {
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
        if (!parsed.success) return json({ error: "Invalid payload", details: parsed.error.issues }, 400);

        // Verify the API belongs to this user.
        const { data: api, error: apiErr } = await supabaseAdmin
          .from("apis")
          .select("id, user_id")
          .eq("id", parsed.data.api_id)
          .maybeSingle();
        if (apiErr) return json({ error: "Lookup failed" }, 500);
        if (!api || api.user_id !== userId) return json({ error: "API not found" }, 404);

        const plaintext = generateApiKey(parsed.data.environment);
        const key_hash = await hashApiKey(plaintext);

        const { data: inserted, error: insErr } = await supabaseAdmin
          .from("api_keys")
          .insert({
            api_id: parsed.data.api_id,
            user_id: userId,
            owner_id: userId,
            name: parsed.data.name.trim(),
            key_hash,
            prefix: keyPrefix(plaintext),
            environment: parsed.data.environment,
            status: "active",
            expires_at: parsed.data.expires_at ?? null,
          })
          .select(
            "id, api_id, name, prefix, environment, status, created_at, expires_at"
          )
          .single();

        if (insErr || !inserted) {
          console.error("keys/create error", insErr);
          return json({ error: insErr?.message ?? "Failed to create key" }, 500);
        }

        const k: any = inserted;
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
              revoked_at: null,
              expires_at: k.expires_at,
              last_used_at: null,
              created_at: k.created_at,
              rate_limit_per_minute: 0,
              api_name: null,
            },
          },
          200
        );
      },
    },
  },
});
