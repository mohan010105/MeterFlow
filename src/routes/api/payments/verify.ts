import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { getAuthedUserId } from "@/lib/api-key-server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { verifyPaymentSignature } from "@/lib/razorpay.server";
import { getPlanBySlug } from "@/lib/billing-server";

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

const Body = z.object({
  razorpay_order_id: z.string().min(5).max(100),
  razorpay_payment_id: z.string().min(5).max(100),
  razorpay_signature: z.string().min(20).max(200),
});

export const Route = createFileRoute("/api/payments/verify")({
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
        if (!parsed.success) return json({ error: "Bad request" }, 400);

        const { razorpay_order_id, razorpay_payment_id, razorpay_signature } =
          parsed.data;

        const ok = verifyPaymentSignature({
          order_id: razorpay_order_id,
          payment_id: razorpay_payment_id,
          signature: razorpay_signature,
        });
        if (!ok) return json({ error: "Invalid signature" }, 400);

        console.log("Verifying payment for order:", razorpay_order_id);

        // Look up our payment intent (created by /create-order).
        const { data: payment } = await supabaseAdmin
          .from("payments")
          .select("id, user_id, amount, invoice_id, notes")
          .eq("provider_order_id", razorpay_order_id)
          .maybeSingle();
        
        console.log("Payment record found:", payment);
        if (!payment || payment.user_id !== userId)
          return json({ error: "Payment record not found" }, 404);

        // Mark payment captured + persist signature.
        await supabaseAdmin
          .from("payments")
          .update({
            status: "captured",
            provider_payment_id: razorpay_payment_id,
            provider_signature: razorpay_signature,
          })
          .eq("id", payment.id);

        const notes = (payment.notes as Record<string, string> | null) ?? {};
        let updatedSubscription: unknown = null;
        let updatedInvoice: unknown = null;

        if (notes.kind === "invoice" && payment.invoice_id) {
          const { data: inv } = await supabaseAdmin
            .from("invoices")
            .update({
              status: "paid",
              paid_at: new Date().toISOString(),
              razorpay_payment_id,
            })
            .eq("id", payment.invoice_id)
            .select("*")
            .single();
          updatedInvoice = inv;
        } else if (notes.kind === "plan" && notes.plan_slug) {
          const plan = await getPlanBySlug(notes.plan_slug);
          if (plan) {
            // Upsert active subscription onto this plan.
            const { data: existing } = await supabaseAdmin
              .from("subscriptions")
              .select("id")
              .eq("user_id", userId)
              .in("status", ["active", "trialing", "past_due", "pending"])
              .maybeSingle();

            const periodStart = new Date();
            const periodEnd = new Date(periodStart);
            const duration = notes.duration || "monthly";
            
            if (duration === "yearly" || duration === "annual") {
              periodEnd.setFullYear(periodEnd.getFullYear() + 1);
            } else if (duration === "6 months" || duration === "6m") {
              periodEnd.setMonth(periodEnd.getMonth() + 6);
            } else {
              periodEnd.setMonth(periodEnd.getMonth() + 1);
            }

            if (existing) {
              console.log("Updating existing subscription:", existing.id);
              const { data: sub } = await supabaseAdmin
                .from("subscriptions")
                .update({
                  plan_id: plan.id,
                  status: "active",
                  current_period_start: periodStart.toISOString(),
                  current_period_end: periodEnd.toISOString(),
                  cancel_at_period_end: false,
                  cancelled_at: null,
                })
                .eq("id", existing.id)
                .select("*")
                .single();
              updatedSubscription = sub;
            } else {
              console.log("Creating new subscription for user:", userId);
              const { data: sub } = await supabaseAdmin
                .from("subscriptions")
                .insert({
                  user_id: userId,
                  plan_id: plan.id,
                  status: "active",
                  current_period_start: periodStart.toISOString(),
                  current_period_end: periodEnd.toISOString(),
                })
                .select("*")
                .single();
              updatedSubscription = sub;
            }
            console.log("Subscription activated:", updatedSubscription);

            // Create a "paid" invoice for this initial plan purchase.
            try {
              const invNum = `INV-UPG-${Date.now().toString(36).toUpperCase()}`;
              await supabaseAdmin.from("invoices").insert({
                user_id: userId,
                subscription_id: updatedSubscription.id,
                plan_id: plan.id,
                invoice_number: invNum,
                period_start: periodStart.toISOString(),
                period_end: periodEnd.toISOString(),
                amount: payment.amount,
                total_amount: payment.amount,
                status: "paid",
                paid_at: new Date().toISOString(),
                razorpay_order_id,
                razorpay_payment_id,
              });
              console.log("Initial upgrade invoice created");
            } catch (invErr) {
              console.error("Failed to create initial invoice:", invErr);
            }
          }
        }

        return json(
          { ok: true, subscription: updatedSubscription, invoice: updatedInvoice },
          200
        );
      },
    },
  },
});
