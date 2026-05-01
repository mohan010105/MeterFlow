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

export const Route = createFileRoute("/api/billing/invoices")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),
      GET: async ({ request }) => {
        const userId = await getAuthedUserId(request);
        if (!userId) return json({ error: "Unauthorized" }, 401);

        const { data, error } = await supabaseAdmin
          .from("invoices")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(48);
        if (error) return json({ error: error.message }, 500);

        return json(
          {
            invoices: (data ?? []).map((i) => ({
              ...i,
              base_amount: Number(i.base_amount),
              overage_amount: Number(i.overage_amount),
              total_amount: Number(i.total_amount),
            })),
          },
          200
        );
      },
    },
  },
});
