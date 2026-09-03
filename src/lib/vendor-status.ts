import type { Vendor, VendorPayment } from "@/types/database";

export type VendorStatus = "not_started" | "partial" | "paid_off";

export const VENDOR_STATUS_LABEL: Record<VendorStatus, string> = {
  not_started: "Rien versé",
  partial: "Partiellement payé",
  paid_off: "Soldé",
};

export const VENDOR_STATUS_CLASS: Record<VendorStatus, string> = {
  not_started: "bg-muted text-muted-foreground",
  partial: "bg-amber-100 text-amber-700",
  paid_off: "bg-emerald-100 text-emerald-700",
};

/** Total déjà réglé pour un prestataire (somme des versements marqués payés). */
export function paidAmount(payments: VendorPayment[]): number {
  return payments.filter((p) => p.paid).reduce((sum, p) => sum + Number(p.amount), 0);
}

/** Ce qu'il reste à sortir : montant du contrat moins ce qui est déjà réglé. */
export function remainingAmount(vendor: Vendor, payments: VendorPayment[]): number {
  return Math.max(0, Number(vendor.total_amount) - paidAmount(payments));
}

/**
 * Somme des échéances planifiées mais pas encore payées. Peut différer du
 * "reste à payer" si l'échéancier ne couvre pas encore tout le contrat.
 */
export function scheduledUnpaid(payments: VendorPayment[]): number {
  return payments.filter((p) => !p.paid).reduce((sum, p) => sum + Number(p.amount), 0);
}

export function getVendorStatus(vendor: Vendor, payments: VendorPayment[]): VendorStatus {
  const paid = paidAmount(payments);
  if (paid <= 0) return "not_started";
  if (paid >= Number(vendor.total_amount) && Number(vendor.total_amount) > 0) return "paid_off";
  return "partial";
}

/**
 * Date réelle d'une échéance. « Jour J » n'est pas une date en soi : elle est
 * résolue avec la date du mariage saisie dans les paramètres.
 */
export function effectiveDueDate(payment: VendorPayment, weddingDate: string | null): string | null {
  if (payment.due_on_wedding_day) return weddingDate;
  return payment.due_date;
}

export type DueUrgency = "overdue" | "due_soon" | "upcoming" | "undated" | "paid";

export function dueUrgency(
  payment: VendorPayment,
  weddingDate: string | null,
  today = new Date()
): DueUrgency {
  if (payment.paid) return "paid";
  const due = effectiveDueDate(payment, weddingDate);
  if (!due) return "undated";

  const dueTime = new Date(`${due}T00:00:00`).getTime();
  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const days = Math.round((dueTime - todayMidnight) / 86_400_000);

  if (days < 0) return "overdue";
  if (days <= 14) return "due_soon";
  return "upcoming";
}

export function daysUntil(dateStr: string, today = new Date()): number {
  const dueTime = new Date(`${dateStr}T00:00:00`).getTime();
  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  return Math.round((dueTime - todayMidnight) / 86_400_000);
}

/** Les échéances non payées, triées par date réelle (sans date = à la fin). */
export function sortedUpcoming(
  payments: VendorPayment[],
  weddingDate: string | null
): VendorPayment[] {
  return payments
    .filter((p) => !p.paid)
    .sort((a, b) => {
      const da = effectiveDueDate(a, weddingDate);
      const db = effectiveDueDate(b, weddingDate);
      if (!da && !db) return 0;
      if (!da) return 1;
      if (!db) return -1;
      return da.localeCompare(db);
    });
}
