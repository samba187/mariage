"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TableDialog } from "@/components/floorplan/table-dialog";
import type { Guest, WeddingTable } from "@/types/database";
import type { TableInput } from "@/hooks/use-tables";
import { cn } from "@/lib/utils";
import { Pencil, Trash2, X } from "lucide-react";

interface TablesListProps {
  tables: WeddingTable[];
  guests: Guest[];
  onUpdateTable: (id: string, input: Partial<TableInput>) => Promise<void>;
  onDeleteTable: (id: string) => Promise<void>;
  onUnassignGuest: (guestId: string) => Promise<void>;
}

export function TablesList({ tables, guests, onUpdateTable, onDeleteTable, onUnassignGuest }: TablesListProps) {
  if (tables.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
        Aucune table.
      </div>
    );
  }

  return (
    <ul className="max-h-80 space-y-2 overflow-y-auto pr-1">
      {tables.map((table) => {
        const seated = guests.filter((g) => g.table_id === table.id);
        const full = seated.length >= table.capacity;
        return (
          <li key={table.id} className="rounded-lg border p-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{table.name}</p>
                <p className="text-xs text-muted-foreground">{table.type === "round" ? "Ronde" : "Rectangulaire"}</p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Badge
                  variant="secondary"
                  className={cn(full ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700")}
                >
                  {seated.length}/{table.capacity}
                </Badge>
                <TableDialog
                  table={table}
                  onSave={(input) => onUpdateTable(table.id, input)}
                  trigger={
                    <Button size="icon" variant="ghost" className="size-7">
                      <Pencil className="size-3.5" />
                    </Button>
                  }
                />
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-7 text-destructive hover:text-destructive"
                  onClick={() => onDeleteTable(table.id)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </div>
            {seated.length > 0 && (
              <ul className="mt-2 space-y-1 border-t pt-2">
                {seated.map((g) => (
                  <li key={g.id} className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="truncate">
                      {g.first_name} {g.last_name}
                    </span>
                    <button
                      onClick={() => onUnassignGuest(g.id)}
                      className="shrink-0 rounded p-0.5 hover:bg-muted hover:text-foreground"
                      title="Retirer de la table"
                    >
                      <X className="size-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </li>
        );
      })}
    </ul>
  );
}
