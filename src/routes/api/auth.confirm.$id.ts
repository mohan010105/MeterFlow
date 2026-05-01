import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

export const Route = createFileRoute("/api/auth/confirm/$id")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: corsHeaders }),
      POST: async ({ params }) => {
        const { data, error } = await supabaseAdmin.auth.admin.updateUserById(
          params.id,
          { email_confirm: true }
        );

        if (error) {
          console.error("auth/confirm error", error);
          return json({ error: error.message }, 500);
        }

        return json({ ok: true, user: data.user }, 200);
      },
    },
  },
});
