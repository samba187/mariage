"use client";

import { createClient } from "@/lib/supabase/client";
import { writeChecked } from "@/lib/supabase/write";
import { useRealtimeCollection } from "@/hooks/use-realtime-collection";
import type { Vendor, VendorPayment } from "@/types/database";
import { toast } from "sonner";

export type VendorInput = Omit<Vendor, "id" | "household_id" | "created_at" | "updated_at">;
export type PaymentInput = Omit<
  VendorPayment,
  "id" | "household_id" | "created_at" | "updated_at"
>;

/** Versements initiaux proposés à la création d'un prestataire. */
export interface InitialSchedule {
  depositAmount: number;
  depositPaid: boolean;
  depositDate: string | null;
  balanceDate: string | null;
  balanceOnWeddingDay: boolean;
}

export function useVendors(householdId: string | undefined) {
  const supabase = createClient();

  const { rows: vendors, loading: vendorsLoading } = useRealtimeCollection<Vendor>(
    "vendors",
    householdId,
    { errorLabel: "des prestataires" }
  );

  const { rows: payments, loading: paymentsLoading } = useRealtimeCollection<VendorPayment>(
    "vendor_payments",
    householdId,
    { errorLabel: "de l'échéancier" }
  );

  function paymentsFor(vendorId: string) {
    return payments.filter((p) => p.vendor_id === vendorId);
  }

  async function addVendor(input: VendorInput, schedule?: InitialSchedule) {
    if (!householdId) return;
    const { data: vendor, error } = await supabase
      .from("vendors")
      .insert({ ...input, household_id: householdId })
      .select()
      .single();

    if (error || !vendor) {
      toast.error(error?.message ?? "Erreur lors de l'ajout");
      return;
    }

    const rows: Array<Partial<VendorPayment>> = [];
    if (schedule && schedule.depositAmount > 0) {
      rows.push({
        household_id: householdId,
        vendor_id: vendor.id,
        label: "Acompte",
        amount: schedule.depositAmount,
        due_date: schedule.depositDate,
        due_on_wedding_day: false,
        paid: schedule.depositPaid,
        paid_at: schedule.depositPaid ? (schedule.depositDate ?? new Date().toISOString().slice(0, 10)) : null,
      });
    }
    const balance = Number(input.total_amount) - (schedule?.depositAmount ?? 0);
    if (schedule && balance > 0) {
      rows.push({
        household_id: householdId,
        vendor_id: vendor.id,
        label: "Solde",
        amount: balance,
        due_date: schedule.balanceOnWeddingDay ? null : schedule.balanceDate,
        due_on_wedding_day: schedule.balanceOnWeddingDay,
        paid: false,
        paid_at: null,
      });
    }

    if (rows.length > 0) {
      await writeChecked(supabase, () => supabase.from("vendor_payments").insert(rows).select());
    }

    toast.success("Prestataire ajouté");
  }

  async function updateVendor(id: string, input: Partial<VendorInput>) {
    await writeChecked(supabase, () =>
      supabase.from("vendors").update(input).eq("id", id).select()
    );
  }

  async function deleteVendor(id: string) {
    const ok = await writeChecked(supabase, () =>
      supabase.from("vendors").delete().eq("id", id).select()
    );
    if (ok) toast.success("Prestataire supprimé");
  }

  /** Accepte un versement unique ou une série mensuelle générée d'un coup. */
  async function addPayments(vendorId: string, drafts: Array<Omit<PaymentInput, "vendor_id">>) {
    if (!householdId || drafts.length === 0) return;
    const ok = await writeChecked(supabase, () =>
      supabase
        .from("vendor_payments")
        .insert(drafts.map((d) => ({ ...d, vendor_id: vendorId, household_id: householdId })))
        .select()
    );
    if (ok) toast.success(drafts.length === 1 ? "Versement ajouté" : `${drafts.length} versements ajoutés`);
  }

  async function updatePayment(id: string, input: Partial<PaymentInput>) {
    return writeChecked(supabase, () =>
      supabase.from("vendor_payments").update(input).eq("id", id).select()
    );
  }

  async function togglePaid(payment: VendorPayment) {
    const nowPaid = !payment.paid;
    const ok = await updatePayment(payment.id, {
      paid: nowPaid,
      paid_at: nowPaid ? new Date().toISOString().slice(0, 10) : null,
    });
    if (ok) toast.success(nowPaid ? "Versement marqué payé" : "Versement remis en attente");
  }

  async function deletePayment(id: string) {
    const ok = await writeChecked(supabase, () =>
      supabase.from("vendor_payments").delete().eq("id", id).select()
    );
    if (ok) toast.success("Versement supprimé");
  }

  return {
    vendors,
    payments,
    paymentsFor,
    loading: vendorsLoading || paymentsLoading,
    addVendor,
    updateVendor,
    deleteVendor,
    addPayments,
    updatePayment,
    togglePaid,
    deletePayment,
  };
}
