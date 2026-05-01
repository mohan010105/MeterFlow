// Server-only helpers for API key validation and authenticated user resolution.
// Imported only by files under src/routes/api/**. 
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { hashApiKey } from "@/lib/api-key";

export interface ValidatedApiKey {
  id: string;
  api_id: string;
  user_id: string;
  environment: "test" | "live";
  status: "active" | "inactive";
  revoked_at: string | null;
  expires_at: string | null;
  rate_limit_per_minute: number;
}

export type ValidationResult =
  | { ok: true; key: ValidatedApiKey }
  | { ok: false; reason: "missing" | "invalid" | "revoked" | "inactive" | "expired"; status: number };

export function extractApiKey(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (header?.toLowerCase().startsWith("bearer ")) {
    return header.slice(7).trim();
  }
  return request.headers.get("x-api-key");
}

export async function validateApiKey(
  plaintext: string | null
): Promise<ValidationResult> {
  if (!plaintext) return { ok: false, reason: "missing", status: 401 };

  const key_hash = await hashApiKey(plaintext);
  const { data, error } = await supabaseAdmin
    .from("api_keys")
    .select(
      "id, api_id, user_id, environment, status, expires_at"
    )
    .eq("key_hash", key_hash)
    .maybeSingle();

  if (error) throw error;
  if (!data) return { ok: false, reason: "invalid", status: 401 };

  const key = {
    id: data.id,
    api_id: data.api_id,
    user_id: data.user_id,
    environment: data.environment as "test" | "live",
    status: data.status as "active" | "inactive" | "revoked",
    revoked_at: data.status === "revoked" ? data.expires_at || new Date().toISOString() : null,
    expires_at: data.expires_at,
    rate_limit_per_minute: 0,
  };

  if (key.status === "revoked") return { ok: false, reason: "revoked", status: 401 };
  if (key.status !== "active") return { ok: false, reason: "inactive", status: 403 };
  if (key.expires_at && new Date(key.expires_at).getTime() <= Date.now()) {
    return { ok: false, reason: "expired", status: 401 };
  }
  return { ok: true, key };
}

/**
 * Resolve the user id from a Supabase access token sent by an authenticated
 * dashboard user. Used by the /api/keys/* and /api/billing/* server routes.
 *
 * Uses supabaseAdmin.auth.getUser(token) which validates the JWT server-side
 * via Supabase's GoTrue API — the most reliable method across all client versions.
 */
export async function getAuthedUserId(request: Request): Promise<string | null> {
  const header = request.headers.get("authorization");
  if (!header?.toLowerCase().startsWith("bearer ")) return null;
  const token = header.slice(7).trim();
  if (!token) return null;

  try {
    // Use the admin client to verify the token server-side.
    // supabaseAdmin uses the service role key, and getUser(token) validates
    // the access_token JWT against Supabase Auth without needing a session.
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data?.user?.id) {
      console.error("getAuthedUserId: token validation failed", error?.message);
      return null;
    }
    return data.user.id;
  } catch (err) {
    console.error("getAuthedUserId: unexpected error", err);
    return null;
  }
}
