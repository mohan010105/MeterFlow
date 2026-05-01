import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const Route = createFileRoute("/api/auth/confirm")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const { userId } = await request.json();
          if (!userId) {
            return Response.json({ error: "User ID is required" }, { status: 400 });
          }

          // Confirm user in Supabase via Admin API
          const { data, error } = await supabaseAdmin.auth.admin.updateUserById(
            userId,
            { email_confirm: true }
          );

          if (error) {
            return Response.json({ error: error.message }, { status: 500 });
          }

          return Response.json({ success: true, user: data.user });
        } catch (err) {
          const message = err instanceof Error ? err.message : "Internal server error";
          return Response.json({ error: message }, { status: 500 });
        }
      },
    },
  },
});
