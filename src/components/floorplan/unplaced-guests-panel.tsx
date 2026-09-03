"use client";

import { cn } from "@/lib/utils";
import type { Guest } from "@/types/database";
import { UserRound } from "lucide-react";

interface UnplacedGuestsPanelProps {
  guests: Guest[];
  selectedGuestId: string | null;
  onSelect: (id: string | null) => void;
}

export function UnplacedGuestsPanel({ guests, selectedGuestId, onSelect }: UnplacedGuestsPanelProps) {
  if (guests.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
        Tous les invités confirmés sont placés.

      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <p className="text-xs text-muted-foreground">
        Cliquer un invité, puis une chaise libre.
      </p>
      <ul className="max-h-80 space-y-1 overflow-y-auto pr-1">
        {guests.map((guest) => {
          const selected = guest.id === selectedGuestId;
          return (
            <li
              key={guest.id}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData("text/guest-id", guest.id);
                e.dataTransfer.effectAllowed = "move";
              }}
              onClick={() => onSelect(selected ? null : guest.id)}
              className={cn(
                "flex cursor-pointer items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm transition-colors",
                selected
                  ? "border-rose-400 bg-rose-50 text-rose-700 ring-1 ring-rose-300"
                  : "border-transparent bg-muted/60 hover:bg-muted"
              )}
            >
              <UserRound className="size-3.5 shrink-0 text-muted-foreground" />
              <span className="truncate">
                {guest.first_name} {guest.last_name}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
