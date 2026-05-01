import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getAuthedUserId } from "@/lib/api-key-server";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const Body = z.object({
  name: z.string().min(1).max(120),
  base_url: z.string().url().nullable().optional(),
  description: z.string().max(500).nullable().optional(),
  category: z.string().max(50).optional(),
  version: z.string().max(20).optional(),
  status: z.enum(["active", "inactive"]).optional().default("active"),
});

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

export const Route = createFileRoute("/api/apis/create")({
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

        const { data: inserted, error: insErr } = await supabaseAdmin
          .from("apis")
          .insert({
            user_id: userId,
            owner_id: userId,
            name: parsed.data.name.trim(),
            description: parsed.data.description?.trim() || null,
            base_url: parsed.data.base_url?.trim() || null,
            status: parsed.data.status,
          })
          .select()
          .single();

        if (insErr || !inserted) {
          console.error("apis/create error", insErr);
          return json({ error: insErr?.message ?? "Failed to create API" }, 500);
        }

        return json({ ok: true, api: inserted }, 200);
      },
    },
  },
});
