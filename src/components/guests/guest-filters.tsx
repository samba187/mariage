"use client";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { GROUP_TAGS } from "@/types/database";
import { Search } from "lucide-react";

export interface GuestFiltersState {
  search: string;
  rsvp: string;
  group: string;
}

interface GuestFiltersProps {
  value: GuestFiltersState;
  onChange: (value: GuestFiltersState) => void;
}

export function GuestFilters({ value, onChange }: GuestFiltersProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Rechercher un invité..."
          className="pl-9"
          value={value.search}
          onChange={(e) => onChange({ ...value, search: e.target.value })}
        />
      </div>
      <div className="flex gap-2">
        <Select value={value.rsvp} onValueChange={(v) => onChange({ ...value, rsvp: v })}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="RSVP" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            <SelectItem value="confirmed">Confirmé</SelectItem>
            <SelectItem value="pending">En attente</SelectItem>
            <SelectItem value="declined">Décliné</SelectItem>
          </SelectContent>
        </Select>
        <Select value={value.group} onValueChange={(v) => onChange({ ...value, group: v })}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="Groupe" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les groupes</SelectItem>
            {GROUP_TAGS.map((g) => (
              <SelectItem key={g} value={g}>
                {g}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
