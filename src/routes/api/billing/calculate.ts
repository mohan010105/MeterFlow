import { createFileRoute } from "@tanstack/react-router";
import { getAuthedUserId } from "@/lib/api-key-server";
import { buildCurrentSummary } from "@/lib/billing-server";

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

export const Route = createFileRoute("/api/billing/calculate")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),
      GET: async ({ request }) => {
        const userId = await getAuthedUserId(request);
        if (!userId) return json({ error: "Unauthorized" }, 401);
        try {
          const summary = await buildCurrentSummary(userId);
          return json(summary, 200);
        } catch (e) {
          console.error("billing/calculate failed", e);
          return json({ error: "Failed to calculate billing" }, 500);
        }
      },
    },
  },
});
