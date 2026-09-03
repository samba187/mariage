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
import type { WeddingTable } from "@/types/database";
import type { TableInput } from "@/hooks/use-tables";
import { Plus } from "lucide-react";

interface TableDialogProps {
  table?: WeddingTable;
  onSave: (input: TableInput) => Promise<void>;
  trigger?: React.ReactNode;
  nextTableNumber?: number;
}

const ROUND_CAPACITIES = [6, 8, 10, 12];

function makeEmptyForm(nextTableNumber: number): TableInput {
  return {
    name: `Table ${nextTableNumber}`,
    type: "round",
    capacity: 8,
    pos_x: 120 + ((nextTableNumber * 37) % 300),
    pos_y: 120 + ((nextTableNumber * 53) % 220),
    rotation: 0,
    scale: 1,
  };
}

export function TableDialog({ table, onSave, trigger, nextTableNumber = 1 }: TableDialogProps) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<TableInput>(table ?? makeEmptyForm(nextTableNumber));

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset form draft when the dialog opens
    if (open) setForm(table ?? makeEmptyForm(nextTableNumber));
  }, [open, table, nextTableNumber]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await onSave(form);
    setSaving(false);
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm">
            <Plus className="size-4" />
            Ajouter une table
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{table ? "Modifier la table" : "Nouvelle table"}</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="t-name">Nom de la table</Label>
              <Input
                id="t-name"
                required
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="t-type">Forme</Label>
              <Select
                value={form.type}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, type: v as WeddingTable["type"], capacity: v === "round" ? 8 : f.capacity }))
                }
              >
                <SelectTrigger id="t-type" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="round">Ronde</SelectItem>
                  <SelectItem value="rectangular">Rectangulaire</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="t-capacity">Capacité (nombre de places)</Label>
              {form.type === "round" ? (
                <Select
                  value={String(form.capacity)}
                  onValueChange={(v) => setForm((f) => ({ ...f, capacity: Number(v) }))}
                >
                  <SelectTrigger id="t-capacity" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROUND_CAPACITIES.map((c) => (
                      <SelectItem key={c} value={String(c)}>
                        {c} personnes
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  id="t-capacity"
                  type="number"
                  min={2}
                  max={20}
                  value={form.capacity}
                  onChange={(e) => setForm((f) => ({ ...f, capacity: Number(e.target.value) }))}
                />
              )}
            </div>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={saving}>
              {table ? "Enregistrer" : "Ajouter"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
