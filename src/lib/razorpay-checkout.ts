// Lazy-loads the Razorpay Checkout script and opens the modal.
// Returns a promise that resolves with the (success) payload after we
// successfully verify on the server, or rejects on close/cancel/failure.
import { paymentsApi, type SubscriptionRow, type InvoiceRow } from "./billing-client";

declare global {
  interface Window {
    Razorpay?: any;
  }
}

const SCRIPT_URL = "https://checkout.razorpay.com/v1/checkout.js";

function loadScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") return reject(new Error("No window"));
    if (window.Razorpay) return resolve();
    const existing = document.querySelector(
      `script[src="${SCRIPT_URL}"]`
    ) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () =>
        reject(new Error("Failed to load Razorpay"))
      );
      return;
    }
    const s = document.createElement("script");
    s.src = SCRIPT_URL;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Failed to load Razorpay"));
    document.body.appendChild(s);
  });
}

export interface CheckoutInput {
  plan_slug?: string;
  invoice_id?: string;
  description: string;
  customerName?: string;
  customerEmail?: string;
}

export interface CheckoutResult {
  subscription: SubscriptionRow | null;
  invoice: InvoiceRow | null;
  payment_id: string;
  order_id: string;
}

export async function openCheckout(
  input: CheckoutInput
): Promise<CheckoutResult> {
  await loadScript();

  const order = await paymentsApi.createOrder({
    plan_slug: input.plan_slug,
    invoice_id: input.invoice_id,
  });

  return new Promise<CheckoutResult>((resolve, reject) => {
    const rzp = new window.Razorpay({
      key: order.key_id,
      amount: order.amount,
      currency: order.currency,
      order_id: order.order_id,
      name: "MeterFlow",
      description: input.description,
      prefill: {
        name: input.customerName,
        email: input.customerEmail,
      },
      theme: { color: "#3b82f6" },
      modal: {
        ondismiss: () => reject(new Error("Payment cancelled")),
      },
      handler: async (resp: {
        razorpay_order_id: string;
        razorpay_payment_id: string;
        razorpay_signature: string;
      }) => {
        try {
          const verified = await paymentsApi.verify(resp);
          resolve({
            subscription: (verified.subscription as SubscriptionRow) ?? null,
            invoice: (verified.invoice as InvoiceRow) ?? null,
            payment_id: resp.razorpay_payment_id,
            order_id: resp.razorpay_order_id,
          });
        } catch (e) {
          reject(e);
        }
      },
    });
    rzp.on("payment.failed", (resp: any) => {
      reject(new Error(resp?.error?.description ?? "Payment failed"));
    });
    rzp.open();
  });
}
