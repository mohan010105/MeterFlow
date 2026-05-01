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

export const Route = createFileRoute("/api/payments/list")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),
      GET: async ({ request }) => {
        const userId = await getAuthedUserId(request);
        if (!userId) return json({ error: "Unauthorized" }, 401);

        const { data, error } = await supabaseAdmin
          .from("payments")
          .select(
            "id, amount, currency, status, provider_payment_id, created_at"
          )
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(50);
        if (error) return json({ error: error.message }, 500);

        return json(
          {
            payments: (data ?? []).map((p) => ({
              ...p,
              amount: Number(p.amount),
            })),
          },
          200
        );
      },
    },
  },
});
