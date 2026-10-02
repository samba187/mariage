import type { GuestSide, Household } from "@/types/database";

export const SIDE_NONE = "none";

export function sideLabel(
  household: Pick<Household, "partner1_name" | "partner2_name"> | null,
  side: GuestSide
): string {
  if (side === "partner1") return household?.partner1_name?.trim() || "Partenaire 1";
  return household?.partner2_name?.trim() || "Partenaire 2";
}

export function sideOptions(household: Pick<Household, "partner1_name" | "partner2_name"> | null) {
  return [
    { value: SIDE_NONE, label: "Non précisé" },
    { value: "partner1", label: sideLabel(household, "partner1") },
    { value: "partner2", label: sideLabel(household, "partner2") },
  ];
}
