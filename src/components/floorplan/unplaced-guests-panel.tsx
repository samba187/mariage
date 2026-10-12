"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import type { Guest } from "@/types/database";
import { Search, UserRound } from "lucide-react";

const RSVP_HINT: Partial<Record<Guest["rsvp"], { label: string; className: string }>> = {
  pending: { label: "En attente", className: "bg-amber-100 text-amber-700" },
  declined: { label: "Décliné", className: "bg-muted text-muted-foreground" },
};

interface UnplacedGuestsPanelProps {
  guests: Guest[];
  selectedGuestId: string | null;
  onSelect: (id: string | null) => void;
}

export function UnplacedGuestsPanel({ guests, selectedGuestId, onSelect }: UnplacedGuestsPanelProps) {
  const [search, setSearch] = useState("");

  if (guests.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
        Tous les invités sont placés.
      </div>
    );
  }

  const query = search.trim().toLowerCase();
  const visible = query
    ? guests.filter((g) => `${g.first_name} ${g.last_name}`.toLowerCase().includes(query))
    : guests;

  return (
    <div className="space-y-1.5">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder={`Rechercher parmi ${guests.length} invités...`}
          className="h-8 pl-8 text-sm"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Cliquer un invité, puis une chaise libre.
      </p>
      {visible.length === 0 && <p className="py-3 text-center text-xs text-muted-foreground">Aucun résultat.</p>}
      <ul className="max-h-80 space-y-1 overflow-y-auto pr-1">
        {visible.map((guest) => {
          const hint = RSVP_HINT[guest.rsvp];
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
              <span className="min-w-0 flex-1 truncate">
                {guest.first_name} {guest.last_name}
              </span>
              {hint && (
                <span className={cn("shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium", hint.className)}>
                  {hint.label}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
