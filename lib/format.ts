import type { Sale, SaleLine } from "@/types/db";

export function formatLKR(amount: number): string {
  return `Rs. ${amount.toLocaleString("en-LK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

const BRAND_NAME = "Polwatta Sip & Script";

export interface ReceiptInput {
  saleId: string;
  totalAmount: number;
  items: SaleLine[];
  createdAt?: string;
}

export function buildReceiptText(sale: ReceiptInput): string {
  const date = sale.createdAt ? new Date(sale.createdAt) : new Date();
  const dateStr = date.toLocaleString("en-LK", { hour12: true });

  const lines = [
    `*${BRAND_NAME}*`,
    `Order #${sale.saleId.slice(0, 8).toUpperCase()}`,
    `${dateStr}`,
    `--------------------------------`,
    ...sale.items.map((i) => {
      const lineTotal = i.price * i.quantity;
      return `${i.name} x${i.quantity}  ${formatLKR(lineTotal)}`;
    }),
    `--------------------------------`,
    `*Total: ${formatLKR(sale.totalAmount)}*`,
    `Payment: Cash`,
    ``,
    `Thank you for visiting!`,
  ];

  return lines.join("\n");
}

/**
 * Normalize a Sri Lankan phone to E.164-ish digits for wa.me links.
 * Accepts formats: 0771234567, 771234567, +94771234567, 94771234567
 */
export function normalizeLKPhone(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  if (!digits) return null;

  let normalized = digits;
  if (normalized.startsWith("0")) {
    normalized = "94" + normalized.slice(1);
  } else if (!normalized.startsWith("94")) {
    if (normalized.length === 9) {
      normalized = "94" + normalized;
    }
  }

  // Final sanity: should be 11 digits (94 + 9-digit local)
  if (normalized.length < 10 || normalized.length > 15) return null;
  return normalized;
}

export function buildWhatsAppUrl(phoneInput: string, sale: ReceiptInput): string | null {
  const phone = normalizeLKPhone(phoneInput);
  if (!phone) return null;
  return `https://wa.me/${phone}?text=${encodeURIComponent(buildReceiptText(sale))}`;
}

export function buildSmsUrl(phoneInput: string, sale: ReceiptInput): string | null {
  const phone = normalizeLKPhone(phoneInput);
  if (!phone) return null;
  return `sms:+${phone}?body=${encodeURIComponent(buildReceiptText(sale))}`;
}
