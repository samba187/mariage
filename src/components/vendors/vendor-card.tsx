"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { VendorDialog } from "@/components/vendors/vendor-dialog";
import { PaymentDialog, type PaymentDraft } from "@/components/vendors/payment-dialog";
import { DueDateLabel } from "@/components/vendors/due-date-label";
import { formatEUR } from "@/lib/format";
import {
  getVendorStatus,
  paidAmount,
  remainingAmount,
  sortedUpcoming,
  VENDOR_STATUS_CLASS,
  VENDOR_STATUS_LABEL,
} from "@/lib/vendor-status";
import type { Vendor, VendorPayment } from "@/types/database";
import type { VendorInput } from "@/hooks/use-vendors";
import { Pencil, Trash2, Phone, Mail, User, Plus, StickyNote } from "lucide-react";

interface VendorCardProps {
  vendor: Vendor;
  payments: VendorPayment[];
  weddingDate: string | null;
  onUpdateVendor: (id: string, input: Partial<VendorInput>) => Promise<void>;
  onDeleteVendor: (id: string) => Promise<void>;
  onAddPayments: (vendorId: string, drafts: PaymentDraft[]) => Promise<void>;
  onUpdatePayment: (id: string, draft: Partial<PaymentDraft>) => Promise<void>;
  onTogglePaid: (payment: VendorPayment) => Promise<void>;
  onDeletePayment: (id: string) => Promise<void>;
}

export function VendorCard({
  vendor,
  payments,
  weddingDate,
  onUpdateVendor,
  onDeleteVendor,
  onAddPayments,
  onUpdatePayment,
  onTogglePaid,
  onDeletePayment,
}: VendorCardProps) {
  const paid = paidAmount(payments);
  const remaining = remainingAmount(vendor, payments);
  const status = getVendorStatus(vendor, payments);
  const total = Number(vendor.total_amount);
  const progress = total > 0 ? Math.min(100, (paid / total) * 100) : 0;

  // Payées d'abord par date de règlement, puis les échéances à venir par urgence.
  const ordered = [
    ...payments.filter((p) => p.paid).sort((a, b) => (a.paid_at ?? "").localeCompare(b.paid_at ?? "")),
    ...sortedUpcoming(payments, weddingDate),
  ];

  return (
    <Card>
      <CardContent className="space-y-4 p-4 md:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="font-normal text-muted-foreground">
                {vendor.category}
              </Badge>
              <Badge variant="secondary" className={VENDOR_STATUS_CLASS[status]}>
                {VENDOR_STATUS_LABEL[status]}
              </Badge>
            </div>
            <h3 className="mt-1.5 text-base font-semibold">{vendor.name}</h3>

            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              {vendor.contact_name && (
                <span className="inline-flex items-center gap-1.5">
                  <User className="size-3.5" />
                  {vendor.contact_name}
                </span>
              )}
              {vendor.contact_phone && (
                <a
                  href={`tel:${vendor.contact_phone.replace(/\s/g, "")}`}
                  className="inline-flex items-center gap-1.5 hover:text-foreground hover:underline"
                >
                  <Phone className="size-3.5" />
                  {vendor.contact_phone}
                </a>
              )}
              {vendor.contact_email && (
                <a
                  href={`mailto:${vendor.contact_email}`}
                  className="inline-flex items-center gap-1.5 hover:text-foreground hover:underline"
                >
                  <Mail className="size-3.5" />
                  {vendor.contact_email}
                </a>
              )}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <VendorDialog
              vendor={vendor}
              weddingDate={weddingDate}
              onSave={(input) => onUpdateVendor(vendor.id, input)}
              trigger={
                <Button size="icon" variant="ghost" className="size-8">
                  <Pencil className="size-3.5" />
                </Button>
              }
            />
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="icon" variant="ghost" className="size-8 text-destructive hover:text-destructive">
                  <Trash2 className="size-3.5" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Supprimer {vendor.name} ?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Le prestataire et toutes ses échéances seront supprimés définitivement.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annuler</AlertDialogCancel>
                  <AlertDialogAction onClick={() => onDeleteVendor(vendor.id)}>Supprimer</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex flex-wrap justify-between gap-x-4 text-sm">
            <span className="text-muted-foreground">
              Contrat <span className="font-medium text-foreground tabular-nums">{formatEUR(total)}</span>
            </span>
            <span className="text-muted-foreground">
              Versé <span className="font-medium text-emerald-600 tabular-nums">{formatEUR(paid)}</span>
            </span>
            <span className="text-muted-foreground">
              Reste <span className="font-medium text-foreground tabular-nums">{formatEUR(remaining)}</span>
            </span>
          </div>
          <Progress value={progress} className="h-1.5" />
        </div>

        {vendor.notes && (
          <p className="flex items-start gap-2 rounded-md bg-muted/50 p-2.5 text-xs text-muted-foreground">
            <StickyNote className="mt-0.5 size-3.5 shrink-0" />
            {vendor.notes}
          </p>
        )}

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground">
              {payments.length === 0
                ? "Versements"
                : `Versements — ${payments.filter((p) => p.paid).length}/${payments.length} payés`}
            </p>
            <PaymentDialog
              weddingDate={weddingDate}
              defaultAmount={remaining}
              onSave={(drafts) => onAddPayments(vendor.id, drafts)}
              trigger={
                <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs">
                  <Plus className="size-3.5" />
                  Ajouter
                </Button>
              }
            />
          </div>

          {ordered.length === 0 ? (
            <p className="rounded-md border border-dashed p-3 text-center text-xs text-muted-foreground">
              Aucun versement enregistré.
            </p>
          ) : (
            <ul className="divide-y rounded-md border">
              {ordered.map((payment) => (
                <li key={payment.id} className="flex items-center gap-3 p-2.5">
                  <Checkbox
                    checked={payment.paid}
                    onCheckedChange={() => onTogglePaid(payment)}
                    aria-label={`Marquer ${payment.label} comme payé`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className={`truncate text-sm ${payment.paid ? "text-muted-foreground line-through" : "font-medium"}`}>
                      {payment.label}
                    </p>
                    <DueDateLabel payment={payment} weddingDate={weddingDate} />
                  </div>
                  <span className={`shrink-0 text-sm tabular-nums ${payment.paid ? "text-muted-foreground" : "font-medium"}`}>
                    {formatEUR(Number(payment.amount))}
                  </span>
                  <div className="flex shrink-0 items-center">
                    <PaymentDialog
                      payment={payment}
                      weddingDate={weddingDate}
                      onSave={(drafts) => onUpdatePayment(payment.id, drafts[0])}
                      trigger={
                        <Button size="icon" variant="ghost" className="size-7">
                          <Pencil className="size-3" />
                        </Button>
                      }
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-7 text-destructive hover:text-destructive"
                      onClick={() => onDeletePayment(payment.id)}
                    >
                      <Trash2 className="size-3" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
