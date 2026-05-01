import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { extractApiKey, validateApiKey } from "@/lib/api-key-server";

const BodySchema = z.object({
  endpoint: z.string().min(1).max(500).optional(),
  method: z
    .string()
    .min(1)
    .max(10)
    .regex(/^[A-Z]+$/)
    .optional(),
  status_code: z.number().int().min(100).max(599).optional(),
  latency_ms: z.number().int().min(0).max(600000).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-api-key",
};

function jsonResponse(
  body: unknown,
  status: number,
  extraHeaders: Record<string, string> = {}
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders,
      ...extraHeaders,
    },
  });
}

export const Route = createFileRoute("/api/track")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: corsHeaders }),
      POST: async ({ request }) => {
        const apiKey = extractApiKey(request);
        const validation = await validateApiKey(apiKey).catch((e) => {
          console.error("track: validation threw", e);
          return null;
        });
        if (!validation) return jsonResponse({ error: "Internal error" }, 500);
        if (!validation.ok) {
          const map: Record<string, string> = {
            missing: "Missing API key",
            invalid: "Invalid API key",
            revoked: "API key revoked",
            inactive: "API key inactive",
            expired: "API key expired",
          };
          return jsonResponse(
            { error: map[validation.reason] ?? "Unauthorized" },
            validation.status
          );
        }

        const keyRow = validation.key;

        // ---- Per-key rate limit (requests per minute) ----------------------
        // Backend has no Redis/Durable Object primitives yet, so this counts
        // usage_events in the last 60s for this key. Adds 1 SELECT per call.
        if (keyRow.rate_limit_per_minute > 0) {
          const sinceIso = new Date(Date.now() - 60_000).toISOString();
          const { count: recentCount, error: countErr } = await supabaseAdmin
            .from("usage_logs")
            .select("id", { count: "exact", head: true })
            .eq("api_key_id", keyRow.id)
            .gte("created_at", sinceIso);
          if (countErr) {
            console.error("track: rate-limit count failed", countErr);
            // fail-open: don't block traffic on infra blips
          } else if (
            (recentCount ?? 0) >= keyRow.rate_limit_per_minute
          ) {
            return jsonResponse(
              {
                error: "Rate limit exceeded",
                limit: keyRow.rate_limit_per_minute,
                window_seconds: 60,
              },
              429,
              {
                "X-RateLimit-Limit": String(keyRow.rate_limit_per_minute),
                "X-RateLimit-Remaining": "0",
                "Retry-After": "60",
              }
            );
          }
        }

        let body: unknown = {};
        try {
          const text = await request.text();
          body = text ? JSON.parse(text) : {};
        } catch {
          return jsonResponse({ error: "Invalid JSON body" }, 400);
        }

        const parsed = BodySchema.safeParse(body);
        if (!parsed.success) {
          return jsonResponse(
            { error: "Invalid payload", details: parsed.error.issues },
            400
          );
        }

        const ipAddress = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "";
        const userAgent = request.headers.get("user-agent") || "";

        const { error: insertErr } = await supabaseAdmin
          .from("usage_logs")
          .insert({
            api_id: keyRow.api_id,
            api_key_id: keyRow.id,
            user_id: keyRow.user_id,
            endpoint: parsed.data.endpoint ?? null,
            method: parsed.data.method ?? null,
            status_code: parsed.data.status_code ?? null,
            latency_ms: parsed.data.latency_ms ?? null,
            ip: ipAddress,
            ip_address: ipAddress,
            user_agent: userAgent,
          });

        if (insertErr) {
          console.error("track: insert failed", insertErr);
          return jsonResponse({ error: "Failed to record event" }, 500);
        }

        // Update last_used_at timestamp
        await supabaseAdmin
          .from("api_keys")
          .update({ last_used_at: new Date().toISOString() })
          .eq("id", keyRow.id);

        return jsonResponse({ success: true }, 200, {
          "X-RateLimit-Limit": String(keyRow.rate_limit_per_minute),
        });
      },
    },
  },
});
