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
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { VENDOR_CATEGORIES } from "@/types/database";
import type { Vendor } from "@/types/database";
import type { VendorInput, InitialSchedule } from "@/hooks/use-vendors";
import { formatEUR, formatDate } from "@/lib/format";
import { Plus } from "lucide-react";

interface VendorDialogProps {
  vendor?: Vendor;
  weddingDate: string | null;
  onSave: (input: VendorInput, schedule?: InitialSchedule) => Promise<unknown>;
  trigger?: React.ReactNode;
}

const emptyVendor: VendorInput = {
  name: "",
  category: VENDOR_CATEGORIES[0],
  total_amount: 0,
  contact_name: "",
  contact_phone: "",
  contact_email: "",
  notes: "",
};

const emptySchedule: InitialSchedule = {
  depositAmount: 0,
  depositPaid: false,
  depositDate: null,
  balanceDate: null,
  balanceOnWeddingDay: true,
};

export function VendorDialog({ vendor, weddingDate, onSave, trigger }: VendorDialogProps) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<VendorInput>(vendor ?? emptyVendor);
  const [schedule, setSchedule] = useState<InitialSchedule>(emptySchedule);

  /** Repart d'un brouillon propre à chaque ouverture. */
  function handleOpenChange(next: boolean) {
    if (next) {
      setForm(vendor ?? emptyVendor);
      setSchedule(emptySchedule);
    }
    setOpen(next);
  }

  const balance = Math.max(0, Number(form.total_amount) - Number(schedule.depositAmount));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await onSave(form, vendor ? undefined : schedule);
    setSaving(false);
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm">
            <Plus className="size-4" />
            Ajouter un prestataire
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{vendor ? "Modifier le prestataire" : "Nouveau prestataire"}</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="v-category">Catégorie</Label>
                <Select value={form.category} onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}>
                  <SelectTrigger id="v-category" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {VENDOR_CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="v-name">Nom du prestataire</Label>
                <Input
                  id="v-name"
                  required
                  placeholder="Château de la Roseraie"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="v-total">Montant total du contrat (€)</Label>
              <Input
                id="v-total"
                type="number"
                min={0}
                step="0.01"
                value={form.total_amount}
                onChange={(e) => setForm((f) => ({ ...f, total_amount: Number(e.target.value) }))}
              />
            </div>

            <Separator />
            <p className="text-xs font-medium text-muted-foreground">Contact</p>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="v-contact">Interlocuteur</Label>
                <Input
                  id="v-contact"
                  placeholder="Marie Dupont"
                  value={form.contact_name ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, contact_name: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="v-phone">Téléphone</Label>
                <Input
                  id="v-phone"
                  type="tel"
                  placeholder="06 12 34 56 78"
                  value={form.contact_phone ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, contact_phone: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="v-email">Email</Label>
              <Input
                id="v-email"
                type="email"
                placeholder="contact@prestataire.fr"
                value={form.contact_email ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, contact_email: e.target.value }))}
              />
            </div>

            {!vendor && (
              <>
                <Separator />
                <p className="text-xs font-medium text-muted-foreground">Premiers versements</p>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="v-deposit">Acompte (€)</Label>
                    <Input
                      id="v-deposit"
                      type="number"
                      min={0}
                      step="0.01"
                      value={schedule.depositAmount}
                      onChange={(e) =>
                        setSchedule((s) => ({ ...s, depositAmount: Number(e.target.value) }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="v-deposit-date">Date de l&apos;acompte</Label>
                    <Input
                      id="v-deposit-date"
                      type="date"
                      value={schedule.depositDate ?? ""}
                      onChange={(e) =>
                        setSchedule((s) => ({ ...s, depositDate: e.target.value || null }))
                      }
                    />
                  </div>
                </div>

                {schedule.depositAmount > 0 && (
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={schedule.depositPaid}
                      onCheckedChange={(c) => setSchedule((s) => ({ ...s, depositPaid: c === true }))}
                    />
                    Cet acompte est déjà versé
                  </label>
                )}

                {balance > 0 && (
                  <div className="space-y-2 rounded-lg bg-muted/50 p-3">
                    <Label htmlFor="v-balance-date">
                      Solde de {formatEUR(balance)} — à régler le
                    </Label>
                    <div className="flex items-center gap-3">
                      <Input
                        id="v-balance-date"
                        type="date"
                        disabled={schedule.balanceOnWeddingDay}
                        value={schedule.balanceDate ?? ""}
                        onChange={(e) =>
                          setSchedule((s) => ({ ...s, balanceDate: e.target.value || null }))
                        }
                        className="flex-1 bg-background"
                      />
                      <label className="flex shrink-0 items-center gap-2 text-sm">
                        <Checkbox
                          checked={schedule.balanceOnWeddingDay}
                          onCheckedChange={(c) =>
                            setSchedule((s) => ({
                              ...s,
                              balanceOnWeddingDay: c === true,
                              balanceDate: c === true ? null : s.balanceDate,
                            }))
                          }
                        />
                        Le jour du mariage
                      </label>
                    </div>
                    {schedule.balanceOnWeddingDay && (
                      <p className="text-xs text-muted-foreground">
                        {weddingDate
                          ? `Soit le ${formatDate(weddingDate)}.`
                          : "Date du mariage à renseigner dans Paramètres."}
                      </p>
                    )}
                  </div>
                )}
              </>
            )}

            <div className="space-y-2">
              <Label htmlFor="v-notes">Notes</Label>
              <Textarea
                id="v-notes"
                rows={2}
                placeholder="Ce qui est inclus, conditions d'annulation..."
                value={form.notes ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={saving}>
              {vendor ? "Enregistrer" : "Ajouter"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
