// Server cron entry point. Called by pg_cron via pg_net on the 1st of each month.
// Generates invoices for the PREVIOUS calendar month for every user with an
// active subscription. Idempotent.
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { generateInvoiceForUser } from "@/lib/billing-server";
import { previousMonthRange } from "@/lib/billing";

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const Route = createFileRoute("/hooks/generate-invoices")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Lightweight bearer-anon auth so random callers can't trigger jobs.
        const auth = request.headers.get("authorization");
        const expected = `Bearer ${process.env.SUPABASE_ANON_KEY ?? process.env.SUPABASE_PUBLISHABLE_KEY ?? ""}`;
        if (!auth || auth !== expected) {
          return json({ error: "Unauthorized" }, 401);
        }

        const { start, end } = previousMonthRange();
        const { data: profiles, error } = await supabaseAdmin
          .from("profiles")
          .select("id");
        if (error) return json({ error: error.message }, 500);

        const userIds = Array.from(
          new Set((profiles ?? []).map((p) => p.id as string))
        );

        let created = 0;
        let failed = 0;
        for (const userId of userIds) {
          try {
            const { data: userData } =
              await supabaseAdmin.auth.admin.getUserById(userId);
            const email = userData?.user?.email ?? null;
            await generateInvoiceForUser(userId, start, end, email);
            created++;
          } catch (e) {
            console.error("invoice gen failed for", userId, e);
            failed++;
          }
        }

        return json(
          {
            ok: true,
            period_start: start.toISOString(),
            period_end: end.toISOString(),
            users: userIds.length,
            created,
            failed,
          },
          200
        );
      },
    },
  },
});
