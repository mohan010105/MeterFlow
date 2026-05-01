import { createFileRoute } from "@tanstack/react-router";
import { extractApiKey, validateApiKey } from "@/lib/api-key-server";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-api-key",
};

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

async function handle(request: Request) {
  const apiKey = extractApiKey(request);
  try {
    const result = await validateApiKey(apiKey);
    if (!result.ok) {
      return json({ valid: false, reason: result.reason }, result.status);
    }
    return json(
      {
        valid: true,
        environment: result.key.environment,
        api_id: result.key.api_id,
      },
      200
    );
  } catch (err) {
    console.error("keys/validate error", err);
    return json({ valid: false, reason: "internal" }, 500);
  }
}

export const Route = createFileRoute("/api/keys/validate")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: corsHeaders }),
      GET: async ({ request }) => handle(request),
      POST: async ({ request }) => handle(request),
    },
  },
});
