"use client";

import Link from "next/link";
import { ArrowLeft, MessageCircle, Smartphone, Printer } from "lucide-react";
import {
  buildSmsUrl,
  buildWhatsAppUrl,
  formatLKR,
  normalizeLKPhone,
  shortBillCode,
} from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { Sale } from "@/types/db";

interface BillDetailProps {
  sale: Sale;
  cashierName: string | null;
}

export function BillDetail({ sale, cashierName }: BillDetailProps) {
  const date = new Date(sale.created_at);
  const dateStr = date.toLocaleString("en-LK", { hour12: true });

  const receipt = {
    saleId: sale.id,
    totalAmount: Number(sale.total_amount),
    items: sale.items,
    createdAt: sale.created_at,
    paymentMethod: sale.payment_method,
  };

  const phone = sale.customer_phone ?? "";
  const phoneOk = !!normalizeLKPhone(phone);
  const whatsappUrl = phoneOk ? buildWhatsAppUrl(phone, receipt) : null;
  const smsUrl = phoneOk ? buildSmsUrl(phone, receipt) : null;

  const items = Array.isArray(sale.items) ? sale.items : [];
  const itemCount = items.reduce((acc, it) => acc + (it.quantity ?? 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 print:hidden">
        <Link href="/bills">
          <Button variant="ghost" size="sm">
            <ArrowLeft size={16} />
            Back to Bills
          </Button>
        </Link>
        <div className="flex flex-wrap gap-2 justify-end">
          {whatsappUrl ? (
            <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
              <Button variant="success" size="sm">
                <MessageCircle size={16} />
                WhatsApp
              </Button>
            </a>
          ) : null}
          {smsUrl ? (
            <a href={smsUrl}>
              <Button variant="outline" size="sm">
                <Smartphone size={16} />
                SMS
              </Button>
            </a>
          ) : null}
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.print()}
            title="Print receipt"
          >
            <Printer size={16} />
            Print
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-stone-100 pb-4">
            <div>
              <div className="text-xs text-stone-500 uppercase tracking-wide">Bill Code</div>
              <div className="font-mono text-2xl font-bold text-stone-900">
                #{shortBillCode(sale.id)}
              </div>
              <div className="text-xs text-stone-400 font-mono mt-1 break-all">
                {sale.id}
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-stone-500 uppercase tracking-wide">Total</div>
              <div className="text-3xl font-bold text-brand-700">
                {formatLKR(Number(sale.total_amount))}
              </div>
              <div className="text-xs text-stone-500 mt-1">
                {itemCount} item{itemCount === 1 ? "" : "s"}
              </div>
            </div>
          </div>

          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <div>
              <dt className="text-stone-500">Date & Time</dt>
              <dd className="font-medium text-stone-900">{dateStr}</dd>
            </div>
            <div>
              <dt className="text-stone-500">Payment</dt>
              <dd className="font-medium text-stone-900">{sale.payment_method || "Cash"}</dd>
            </div>
            <div>
              <dt className="text-stone-500">Cashier</dt>
              <dd className="font-medium text-stone-900">
                {cashierName ?? <span className="text-stone-400">—</span>}
              </dd>
            </div>
            <div>
              <dt className="text-stone-500">Customer Phone</dt>
              <dd className="font-medium text-stone-900">
                {sale.customer_phone || <span className="text-stone-400">—</span>}
              </dd>
            </div>
          </dl>

          <div>
            <h3 className="font-semibold text-stone-900 mb-2">Items</h3>
            <div className="overflow-x-auto rounded-lg border border-stone-200">
              <table className="w-full text-sm">
                <thead className="bg-stone-50 text-stone-600">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium">Item</th>
                    <th className="text-right px-3 py-2 font-medium w-16">Qty</th>
                    <th className="text-right px-3 py-2 font-medium w-32">Unit</th>
                    <th className="text-right px-3 py-2 font-medium w-32">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-3 py-6 text-center text-stone-500">
                        No items recorded.
                      </td>
                    </tr>
                  ) : (
                    items.map((it, idx) => {
                      const unit = Number(it.price);
                      const qty = Number(it.quantity ?? 0);
                      const lineTotal = unit * qty;
                      return (
                        <tr key={`${it.id}-${idx}`}>
                          <td className="px-3 py-2 text-stone-900">
                            {it.name}
                            {it.type === "combo" && (
                              <span className="ml-1.5 text-xs font-normal text-brand-600">
                                (Combo)
                              </span>
                            )}
                            {it.type === "addon" && (
                              <span className="ml-1.5 text-xs font-normal text-stone-500">
                                (Add-on)
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">{qty}</td>
                          <td className="px-3 py-2 text-right tabular-nums text-stone-600">
                            {formatLKR(unit)}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums font-medium">
                            {formatLKR(lineTotal)}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
                <tfoot>
                  <tr className="bg-stone-50">
                    <td colSpan={3} className="px-3 py-3 text-right font-semibold text-stone-700">
                      Grand Total
                    </td>
                    <td className="px-3 py-3 text-right font-bold text-brand-700 tabular-nums">
                      {formatLKR(Number(sale.total_amount))}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </CardContent>
      </Card>

      {!phoneOk && (
        <p className="text-xs text-stone-500 text-center print:hidden">
          No customer phone on this bill — WhatsApp/SMS share is unavailable.
        </p>
      )}
    </div>
  );
}
