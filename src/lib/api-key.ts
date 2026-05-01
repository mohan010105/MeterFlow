// Helpers for generating and hashing API keys.
//
// Plaintext format (Phase 6+):
//   mf_test_<32 random base62>  — sandbox / development
//   mf_live_<32 random base62>  — production
//
// Legacy format (still validated for backwards compatibility):
//   mf_<32 random base62>        — pre-Phase 6 keys, treated as 'live'
//
// We display the first 12 chars (e.g. "mf_live_a1b2") as the prefix in UI.

export type KeyEnvironment = "test" | "live";

const ALPHABET =
  "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

const KEY_BODY_LENGTH = 32;

function randomBody(): string {
  const bytes = new Uint8Array(KEY_BODY_LENGTH);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < bytes.length; i++) {
    out += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return out;
}

export function generateApiKey(environment: KeyEnvironment = "live"): string {
  return `mf_${environment}_${randomBody()}`;
}

export async function hashApiKey(key: string): Promise<string> {
  const data = new TextEncoder().encode(key);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * UI prefix shown in dashboards / lists.
 * - New keys: `mf_live_a1b2` (12 chars)
 * - Legacy keys: `mf_a1b2c3` (8 chars)
 */
export function keyPrefix(key: string): string {
  if (key.startsWith("mf_live_") || key.startsWith("mf_test_")) {
    return key.slice(0, 12);
  }
  return key.slice(0, 8);
}

/**
 * Infer environment from a plaintext key. Legacy `mf_xxx` keys are treated as 'live'.
 * Returns null if the key does not match a known format.
 */
export function inferEnvironment(key: string): KeyEnvironment | null {
  if (key.startsWith("mf_test_")) return "test";
  if (key.startsWith("mf_live_")) return "live";
  if (key.startsWith("mf_")) return "live"; // legacy
  return null;
}
