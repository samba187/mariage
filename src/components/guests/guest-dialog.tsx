"use client";

import { useEffect, useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { GROUP_TAGS } from "@/types/database";
import type { Guest } from "@/types/database";
import type { GuestInput } from "@/hooks/use-guests";
import { useHousehold } from "@/hooks/use-household";
import { SIDE_NONE, sideOptions } from "@/lib/guest-side";
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
import { Plus, Trash2 } from "lucide-react";

interface GuestDialogProps {
  guest?: Guest;
  onSave: (input: GuestInput) => Promise<unknown>;
  trigger?: React.ReactNode;
  /** Si fourni, la fenêtre propose un bouton de suppression. */
  onDelete?: () => Promise<unknown>;
  /** Mode contrôlé : la fenêtre est ouverte/fermée par le parent, sans déclencheur. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const emptyForm: GuestInput = {
  first_name: "",
  last_name: "",
  type: "adult",
  rsvp: "pending",
  group_tag: GROUP_TAGS[0],
  table_id: null,
  seat_index: null,
  side: null,
};

export function GuestDialog({
  guest,
  onSave,
  trigger,
  onDelete,
  open: controlledOpen,
  onOpenChange,
}: GuestDialogProps) {
  const { household } = useHousehold();
  const [internalOpen, setInternalOpen] = useState(false);
  const controlled = controlledOpen !== undefined;
  const open = controlled ? controlledOpen : internalOpen;
  const setOpen = controlled ? (onOpenChange ?? (() => {})) : setInternalOpen;
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<GuestInput>(guest ?? emptyForm);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset form draft when the dialog opens
    if (open) setForm(guest ?? emptyForm);
  }, [open, guest]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await onSave(form);
    setSaving(false);
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!controlled && (
        <DialogTrigger asChild>
          {trigger ?? (
            <Button size="sm">
              <Plus className="size-4" />
              Ajouter un invité
            </Button>
          )}
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{guest ? "Modifier l'invité" : "Nouvel invité"}</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="g-first">Prénom</Label>
                <Input
                  id="g-first"
                  required
                  value={form.first_name}
                  onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="g-last">Nom</Label>
                <Input
                  id="g-last"
                  value={form.last_name}
                  onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="g-type">Typologie</Label>
                <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v as Guest["type"] }))}>
                  <SelectTrigger id="g-type" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="adult">Adulte</SelectItem>
                    <SelectItem value="child">Enfant</SelectItem>
                    <SelectItem value="baby">Bébé</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="g-rsvp">Statut RSVP</Label>
                <Select value={form.rsvp} onValueChange={(v) => setForm((f) => ({ ...f, rsvp: v as Guest["rsvp"] }))}>
                  <SelectTrigger id="g-rsvp" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">En attente</SelectItem>
                    <SelectItem value="confirmed">Confirmé</SelectItem>
                    <SelectItem value="declined">Décliné</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="g-side">Invité de</Label>
              <Select
                value={form.side ?? SIDE_NONE}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, side: v === SIDE_NONE ? null : (v as Guest["side"]) }))
                }
              >
                <SelectTrigger id="g-side" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {sideOptions(household).map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="g-group">Rôle / Groupe</Label>
              <Select
                value={form.group_tag ?? GROUP_TAGS[0]}
                onValueChange={(v) => setForm((f) => ({ ...f, group_tag: v }))}
              >
                <SelectTrigger id="g-group" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GROUP_TAGS.map((g) => (
                    <SelectItem key={g} value={g}>
                      {g}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:justify-between">
            {guest && onDelete ? (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button type="button" variant="ghost" className="text-destructive hover:text-destructive">
                    <Trash2 className="size-4" />
                    Supprimer
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Supprimer cet invité ?</AlertDialogTitle>
                    <AlertDialogDescription>
                      {guest.first_name} {guest.last_name} sera retiré définitivement de la liste et du plan de
                      table.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Annuler</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={async () => {
                        await onDelete();
                        setOpen(false);
                      }}
                    >
                      Supprimer
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            ) : (
              <span />
            )}
            <Button type="submit" disabled={saving}>
              {guest ? "Enregistrer" : "Ajouter"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
