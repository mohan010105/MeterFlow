// Server-only PDF generator using pdf-lib (Worker-safe, pure JS, no native deps).
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export interface InvoicePdfInput {
  invoiceNumber: string;
  customerEmail: string;
  planName: string;
  periodStart: Date;
  periodEnd: Date;
  requestsUsed: number;
  requestLimit: number;
  baseAmount: number;
  overageAmount: number;
  overageUnits: number;
  overageRatePer100: number;
  taxAmount: number;
  totalAmount: number;
  status: string;
}

const BRAND = "MeterFlow";
const TAGLINE = "Usage-based metering & billing";

function fmtINR(n: number): string {
  // pdf-lib's WinAnsi encoding can't render the rupee glyph. Use "Rs."
  return `Rs. ${n.toFixed(2)}`;
}

function fmtNum(n: number): string {
  return new Intl.NumberFormat("en-IN").format(n);
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export async function generateInvoicePdf(
  input: InvoicePdfInput
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595.28, 841.89]); // A4
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const { width, height } = page.getSize();
  const margin = 48;
  const text = (
    s: string,
    x: number,
    y: number,
    size = 10,
    f = font,
    color = rgb(0.12, 0.13, 0.18)
  ) => page.drawText(s, { x, y, size, font: f, color });

  // Header bar
  page.drawRectangle({
    x: 0,
    y: height - 110,
    width,
    height: 110,
    color: rgb(0.11, 0.13, 0.22),
  });
  text(BRAND, margin, height - 55, 24, bold, rgb(1, 1, 1));
  text(TAGLINE, margin, height - 78, 10, font, rgb(0.78, 0.83, 0.95));
  text("INVOICE", width - margin - 90, height - 55, 22, bold, rgb(1, 1, 1));
  text(
    `# ${input.invoiceNumber}`,
    width - margin - 160,
    height - 80,
    10,
    font,
    rgb(0.78, 0.83, 0.95)
  );

  // Bill-to + meta
  let y = height - 150;
  text("Billed to", margin, y, 9, bold, rgb(0.45, 0.48, 0.6));
  text(input.customerEmail, margin, y - 16, 12, bold);

  text("Status", width - margin - 200, y, 9, bold, rgb(0.45, 0.48, 0.6));
  const statusColor =
    input.status === "paid"
      ? rgb(0.13, 0.6, 0.35)
      : input.status === "failed"
        ? rgb(0.78, 0.2, 0.2)
        : rgb(0.6, 0.45, 0.13);
  text(input.status.toUpperCase(), width - margin - 200, y - 16, 12, bold, statusColor);

  text("Issue date", width - margin - 90, y, 9, bold, rgb(0.45, 0.48, 0.6));
  text(fmtDate(new Date()), width - margin - 90, y - 16, 12, bold);

  // Period
  y -= 56;
  text("Billing period", margin, y, 9, bold, rgb(0.45, 0.48, 0.6));
  text(
    `${fmtDate(input.periodStart)}  -  ${fmtDate(new Date(input.periodEnd.getTime() - 1))}`,
    margin,
    y - 16,
    11
  );
  text("Plan", width - margin - 200, y, 9, bold, rgb(0.45, 0.48, 0.6));
  text(input.planName, width - margin - 200, y - 16, 11, bold);

  // Line items table
  y -= 60;
  page.drawRectangle({
    x: margin,
    y: y - 6,
    width: width - margin * 2,
    height: 24,
    color: rgb(0.95, 0.96, 0.99),
  });
  text("Description", margin + 12, y + 2, 9, bold, rgb(0.4, 0.43, 0.55));
  text("Quantity", width - margin - 240, y + 2, 9, bold, rgb(0.4, 0.43, 0.55));
  text("Rate", width - margin - 150, y + 2, 9, bold, rgb(0.4, 0.43, 0.55));
  text("Amount", width - margin - 70, y + 2, 9, bold, rgb(0.4, 0.43, 0.55));

  y -= 30;

  // Row 1: Plan subscription
  const limitLabel =
    input.requestLimit > 0
      ? `${fmtNum(input.requestLimit)} requests / month`
      : "Unlimited requests";
  text(`${input.planName} subscription`, margin + 12, y, 10);
  text(limitLabel, margin + 12, y - 12, 8, font, rgb(0.5, 0.53, 0.65));
  text("1", width - margin - 240, y, 10);
  text(fmtINR(input.baseAmount), width - margin - 150, y, 10);
  text(fmtINR(input.baseAmount), width - margin - 70, y, 10, bold);

  y -= 36;
  page.drawLine({
    start: { x: margin, y: y + 12 },
    end: { x: width - margin, y: y + 12 },
    thickness: 0.5,
    color: rgb(0.88, 0.9, 0.95),
  });

  // Row 2: Overage (only if any)
  if (input.overageAmount > 0 || input.overageUnits > 0) {
    text("Overage usage", margin + 12, y, 10);
    text(
      `${fmtNum(input.overageUnits)} requests above plan limit`,
      margin + 12,
      y - 12,
      8,
      font,
      rgb(0.5, 0.53, 0.65)
    );
    text(fmtNum(input.overageUnits), width - margin - 240, y, 10);
    text(
      `${fmtINR(input.overageRatePer100)} / 100`,
      width - margin - 165,
      y,
      10
    );
    text(fmtINR(input.overageAmount), width - margin - 70, y, 10, bold);
    y -= 36;
    page.drawLine({
      start: { x: margin, y: y + 12 },
      end: { x: width - margin, y: y + 12 },
      thickness: 0.5,
      color: rgb(0.88, 0.9, 0.95),
    });
  }

  // Usage summary card
  y -= 8;
  page.drawRectangle({
    x: margin,
    y: y - 56,
    width: width - margin * 2,
    height: 56,
    color: rgb(0.97, 0.98, 1),
    borderColor: rgb(0.88, 0.9, 0.95),
    borderWidth: 0.5,
  });
  text("USAGE THIS PERIOD", margin + 12, y - 16, 8, bold, rgb(0.45, 0.48, 0.6));
  text(
    `${fmtNum(input.requestsUsed)} requests` +
      (input.requestLimit > 0
        ? ` of ${fmtNum(input.requestLimit)}`
        : ""),
    margin + 12,
    y - 36,
    13,
    bold
  );

  // Totals
  y -= 96;
  const totalsX = width - margin - 220;
  text("Subtotal", totalsX, y, 10, font, rgb(0.45, 0.48, 0.6));
  text(
    fmtINR(input.baseAmount + input.overageAmount),
    width - margin - 70,
    y,
    10
  );
  y -= 18;
  text("Tax", totalsX, y, 10, font, rgb(0.45, 0.48, 0.6));
  text(fmtINR(input.taxAmount), width - margin - 70, y, 10);
  y -= 24;
  page.drawRectangle({
    x: totalsX - 12,
    y: y - 8,
    width: width - margin - (totalsX - 12),
    height: 30,
    color: rgb(0.11, 0.13, 0.22),
  });
  text("Total due", totalsX, y + 4, 12, bold, rgb(1, 1, 1));
  text(fmtINR(input.totalAmount), width - margin - 90, y + 4, 14, bold, rgb(1, 1, 1));

  // Footer
  const footerY = 56;
  page.drawLine({
    start: { x: margin, y: footerY + 24 },
    end: { x: width - margin, y: footerY + 24 },
    thickness: 0.5,
    color: rgb(0.88, 0.9, 0.95),
  });
  text(
    `${BRAND}  -  Generated ${fmtDate(new Date())}`,
    margin,
    footerY,
    9,
    font,
    rgb(0.5, 0.53, 0.65)
  );
  text(
    "This is a computer-generated invoice and does not require a signature.",
    margin,
    footerY - 14,
    8,
    font,
    rgb(0.5, 0.53, 0.65)
  );

  return await pdf.save();
}
