"use client";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { GuestDialog } from "@/components/guests/guest-dialog";
import type { Guest, WeddingTable } from "@/types/database";
import type { GuestInput } from "@/hooks/use-guests";
import { Pencil, Trash2 } from "lucide-react";

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
  onUpdate: (id: string, input: Partial<GuestInput>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export function GuestTable({ guests, tables, onUpdate, onDelete }: GuestTableProps) {
  const tableName = (id: string | null) => tables.find((t) => t.id === id)?.name ?? "—";

  if (guests.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
        Aucun résultat.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nom</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Groupe</TableHead>
            <TableHead>RSVP</TableHead>
            <TableHead>Table</TableHead>
            <TableHead className="w-20" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {guests.map((guest) => (
            <TableRow key={guest.id}>
              <TableCell className="font-medium">
                {guest.first_name} {guest.last_name}
              </TableCell>
              <TableCell className="text-muted-foreground">{TYPE_LABEL[guest.type]}</TableCell>
              <TableCell className="text-muted-foreground">{guest.group_tag ?? "—"}</TableCell>
              <TableCell>
                <Badge className={RSVP_VARIANT[guest.rsvp]} variant="secondary">
                  {RSVP_LABEL[guest.rsvp]}
                </Badge>
              </TableCell>
              <TableCell className="text-muted-foreground">{tableName(guest.table_id)}</TableCell>
              <TableCell>
                <div className="flex items-center justify-end gap-1">
                  <GuestDialog
                    guest={guest}
                    onSave={(input) => onUpdate(guest.id, input)}
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
                        <AlertDialogTitle>Supprimer cet invité ?</AlertDialogTitle>
                        <AlertDialogDescription>
                          {guest.first_name} {guest.last_name} sera retiré définitivement de la liste et du plan de
                          table.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Annuler</AlertDialogCancel>
                        <AlertDialogAction onClick={() => onDelete(guest.id)}>Supprimer</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
