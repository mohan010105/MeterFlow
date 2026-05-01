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

export const Route = createFileRoute("/api/billing/invoice-pdf/$id")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),
      GET: async ({ request, params }) => {
        const userId = await getAuthedUserId(request);
        if (!userId) return json({ error: "Unauthorized" }, 401);

        const { data: inv, error } = await supabaseAdmin
          .from("invoices")
          .select("id, user_id, pdf_path")
          .eq("id", params.id)
          .maybeSingle();
        if (error) return json({ error: error.message }, 500);
        if (!inv || inv.user_id !== userId)
          return json({ error: "Not found" }, 404);
        if (!inv.pdf_path)
          return json({ error: "PDF not yet generated" }, 404);

        const { data: signed, error: signErr } = await supabaseAdmin.storage
          .from("invoices")
          .createSignedUrl(inv.pdf_path, 60 * 5); // 5 minutes
        if (signErr || !signed)
          return json({ error: "Failed to sign URL" }, 500);

        return json({ url: signed.signedUrl }, 200);
      },
    },
  },
});
