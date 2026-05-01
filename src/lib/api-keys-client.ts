// Thin client-side fetcher for the /api/keys/* server routes.
// Adds the Supabase access token so the server route can identify the user.

import { supabase } from "@/integrations/supabase/client";

async function authHeaders(): Promise<HeadersInit> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token
    ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }
    : { "Content-Type": "application/json" };
}

async function request<T>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const headers = await authHeaders();
  const res = await fetch(path, {
    ...init,
    headers: { ...headers, ...(init.headers ?? {}) },
  });
  const text = await res.text();
  const body = text ? JSON.parse(text) : {};
  if (!res.ok) {
    throw new Error(body?.error ?? `Request failed (${res.status})`);
  }
  return body as T;
}

export interface KeyListRow {
  id: string;
  api_id: string;
  name: string;
  prefix: string | null;
  environment: "test" | "live";
  status: "active" | "inactive";
  revoked_at: string | null;
  expires_at: string | null;
  last_used_at: string | null;
  created_at: string;
  rate_limit_per_minute: number;
  api_name: string | null;
}

export const keysApi = {
  list: () => request<{ keys: KeyListRow[] }>("/api/keys/list"),
  create: (input: {
    api_id: string;
    name: string;
    environment: "test" | "live";
    expires_at?: string | null;
    rate_limit_per_minute?: number;
  }) =>
    request<{ key: KeyListRow; plaintext: string }>("/api/keys/create", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  revoke: (id: string) =>
    request<{ key: KeyListRow }>(`/api/keys/revoke/${id}`, { method: "POST" }),
  regenerate: (id: string) =>
    request<{ key: KeyListRow; plaintext: string }>(
      `/api/keys/regenerate/${id}`,
      { method: "POST" }
    ),
  toggleStatus: (id: string, status: "active" | "inactive") =>
    request<{ key: KeyListRow }>(`/api/keys/status/${id}`, {
      method: "POST",
      body: JSON.stringify({ status }),
    }),
  remove: (id: string) =>
    request<{ ok: true }>(`/api/keys/${id}`, { method: "DELETE" }),
  updateRateLimit: (id: string, rate_limit_per_minute: number) =>
    request<{ key: KeyListRow }>(`/api/keys/rate-limit/${id}`, {
      method: "POST",
      body: JSON.stringify({ rate_limit_per_minute }),
    }),
};
