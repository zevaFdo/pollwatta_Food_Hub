"use client";

import { CheckCircle2, MessageCircle, Smartphone } from "lucide-react";
import type { Sale } from "@/types/db";
import { buildWhatsAppUrl, buildSmsUrl, formatLKR, normalizeLKPhone } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function OrderSuccessDialog({ sale, onClose }: { sale: Sale; onClose: () => void }) {
  const receipt = {
    saleId: sale.id,
    totalAmount: sale.total_amount,
    items: sale.items,
    createdAt: sale.created_at,
    paymentMethod: sale.payment_method,
  };

  const phone = sale.customer_phone ?? "";
  const phoneOk = !!normalizeLKPhone(phone);

  const whatsappUrl = phoneOk ? buildWhatsAppUrl(phone, receipt) : null;
  const smsUrl = phoneOk ? buildSmsUrl(phone, receipt) : null;

  return (
    <Dialog open={true} onClose={onClose} className="max-w-md">
      <DialogHeader>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-emerald-100 grid place-items-center">
            <CheckCircle2 size={28} className="text-emerald-600" />
          </div>
          <div>
            <DialogTitle>Order Complete</DialogTitle>
            <p className="text-xs text-stone-500 mt-0.5">
              Order #{sale.id.slice(0, 8).toUpperCase()}
            </p>
          </div>
        </div>
      </DialogHeader>
      <DialogBody className="space-y-4">
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-center">
          <div className="text-sm text-emerald-700 font-medium">Amount Received</div>
          <div className="text-3xl font-bold text-emerald-900 mt-1">
            {formatLKR(sale.total_amount)}
          </div>
          <div className="text-xs text-emerald-700 mt-1">Cash · {sale.items.length} item(s)</div>
        </div>

        {phoneOk ? (
          <p className="text-sm text-stone-600 text-center">
            Send the receipt to <span className="font-semibold">{phone}</span>:
          </p>
        ) : (
          <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 text-center">
            No customer phone provided — receipt sharing skipped.
          </p>
        )}
      </DialogBody>
      <DialogFooter className="!justify-stretch">
        {whatsappUrl ? (
          <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="flex-1">
            <Button variant="success" size="lg" className="w-full">
              <MessageCircle size={18} />
              Send via WhatsApp
            </Button>
          </a>
        ) : null}
        {smsUrl ? (
          <a href={smsUrl} className="flex-1">
            <Button variant="outline" size="lg" className="w-full">
              <Smartphone size={18} />
              SMS
            </Button>
          </a>
        ) : null}
        <Button variant="ghost" size="lg" onClick={onClose} className="flex-1">
          Done
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
