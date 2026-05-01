import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getAuthedUserId } from "@/lib/api-key-server";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, PUT, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const Body = z.object({
  name: z.string().min(1).max(120).optional(),
  base_url: z.string().url().nullable().optional(),
  description: z.string().max(500).nullable().optional(),
  status: z.enum(["active", "inactive"]).optional(),
});

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

export const Route = createFileRoute("/api/apis/update/$id")({
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
        if (!parsed.success) return json({ error: "Invalid payload", details: parsed.error.issues }, 400);

        const updateData: any = {};
        if (parsed.data.name) updateData.name = parsed.data.name.trim();
        if (parsed.data.description !== undefined) updateData.description = parsed.data.description?.trim() || null;
        if (parsed.data.base_url !== undefined) updateData.base_url = parsed.data.base_url?.trim() || null;
        if (parsed.data.status) updateData.status = parsed.data.status;

        const { data: updated, error: updErr } = await supabaseAdmin
          .from("apis")
          .update(updateData)
          .eq("id", params.id)
          .eq("user_id", userId)
          .select()
          .single();

        if (updErr) {
          console.error("apis/update error", updErr);
          return json({ error: updErr.message }, 500);
        }

        return json({ ok: true, api: updated }, 200);
      },
    },
  },
});
