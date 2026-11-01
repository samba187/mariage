"use client";

import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TableDialog } from "@/components/floorplan/table-dialog";
import { cn } from "@/lib/utils";
import type { Guest, WeddingTable } from "@/types/database";
import type { TableInput } from "@/hooks/use-tables";
import { ArrowLeft, Pencil, Plus, Search, X } from "lucide-react";

const RSVP_HINT: Partial<Record<Guest["rsvp"], { label: string; className: string }>> = {
  pending: { label: "En attente", className: "bg-amber-100 text-amber-700" },
  declined: { label: "Décliné", className: "bg-muted text-muted-foreground" },
};

const guestName = (g: Guest) => `${g.first_name} ${g.last_name}`.trim();

interface TableSeatsDialogProps {
  table: WeddingTable | null;
  /** Place à remplir directement (chaise libre touchée sur le plan). */
  initialSeat: number | null;
  tables: WeddingTable[];
  guests: Guest[];
  onClose: () => void;
  onAssign: (guestId: string, tableId: string, seatIndex: number) => Promise<unknown>;
  onUnassign: (guestId: string) => Promise<unknown>;
  onUpdateTable: (id: string, input: Partial<TableInput>) => Promise<unknown>;
}

export function TableSeatsDialog(props: TableSeatsDialogProps) {
  return (
    <Dialog open={!!props.table} onOpenChange={(open) => !open && props.onClose()}>
      <DialogContent className="flex max-h-[88svh] flex-col gap-3 sm:max-w-md">
        {/* key : l'état (place choisie, recherche) repart de zéro à chaque table. */}
        {props.table && <TableSeatsContent key={`${props.table.id}|${props.initialSeat}`} {...props} table={props.table} />}
      </DialogContent>
    </Dialog>
  );
}

function TableSeatsContent({
  table,
  initialSeat,
  tables,
  guests,
  onAssign,
  onUnassign,
  onUpdateTable,
}: TableSeatsDialogProps & { table: WeddingTable }) {
  // null : liste des places ; un nombre : choix de l'invité pour cette place.
  const [pickingSeat, setPickingSeat] = useState<number | null>(initialSeat);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);

  const seated = guests.filter((g) => g.table_id === table.id);
  const bySeat = new Map(seated.filter((g) => g.seat_index != null).map((g) => [g.seat_index!, g]));
  // Invités rattachés à la table sans place valide (capacité réduite depuis, par exemple).
  const withoutSeat = seated.filter((g) => g.seat_index == null || g.seat_index >= table.capacity);
  const freeSeats = Array.from({ length: table.capacity }, (_, i) => i).filter((i) => !bySeat.has(i));

  const tableName = useMemo(() => new Map(tables.map((t) => [t.id, t.name])), [tables]);

  const candidates = useMemo(() => {
    const query = search.trim().toLowerCase();
    return guests
      .filter((g) => g.table_id !== table.id)
      .filter((g) => !query || guestName(g).toLowerCase().includes(query))
      .sort((a, b) => {
        // Les non placés d'abord, puis ceux déjà assis ailleurs.
        if (!a.table_id !== !b.table_id) return a.table_id ? 1 : -1;
        return guestName(a).localeCompare(guestName(b), "fr", { sensitivity: "base" });
      });
  }, [guests, search, table.id]);

  async function pick(guest: Guest) {
    if (pickingSeat === null) return;
    setBusy(true);
    await onAssign(guest.id, table.id, pickingSeat);
    setBusy(false);
    setSearch("");
    setPickingSeat(null);
  }

  if (pickingSeat !== null) {
    return (
      <>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Button size="icon" variant="ghost" className="-ml-2 size-8" onClick={() => setPickingSeat(null)} aria-label="Retour">
              <ArrowLeft className="size-4" />
            </Button>
            {table.name} · place {pickingSeat + 1}
          </DialogTitle>
          <DialogDescription>Choisissez l&apos;invité à asseoir ici.</DialogDescription>
        </DialogHeader>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Rechercher un invité..."
            className="h-10 pl-9 text-base sm:text-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <ul className="-mx-1 min-h-0 flex-1 space-y-1 overflow-y-auto px-1">
          {candidates.length === 0 && (
            <li className="py-6 text-center text-sm text-muted-foreground">Aucun invité trouvé.</li>
          )}
          {candidates.map((g) => {
            const hint = RSVP_HINT[g.rsvp];
            return (
              <li key={g.id}>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => pick(g)}
                  className="flex min-h-11 w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-muted active:bg-muted disabled:opacity-50"
                >
                  <span className="min-w-0 flex-1 truncate font-medium">{guestName(g)}</span>
                  {g.table_id && (
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {tableName.get(g.table_id) ?? "Autre table"}
                    </span>
                  )}
                  {hint && (
                    <span className={cn("shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium", hint.className)}>
                      {hint.label}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </>
    );
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2 pr-8">
          <span className="truncate">{table.name}</span>
          <TableDialog
            table={table}
            onSave={(input) => onUpdateTable(table.id, input)}
            trigger={
              <Button size="icon" variant="ghost" className="size-8 shrink-0" aria-label="Modifier la table">
                <Pencil className="size-3.5" />
              </Button>
            }
          />
        </DialogTitle>
        <DialogDescription>
          {seated.length}/{table.capacity} places occupées
        </DialogDescription>
      </DialogHeader>

      {freeSeats.length > 0 && (
        <Button className="w-full" onClick={() => setPickingSeat(freeSeats[0])}>
          <Plus className="size-4" />
          Ajouter un invité
        </Button>
      )}

      <ul className="-mx-1 min-h-0 flex-1 space-y-1 overflow-y-auto px-1">
        {Array.from({ length: table.capacity }, (_, i) => {
          const occupant = bySeat.get(i);
          return (
            <li key={i} className="flex items-center gap-2">
              <span
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                  occupant ? "bg-rose-600 text-white" : "border text-muted-foreground"
                )}
              >
                {i + 1}
              </span>
              {occupant ? (
                <>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{guestName(occupant)}</span>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-10 shrink-0 text-muted-foreground"
                    onClick={() => onUnassign(occupant.id)}
                    aria-label={`Retirer ${occupant.first_name}`}
                  >
                    <X className="size-4" />
                  </Button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setPickingSeat(i)}
                  className="flex min-h-10 flex-1 items-center rounded-md border border-dashed px-3 text-left text-sm text-muted-foreground hover:bg-muted active:bg-muted"
                >
                  Place libre — toucher pour choisir
                </button>
              )}
            </li>
          );
        })}

        {withoutSeat.map((g) => (
          <li key={g.id} className="flex items-center gap-2">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-amber-300 text-xs text-amber-700">
              ?
            </span>
            <span className="min-w-0 flex-1 truncate text-sm">
              {guestName(g)} <span className="text-xs text-muted-foreground">(sans place)</span>
            </span>
            <Button
              size="icon"
              variant="ghost"
              className="size-10 shrink-0 text-muted-foreground"
              onClick={() => onUnassign(g.id)}
              aria-label={`Retirer ${g.first_name}`}
            >
              <X className="size-4" />
            </Button>
          </li>
        ))}
      </ul>
    </>
  );
}
