import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getAuthedUserId } from "@/lib/api-key-server";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};
function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...cors },
  });
}

export const Route = createFileRoute("/api/subscription/cancel")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),
      POST: async ({ request }) => {
        const userId = await getAuthedUserId(request);
        if (!userId) return json({ error: "Unauthorized" }, 401);

        // Find current paid subscription.
        const { data: existing } = await supabaseAdmin
          .from("subscriptions")
          .select("id, plan_id, status, current_period_end, plans(slug, name)")
          .eq("user_id", userId)
          .in("status", ["active", "trialing", "past_due"])
          .maybeSingle();
        if (!existing) return json({ error: "No active subscription" }, 404);

        // Free plan can't be cancelled.
        const planObj = (existing as any).plans;
        const planSlug = planObj?.slug || planObj?.name?.toLowerCase();
        if (planSlug === "free") {
          return json({ error: "Free plan cannot be cancelled" }, 400);
        }

        const { data: updated, error } = await supabaseAdmin
          .from("subscriptions")
          .update({
            cancel_at_period_end: true,
            cancelled_at: new Date().toISOString(),
          })
          .eq("id", existing.id)
          .select(
            "id, plan_id, status, current_period_start, current_period_end, cancel_at_period_end, cancelled_at, razorpay_subscription_id"
          )
          .single();
        if (error) return json({ error: error.message }, 500);

        return json({ subscription: updated }, 200);
      },
    },
  },
});
