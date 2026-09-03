"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { VendorPayment } from "@/types/database";
import { formatEUR, formatDate } from "@/lib/format";
import { Plus } from "lucide-react";

export type PaymentDraft = Pick<
  VendorPayment,
  "label" | "amount" | "due_date" | "due_on_wedding_day" | "paid" | "paid_at"
>;

interface PaymentDialogProps {
  payment?: VendorPayment;
  weddingDate: string | null;
  defaultAmount?: number;
  onSave: (drafts: PaymentDraft[]) => Promise<void>;
  trigger?: React.ReactNode;
}

function toIsoDate(year: number, monthIndex: number, day: number): string {
  const lastDay = new Date(year, monthIndex + 1, 0).getDate();
  const safeDay = Math.min(day, lastDay);
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(safeDay).padStart(2, "0")}`;
}

/** Un versement par mois, au même jour, à partir du mois de départ. */
function buildMonthly(
  startMonth: string,
  dayOfMonth: number,
  count: number,
  amount: number
): PaymentDraft[] {
  if (!startMonth) return [];
  const [y, m] = startMonth.split("-").map(Number);
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(y, m - 1 + i, 1);
    return {
      label: `Versement ${i + 1}/${count}`,
      amount,
      due_date: toIsoDate(d.getFullYear(), d.getMonth(), dayOfMonth),
      due_on_wedding_day: false,
      paid: false,
      paid_at: null,
    };
  });
}

export function PaymentDialog({
  payment,
  weddingDate,
  defaultAmount = 0,
  onSave,
  trigger,
}: PaymentDialogProps) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const blankSingle: PaymentDraft = {
    label: "Versement",
    amount: defaultAmount,
    due_date: null,
    due_on_wedding_day: false,
    paid: false,
    paid_at: null,
  };

  const [single, setSingle] = useState<PaymentDraft>(payment ?? blankSingle);

  const thisMonth = new Date().toISOString().slice(0, 7);
  const [monthlyAmount, setMonthlyAmount] = useState(0);
  const [dayOfMonth, setDayOfMonth] = useState(5);
  const [startMonth, setStartMonth] = useState(thisMonth);
  const [count, setCount] = useState(6);

  function handleOpenChange(next: boolean) {
    if (next) {
      setSingle(payment ?? blankSingle);
      setMonthlyAmount(0);
      setDayOfMonth(5);
      setStartMonth(thisMonth);
      setCount(6);
    }
    setOpen(next);
  }

  const preview = buildMonthly(startMonth, dayOfMonth, count, monthlyAmount);

  async function submitSingle(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await onSave([
      {
        ...single,
        paid_at: single.paid ? (single.paid_at ?? new Date().toISOString().slice(0, 10)) : null,
      },
    ]);
    setSaving(false);
    setOpen(false);
  }

  async function submitMonthly(e: React.FormEvent) {
    e.preventDefault();
    if (preview.length === 0) return;
    setSaving(true);
    await onSave(preview);
    setSaving(false);
    setOpen(false);
  }

  const singleForm = (
    <form onSubmit={submitSingle} className="space-y-4 pt-2">
      <div className="space-y-2">
        <Label htmlFor="p-label">Libellé</Label>
        <Input
          id="p-label"
          required
          placeholder="Acompte"
          value={single.label}
          onChange={(e) => setSingle((d) => ({ ...d, label: e.target.value }))}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="p-amount">Montant (€)</Label>
        <Input
          id="p-amount"
          type="number"
          min={0}
          step="0.01"
          required
          value={single.amount}
          onChange={(e) => setSingle((d) => ({ ...d, amount: Number(e.target.value) }))}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="p-date">À payer le</Label>
        <Input
          id="p-date"
          type="date"
          disabled={single.due_on_wedding_day}
          value={single.due_date ?? ""}
          onChange={(e) => setSingle((d) => ({ ...d, due_date: e.target.value || null }))}
        />
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <Checkbox
            checked={single.due_on_wedding_day}
            onCheckedChange={(c) =>
              setSingle((d) => ({
                ...d,
                due_on_wedding_day: c === true,
                due_date: c === true ? null : d.due_date,
              }))
            }
          />
          Le jour du mariage
          {single.due_on_wedding_day && weddingDate && ` (${formatDate(weddingDate)})`}
        </label>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <Checkbox
          checked={single.paid}
          onCheckedChange={(c) => setSingle((d) => ({ ...d, paid: c === true }))}
        />
        Déjà payé
      </label>

      <DialogFooter>
        <Button type="submit" disabled={saving}>
          {payment ? "Enregistrer" : "Ajouter"}
        </Button>
      </DialogFooter>
    </form>
  );

  if (payment) {
    return (
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogTrigger asChild>{trigger}</DialogTrigger>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Modifier le versement</DialogTitle>
          </DialogHeader>
          {singleForm}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm" variant="outline">
            <Plus className="size-4" />
            Ajouter
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ajouter des versements</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="once">
          <TabsList className="w-full">
            <TabsTrigger value="once" className="flex-1">
              Une seule fois
            </TabsTrigger>
            <TabsTrigger value="monthly" className="flex-1">
              Tous les mois
            </TabsTrigger>
          </TabsList>

          <TabsContent value="once">{singleForm}</TabsContent>

          <TabsContent value="monthly">
            <form onSubmit={submitMonthly} className="space-y-4 pt-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="m-amount">Montant par mois (€)</Label>
                  <Input
                    id="m-amount"
                    type="number"
                    min={0}
                    step="0.01"
                    required
                    value={monthlyAmount}
                    onChange={(e) => setMonthlyAmount(Number(e.target.value))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="m-day">Le combien du mois</Label>
                  <Input
                    id="m-day"
                    type="number"
                    min={1}
                    max={31}
                    required
                    value={dayOfMonth}
                    onChange={(e) => setDayOfMonth(Number(e.target.value))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="m-start">Premier versement</Label>
                  <Input
                    id="m-start"
                    type="month"
                    required
                    value={startMonth}
                    onChange={(e) => setStartMonth(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="m-count">Nombre de mois</Label>
                  <Input
                    id="m-count"
                    type="number"
                    min={1}
                    max={60}
                    required
                    value={count}
                    onChange={(e) => setCount(Number(e.target.value))}
                  />
                </div>
              </div>

              {preview.length > 0 && monthlyAmount > 0 && (
                <div className="space-y-1 rounded-lg bg-muted/60 p-3 text-sm">
                  <p className="font-medium">
                    {preview.length} versements de {formatEUR(monthlyAmount)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Du {formatDate(preview[0].due_date)} au{" "}
                    {formatDate(preview[preview.length - 1].due_date)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Total {formatEUR(monthlyAmount * preview.length)}
                  </p>
                </div>
              )}

              <DialogFooter>
                <Button type="submit" disabled={saving || monthlyAmount <= 0}>
                  Créer {preview.length} versements
                </Button>
              </DialogFooter>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
