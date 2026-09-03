"use client";

import { createClient } from "@/lib/supabase/client";
import { writeChecked } from "@/lib/supabase/write";
import { useRealtimeCollection } from "@/hooks/use-realtime-collection";
import type { WeddingTable } from "@/types/database";
import { toast } from "sonner";

export type TableInput = Omit<WeddingTable, "id" | "household_id" | "created_at">;

export function useTables(householdId: string | undefined) {
  const supabase = createClient();
  const { rows: tables, loading } = useRealtimeCollection<WeddingTable>(
    "wedding_tables",
    householdId,
    { errorLabel: "du plan de table" }
  );

  async function addTable(input: TableInput) {
    if (!householdId) return;
    const { data, error } = await supabase
      .from("wedding_tables")
      .insert({ ...input, household_id: householdId })
      .select()
      .single();
    if (error) toast.error(error.message);
    return data as WeddingTable | undefined;
  }

  async function updateTable(id: string, input: Partial<TableInput>) {
    return writeChecked(supabase, () =>
      supabase.from("wedding_tables").update(input).eq("id", id).select()
    );
  }

  async function deleteTable(id: string) {
    const ok = await writeChecked(supabase, () =>
      supabase.from("wedding_tables").delete().eq("id", id).select()
    );
    if (ok) toast.success("Table supprimée");
  }

  return { tables, loading, addTable, updateTable, deleteTable };
}
