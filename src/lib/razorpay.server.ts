// Server-only Razorpay helpers. Talks to Razorpay's REST API directly via fetch
// (no SDK — Worker-safe). Verifies webhook + payment signatures using the
// crypto built-in.
import crypto from "node:crypto";

const RZP_BASE = "https://api.razorpay.com/v1";

function getKeys() {
  const key_id = process.env.RAZORPAY_KEY_ID;
  const key_secret = process.env.RAZORPAY_KEY_SECRET;
  if (!key_id || !key_secret) {
    throw new Error("Razorpay keys not configured");
  }
  return { key_id, key_secret };
}

function authHeader() {
  const { key_id, key_secret } = getKeys();
  const token = Buffer.from(`${key_id}:${key_secret}`).toString("base64");
  return `Basic ${token}`;
}

export function getPublicKeyId(): string {
  return getKeys().key_id;
}

export interface RazorpayOrder {
  id: string;
  amount: number; // in paise
  currency: string;
  status: string;
  receipt?: string;
}

export async function createOrder(input: {
  amount: number; // INR rupees, will convert to paise
  receipt: string;
  notes?: Record<string, string>;
}): Promise<RazorpayOrder> {
  const res = await fetch(`${RZP_BASE}/orders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: authHeader(),
    },
    body: JSON.stringify({
      amount: Math.round(input.amount * 100),
      currency: "INR",
      receipt: input.receipt.slice(0, 40),
      notes: input.notes,
      payment_capture: 1,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    console.error("razorpay createOrder failed", res.status, text);
    throw new Error(`Razorpay order failed (${res.status})`);
  }
  return (await res.json()) as RazorpayOrder;
}

export function verifyPaymentSignature(input: {
  order_id: string;
  payment_id: string;
  signature: string;
}): boolean {
  const { key_secret } = getKeys();
  const expected = crypto
    .createHmac("sha256", key_secret)
    .update(`${input.order_id}|${input.payment_id}`)
    .digest("hex");
  // Constant-time compare
  try {
    return (
      expected.length === input.signature.length &&
      crypto.timingSafeEqual(
        Buffer.from(expected),
        Buffer.from(input.signature)
      )
    );
  } catch {
    return false;
  }
}

export function verifyWebhookSignature(
  rawBody: string,
  signature: string | null,
  secret: string
): boolean {
  if (!signature) return false;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");
  try {
    return (
      expected.length === signature.length &&
      crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
    );
  } catch {
    return false;
  }
}
