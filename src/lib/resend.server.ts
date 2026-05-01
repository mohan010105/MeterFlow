// Server-only Resend helper for sending transactional emails.
// Uses fetch directly for Worker compatibility.

const RESEND_API_BASE = "https://api.resend.com";

interface SendEmailInput {
  from?: string;
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
}

export async function sendEmail(input: SendEmailInput) {
  const apiKey = process.env.RESEND_API_KEY;
  const supportEmail = process.env.SUPPORT_EMAIL || "support@meterflow.app";

  if (!apiKey) {
    console.warn("RESEND_API_KEY not configured, skipping email send");
    return;
  }

  const from = input.from || `MeterFlow <onboarding@resend.dev>`; // Resend default for unverified domains

  const res = await fetch(`${RESEND_API_BASE}/emails`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      from,
      to: Array.isArray(input.to) ? input.to : [input.to],
      subject: input.subject,
      html: input.html,
      text: input.text,
    }),
  });

  if (!res.ok) {
    const error = await res.text();
    console.error("Resend email failed", res.status, error);
    throw new Error(`Failed to send email (${res.status})`);
  }

  return res.json();
}

export async function sendWelcomeEmail(email: string, name: string) {
  return sendEmail({
    to: email,
    subject: "Welcome to MeterFlow!",
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #3b82f6;">Welcome to MeterFlow, ${name}!</h1>
        <p>Your developer account is ready. You can now start metering your APIs and managing keys.</p>
        <p>If you have any questions, just reply to this email or contact us at ${process.env.SUPPORT_EMAIL || 'support@meterflow.app'}.</p>
        <br />
        <p>Cheers,<br />The MeterFlow Team</p>
      </div>
    `,
  });
}
