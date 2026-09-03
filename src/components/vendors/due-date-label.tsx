"use client";

import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import { daysUntil, dueUrgency, effectiveDueDate } from "@/lib/vendor-status";
import type { VendorPayment } from "@/types/database";
import { CalendarClock, AlertTriangle, CheckCircle2, CalendarOff } from "lucide-react";

const URGENCY_CLASS = {
  overdue: "text-rose-600",
  due_soon: "text-amber-600",
  upcoming: "text-muted-foreground",
  undated: "text-muted-foreground",
  paid: "text-emerald-600",
} as const;

/** Date d'échéance lisible : « Jour J » est résolu avec la date du mariage. */
export function DueDateLabel({
  payment,
  weddingDate,
  className,
}: {
  payment: VendorPayment;
  weddingDate: string | null;
  className?: string;
}) {
  const urgency = dueUrgency(payment, weddingDate);
  const due = effectiveDueDate(payment, weddingDate);

  if (payment.paid) {
    return (
      <span className={cn("inline-flex items-center gap-1.5 text-xs", URGENCY_CLASS.paid, className)}>
        <CheckCircle2 className="size-3.5" />
        Payé{payment.paid_at ? ` le ${formatDate(payment.paid_at)}` : ""}
      </span>
    );
  }

  if (!due) {
    return (
      <span className={cn("inline-flex items-center gap-1.5 text-xs", URGENCY_CLASS.undated, className)}>
        <CalendarOff className="size-3.5" />
        {payment.due_on_wedding_day ? "Jour du mariage (date non renseignée)" : "Sans date"}
      </span>
    );
  }

  const days = daysUntil(due);
  const relative =
    days === 0
      ? "aujourd'hui"
      : days === 1
        ? "demain"
        : days > 0
          ? `dans ${days} j`
          : `en retard de ${Math.abs(days)} j`;

  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs", URGENCY_CLASS[urgency], className)}>
      {urgency === "overdue" ? (
        <AlertTriangle className="size-3.5" />
      ) : (
        <CalendarClock className="size-3.5" />
      )}
      {formatDate(due)} · {relative}
      {payment.due_on_wedding_day && " (jour du mariage)"}
    </span>
  );
}
