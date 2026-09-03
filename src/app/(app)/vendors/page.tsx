"use client";

import { useMemo, useState } from "react";
import { useHousehold } from "@/hooks/use-household";
import { useVendors } from "@/hooks/use-vendors";
import { VendorCard } from "@/components/vendors/vendor-card";
import { VendorDialog } from "@/components/vendors/vendor-dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { VENDOR_CATEGORIES } from "@/types/database";
import { getVendorStatus, paidAmount, remainingAmount } from "@/lib/vendor-status";
import { formatEUR } from "@/lib/format";
import { Search } from "lucide-react";

export default function VendorsPage() {
  const { household } = useHousehold();
  const {
    vendors,
    paymentsFor,
    loading,
    addVendor,
    updateVendor,
    deleteVendor,
    addPayments,
    updatePayment,
    togglePaid,
    deletePayment,
  } = useVendors(household?.id);

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [status, setStatus] = useState("all");

  const weddingDate = household?.wedding_date ?? null;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return vendors.filter((v) => {
      if (category !== "all" && v.category !== category) return false;
      if (status !== "all" && getVendorStatus(v, paymentsFor(v.id)) !== status) return false;
      if (q) {
        const haystack = `${v.name} ${v.category} ${v.contact_name ?? ""}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [vendors, search, category, status, paymentsFor]);

  const totals = useMemo(() => {
    let engaged = 0;
    let paid = 0;
    let remaining = 0;
    for (const v of vendors) {
      const p = paymentsFor(v.id);
      engaged += Number(v.total_amount);
      paid += paidAmount(p);
      remaining += remainingAmount(v, p);
    }
    return { engaged, paid, remaining };
  }, [vendors, paymentsFor]);

  return (
    <div className="mx-auto max-w-4xl space-y-5 p-4 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Prestataires</h1>
        <VendorDialog weddingDate={weddingDate} onSave={addVendor} />
      </div>

      <div className="flex flex-wrap gap-x-6 gap-y-1 rounded-lg border bg-muted/30 px-4 py-3 text-sm">
        <span className="text-muted-foreground">
          Engagé <span className="font-semibold text-foreground tabular-nums">{formatEUR(totals.engaged)}</span>
        </span>
        <span className="text-muted-foreground">
          Versé <span className="font-semibold text-emerald-600 tabular-nums">{formatEUR(totals.paid)}</span>
        </span>
        <span className="text-muted-foreground">
          Reste à payer <span className="font-semibold text-foreground tabular-nums">{formatEUR(totals.remaining)}</span>
        </span>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Rechercher un prestataire..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Catégorie" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les catégories</SelectItem>
            {VENDOR_CATEGORIES.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Statut" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            <SelectItem value="not_started">Rien versé</SelectItem>
            <SelectItem value="partial">Partiellement payé</SelectItem>
            <SelectItem value="paid_off">Soldé</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-48 rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
          {vendors.length === 0 ? "Aucun prestataire." : "Aucun résultat pour ces filtres."}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((vendor) => (
            <VendorCard
              key={vendor.id}
              vendor={vendor}
              payments={paymentsFor(vendor.id)}
              weddingDate={weddingDate}
              onUpdateVendor={updateVendor}
              onDeleteVendor={deleteVendor}
              onAddPayments={addPayments}
              onUpdatePayment={updatePayment}
              onTogglePaid={togglePaid}
              onDeletePayment={deletePayment}
            />
          ))}
        </div>
      )}
    </div>
  );
}
