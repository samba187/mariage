"use client";

import { useMemo, useState } from "react";
import { useHousehold } from "@/hooks/use-household";
import { useGuests } from "@/hooks/use-guests";
import { useTables } from "@/hooks/use-tables";
import { GuestCounters } from "@/components/guests/guest-counters";
import { GuestFilters, type GuestFiltersState } from "@/components/guests/guest-filters";
import { GuestTable } from "@/components/guests/guest-table";
import { GuestDialog } from "@/components/guests/guest-dialog";
import { Skeleton } from "@/components/ui/skeleton";

const defaultFilters: GuestFiltersState = { search: "", rsvp: "all", group: "all" };

export default function GuestsPage() {
  const { household } = useHousehold();
  const { guests, loading, addGuest, updateGuest, deleteGuest } = useGuests(household?.id);
  const { tables } = useTables(household?.id);
  const [filters, setFilters] = useState<GuestFiltersState>(defaultFilters);

  const filteredGuests = useMemo(() => {
    const search = filters.search.trim().toLowerCase();
    return guests.filter((g) => {
      if (filters.rsvp !== "all" && g.rsvp !== filters.rsvp) return false;
      if (filters.group !== "all" && g.group_tag !== filters.group) return false;
      if (search) {
        const full = `${g.first_name} ${g.last_name}`.toLowerCase();
        if (!full.includes(search)) return false;
      }
      return true;
    });
  }, [guests, filters]);

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-8">
      <h1 className="text-2xl font-semibold tracking-tight">Invités</h1>

      {loading ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      ) : (
        <GuestCounters guests={guests} />
      )}

      <div className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-medium">Liste des invités</h2>
          <GuestDialog onSave={addGuest} />
        </div>
        <GuestFilters value={filters} onChange={setFilters} />
        {loading ? (
          <Skeleton className="h-64 rounded-lg" />
        ) : (
          <GuestTable guests={filteredGuests} tables={tables} onUpdate={updateGuest} onDelete={deleteGuest} />
        )}
      </div>
    </div>
  );
}
