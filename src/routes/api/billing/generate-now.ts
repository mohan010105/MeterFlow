// Generates an invoice for the PREVIOUS calendar month for the calling user.
// Useful for testing the engine without waiting for the cron job.
import { createFileRoute } from "@tanstack/react-router";
import { getAuthedUserId } from "@/lib/api-key-server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { generateInvoiceForUser } from "@/lib/billing-server";
import { previousMonthRange } from "@/lib/billing";

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

export const Route = createFileRoute("/api/billing/generate-now")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),
      POST: async ({ request }) => {
        const userId = await getAuthedUserId(request);
        if (!userId) return json({ error: "Unauthorized" }, 401);
        try {
          const { start, end } = previousMonthRange();
          const { data: userData } = await supabaseAdmin.auth.admin.getUserById(
            userId
          );
          const email = userData?.user?.email ?? null;
          const invoice = await generateInvoiceForUser(userId, start, end, email);
          return json({ invoice }, 200);
        } catch (e) {
          console.error("generate-now failed", e);
          return json({ error: (e as Error).message }, 500);
        }
      },
    },
  },
});
