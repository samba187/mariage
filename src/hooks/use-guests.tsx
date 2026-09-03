"use client";

import { createClient } from "@/lib/supabase/client";
import { writeChecked } from "@/lib/supabase/write";
import { useRealtimeCollection } from "@/hooks/use-realtime-collection";
import type { Guest } from "@/types/database";
import { toast } from "sonner";

export type GuestInput = Omit<Guest, "id" | "household_id" | "created_at" | "updated_at">;

export function useGuests(householdId: string | undefined) {
  const supabase = createClient();
  const { rows: guests, loading } = useRealtimeCollection<Guest>("guests", householdId, {
    errorLabel: "des invités",
  });

  async function addGuest(input: GuestInput) {
    if (!householdId) return;
    const ok = await writeChecked(supabase, () =>
      supabase.from("guests").insert({ ...input, household_id: householdId }).select()
    );
    if (ok) toast.success("Invité ajouté");
  }

  async function updateGuest(id: string, input: Partial<GuestInput>) {
    return writeChecked(supabase, () =>
      supabase.from("guests").update(input).eq("id", id).select()
    );
  }

  async function deleteGuest(id: string) {
    const ok = await writeChecked(supabase, () =>
      supabase.from("guests").delete().eq("id", id).select()
    );
    if (ok) toast.success("Invité supprimé");
  }

  return { guests, loading, addGuest, updateGuest, deleteGuest };
}
