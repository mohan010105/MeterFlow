import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getAuthedUserId } from "@/lib/api-key-server";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};
function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...cors },
  });
}

export const Route = createFileRoute("/api/billing/plans")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),
      GET: async ({ request }) => {
        const userId = await getAuthedUserId(request);
        if (!userId) return json({ error: "Unauthorized" }, 401);

        const { data, error } = await supabaseAdmin
          .from("plans")
          .select("*")
          .order("created_at", { ascending: true });
        if (error) return json({ error: error.message }, 500);

        // Fetch schema to check if slug exists (optional, but we'll fallback manually)
        return json(
          {
            plans: (data ?? []).map((p: any) => ({
              ...p,
              slug: p.slug || p.name.toLowerCase().replace(/\s+/g, '-'),
              monthly_price: Number(p.monthly_price),
              overage_rate: Number(p.overage_rate),
              features: Array.isArray(p.features) ? p.features : [],
            })),
          },
          200
        );
      },
    },
  },
});
