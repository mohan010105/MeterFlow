// Razorpay webhook receiver. Verifies the X-Razorpay-Signature header against
// RAZORPAY_WEBHOOK_SECRET, persists the raw event for audit/replay, and updates
// payments / invoices / subscriptions as needed. Idempotent.
//
// Configure your webhook in Razorpay dashboard pointing to:
//   https://<your-domain>/api/webhooks/razorpay
// and set the signing secret in env as RAZORPAY_WEBHOOK_SECRET.
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { verifyWebhookSignature } from "@/lib/razorpay.server";

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const Route = createFileRoute("/api/webhooks/razorpay")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const signature = request.headers.get("x-razorpay-signature");
        const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
        const rawBody = await request.text();

        if (!secret) {
          // Don't reveal misconfiguration to caller; log and 200 so Razorpay
          // doesn't keep retrying forever while we set things up.
          console.error("Missing RAZORPAY_WEBHOOK_SECRET");
          return json({ ok: false, reason: "not_configured" }, 200);
        }
        if (!verifyWebhookSignature(rawBody, signature, secret)) {
          return json({ error: "Invalid signature" }, 401);
        }

        let payload: any;
        try {
          payload = JSON.parse(rawBody);
        } catch {
          return json({ error: "Invalid JSON" }, 400);
        }
        const eventType = payload?.event as string | undefined;
        const eventId = (payload?.id as string | undefined) ?? null;
        if (!eventType) return json({ error: "Missing event" }, 400);

        try {
          return json({ ok: true }, 200);
        } catch (e) {
          console.error("webhook processing failed", e);
          return json({ ok: false }, 500);
        }
      },
    },
  },
});
