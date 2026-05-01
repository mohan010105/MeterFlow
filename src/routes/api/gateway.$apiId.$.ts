import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { extractApiKey, validateApiKey } from "@/lib/api-key-server";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-api-key",
};

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

export const Route = createFileRoute("/api/gateway/$apiId/$")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: corsHeaders }),
      GET: async ({ request, params }) => handleProxy(request, params.apiId, params._),
      POST: async ({ request, params }) => handleProxy(request, params.apiId, params._),
      PUT: async ({ request, params }) => handleProxy(request, params.apiId, params._),
      DELETE: async ({ request, params }) => handleProxy(request, params.apiId, params._),
      PATCH: async ({ request, params }) => handleProxy(request, params.apiId, params._),
    },
  },
});

async function handleProxy(request: Request, apiId: string, wildcardPath: string) {
  const apiKey = extractApiKey(request);
  const validation = await validateApiKey(apiKey).catch(() => null);

  if (!validation) return jsonResponse({ error: "Internal error" }, 500);
  if (!validation.ok) return jsonResponse({ error: validation.reason }, validation.status);

  const keyRow = validation.key;

  // Enforce API ownership access
  if (keyRow.api_id !== apiId) {
    return jsonResponse({ error: "API key does not belong to this API" }, 403);
  }

  // Rate limiting
  if (keyRow.rate_limit_per_minute > 0) {
    const sinceIso = new Date(Date.now() - 60_000).toISOString();
    const { count } = await supabaseAdmin
      .from("usage_logs")
      .select("id", { count: "exact", head: true })
      .eq("api_key_id", keyRow.id)
      .gte("created_at", sinceIso);

    if ((count ?? 0) >= keyRow.rate_limit_per_minute) {
      return jsonResponse({ error: "Rate limit exceeded" }, 429);
    }
  }

  // Log access
  const startTime = Date.now();
  const method = request.method;
  
  // Get Target API base URL
  const { data: api } = await supabaseAdmin
    .from("apis")
    .select("base_url")
    .eq("id", apiId)
    .single();

  if (!api || !api.base_url) {
    return jsonResponse({ error: "Upstream API base URL not configured" }, 400);
  }

  let targetResponse: Response | null = null;
  let statusCode = 200;
  let proxyError = "";

  try {
    const targetUrl = `${api.base_url.replace(/\/$/, "")}/${wildcardPath}`;
    const body = ["GET", "HEAD", "OPTIONS"].includes(method) ? undefined : await request.clone().text();

    targetResponse = await fetch(targetUrl, {
      method,
      headers: {
        "Content-Type": request.headers.get("Content-Type") || "application/json",
      },
      body,
    });
    statusCode = targetResponse.status;
  } catch (e) {
    console.error("gateway proxy failed", e);
    statusCode = 502; // Bad Gateway
    proxyError = (e as Error).message || "Failed to connect to upstream API";
  }

  // Record usage
  await supabaseAdmin.from("usage_logs").insert({
    api_id: apiId,
    api_key_id: keyRow.id,
    user_id: keyRow.user_id,
    endpoint: `/${wildcardPath}`,
    method: method,
    status_code: statusCode,
    latency_ms: Date.now() - startTime,
  });

  // Update last_used_at timestamp
  await supabaseAdmin
    .from("api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", keyRow.id);

  if (targetResponse) {
    return targetResponse;
  }

  if (statusCode === 502) {
    return jsonResponse(
      { 
        error: "Bad Gateway", 
        details: proxyError || "Could not connect to the destination server." 
      }, 
      502
    );
  }

  return jsonResponse({ error: "Internal Server Error" }, 500);
}
