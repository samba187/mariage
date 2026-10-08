"use client";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { GuestDialog } from "@/components/guests/guest-dialog";
import type { Guest, WeddingTable } from "@/types/database";
import type { GuestInput } from "@/hooks/use-guests";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useHousehold } from "@/hooks/use-household";
import { useState } from "react";
import { SIDE_NONE, sideOptions } from "@/lib/guest-side";

const RSVP_LABEL: Record<Guest["rsvp"], string> = {
  confirmed: "Confirmé",
  pending: "En attente",
  declined: "Décliné",
};

const RSVP_VARIANT: Record<Guest["rsvp"], string> = {
  confirmed: "bg-emerald-100 text-emerald-700",
  pending: "bg-amber-100 text-amber-700",
  declined: "bg-muted text-muted-foreground",
};

const TYPE_LABEL: Record<Guest["type"], string> = {
  adult: "Adulte",
  child: "Enfant",
  baby: "Bébé",
};

interface GuestTableProps {
  guests: Guest[];
  tables: WeddingTable[];
  onUpdate: (id: string, input: Partial<GuestInput>) => Promise<unknown>;
  onDelete: (id: string) => Promise<void>;
}

export function GuestTable({ guests, tables, onUpdate, onDelete }: GuestTableProps) {
  const { household } = useHousehold();
  const [editingId, setEditingId] = useState<string | null>(null);
  const editing = guests.find((g) => g.id === editingId);
  const tableName = (id: string | null) => tables.find((t) => t.id === id)?.name ?? "—";

  if (guests.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
        Aucun résultat.
      </div>
    );
  }

  return (
    <>
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nom</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Invité de</TableHead>
            <TableHead>Groupe</TableHead>
            <TableHead>RSVP</TableHead>
            <TableHead>Table</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {guests.map((guest) => (
            <TableRow key={guest.id} className="cursor-pointer" onClick={() => setEditingId(guest.id)}>
              <TableCell className="font-medium">
                {guest.first_name} {guest.last_name}
              </TableCell>
              <TableCell className="text-muted-foreground">{TYPE_LABEL[guest.type]}</TableCell>
              <TableCell onClick={(e) => e.stopPropagation()}>
                <Select
                  value={guest.side ?? SIDE_NONE}
                  onValueChange={(v) =>
                    onUpdate(guest.id, { side: v === SIDE_NONE ? null : (v as Guest["side"]) })
                  }
                >
                  <SelectTrigger size="sm" className="w-36" aria-label="Côté de l'invité">
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
              </TableCell>
              <TableCell className="text-muted-foreground">{guest.group_tag ?? "—"}</TableCell>
              <TableCell>
                <Badge className={RSVP_VARIANT[guest.rsvp]} variant="secondary">
                  {RSVP_LABEL[guest.rsvp]}
                </Badge>
              </TableCell>
              <TableCell className="text-muted-foreground">{tableName(guest.table_id)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
    <GuestDialog
      key={editing?.id}
      guest={editing}
      open={!!editing}
      onOpenChange={(open) => !open && setEditingId(null)}
      onSave={(input) => onUpdate(editing!.id, input)}
      onDelete={() => onDelete(editing!.id)}
    />
    </>
  );
}
