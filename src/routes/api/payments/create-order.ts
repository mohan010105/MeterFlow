import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { getAuthedUserId } from "@/lib/api-key-server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getPlanBySlug } from "@/lib/billing-server";
import { createOrder, getPublicKeyId } from "@/lib/razorpay.server";

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

const Body = z
  .object({
    plan_slug: z.string().min(1).max(50).optional(),
    invoice_id: z.string().uuid().optional(),
  })
  .refine((v) => v.plan_slug || v.invoice_id, {
    message: "Provide plan_slug or invoice_id",
  });

export const Route = createFileRoute("/api/payments/create-order")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),
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
        if (!parsed.success)
          return json({ error: parsed.error.issues[0]?.message }, 400);

        try {
          let amount = 0;
          let receipt = "";
          let notes: Record<string, string> = { user_id: userId };
          let invoiceId: string | undefined;

          if (parsed.data.invoice_id) {
            // Pay an existing invoice (overage / past-due).
            const { data: inv } = await supabaseAdmin
              .from("invoices")
              .select("id, user_id, total_amount, status, invoice_number")
              .eq("id", parsed.data.invoice_id)
              .maybeSingle();
            if (!inv || inv.user_id !== userId)
              return json({ error: "Invoice not found" }, 404);
            if (inv.status === "paid")
              return json({ error: "Invoice already paid" }, 400);
            if (Number(inv.total_amount) <= 0)
              return json({ error: "Invoice has no balance due" }, 400);

            amount = Number(inv.total_amount);
            receipt = `inv_${inv.invoice_number}`;
            invoiceId = inv.id;
            notes = { ...notes, kind: "invoice", invoice_id: inv.id };
          } else if (parsed.data.plan_slug) {
            const planSlug = parsed.data.plan_slug;
            console.log("Selected plan:", planSlug);

            // Upgrade / one-time plan purchase (charges 1 month upfront).
            const plan = await getPlanBySlug(planSlug);
            console.log("Fetched plan:", plan);

            if (!plan) {
              console.error("Plan not found in database:", planSlug);
              return json({ error: "Something went wrong. Please try again." }, 404);
            }

            if (plan.slug === "free")
              return json({ error: "Free plan needs no payment" }, 400);
            if (plan.slug === "enterprise")
              return json(
                { error: "Contact sales for Enterprise plans" },
                400
              );

            amount = Number(plan.price || plan.monthly_price || 0);
            receipt = `plan_${plan.slug}_${Date.now()}`;
            notes = { 
              ...notes, 
              kind: "plan", 
              plan_slug: plan.slug,
              duration: (plan as any).duration || "monthly"
            };
          } else {
            return json({ error: "Bad request" }, 400);
          }

          const order = await createOrder({ amount, receipt, notes });

          // Record payment intent for audit.
          await supabaseAdmin.from("payments").insert({
            user_id: userId,
            invoice_id: invoiceId ?? null,
            provider: "razorpay",
            provider_order_id: order.id,
            amount,
            currency: "INR",
            status: "created",
            notes: notes as never,
          });

          if (invoiceId) {
            await supabaseAdmin
              .from("invoices")
              .update({ razorpay_order_id: order.id })
              .eq("id", invoiceId);
          }

          return json(
            {
              order_id: order.id,
              amount: order.amount, // paise
              currency: order.currency,
              key_id: getPublicKeyId(),
              invoice_id: invoiceId,
            },
            200
          );
        } catch (e) {
          console.error("create-order failed", e);
          return json({ error: (e as Error).message }, 500);
        }
      },
    },
  },
});
