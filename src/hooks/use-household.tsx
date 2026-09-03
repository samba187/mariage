"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { writeChecked } from "@/lib/supabase/write";
import type { Household } from "@/types/database";
import type { User } from "@supabase/supabase-js";

export type HouseholdSettings = Partial<
  Pick<
    Household,
    | "name"
    | "wedding_date"
    | "partner1_name"
    | "partner2_name"
    | "budget_target"
    | "room_shape"
    | "room_width"
    | "room_height"
    | "landmarks"
  >
>;

interface HouseholdContextValue {
  household: Household | null;
  user: User | null;
  loading: boolean;
  refresh: () => Promise<void>;
  updateHousehold: (input: HouseholdSettings) => Promise<void>;
}

const HouseholdContext = createContext<HouseholdContextValue | null>(null);

export function HouseholdProvider({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const [household, setHousehold] = useState<Household | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    let {
      data: { user: currentUser },
    } = await supabase.auth.getUser();

    if (!currentUser) {
      const { data, error } = await supabase.auth.signInAnonymously();
      if (error) {
        setLoading(false);
        return;
      }
      currentUser = data.user;
    }
    setUser(currentUser);

    const { data: membership, error: membershipError } = await supabase
      .from("household_members")
      .select("household_id")
      .eq("user_id", currentUser!.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // Ne jamais créer un foyer sur une lecture en échec : ça masquerait les
    // données existantes derrière un espace vide.
    if (membershipError) {
      setLoading(false);
      return;
    }

    const householdId = membership?.household_id;

    if (!householdId) {
      const { data: newHousehold, error: createError } = await supabase
        .rpc("create_household")
        .single();
      if (createError || !newHousehold) {
        setLoading(false);
        return;
      }
      setHousehold(newHousehold as Household);
      setLoading(false);
      return;
    }

    const { data: householdData } = await supabase
      .from("households")
      .select("*")
      .eq("id", householdId)
      .single();

    setHousehold(householdData);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- session + foyer au montage
    load();
  }, [load]);

  // Voir use-realtime-collection : un jeton expiré renvoie des résultats vides
  // sans erreur, il faut donc recharger dès qu'il est rafraîchi.
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "TOKEN_REFRESHED") load();
    });
    return () => data.subscription.unsubscribe();
  }, [load, supabase]);

  useEffect(() => {
    if (!household) return;
    const channel = supabase
      .channel(`household-${household.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "households", filter: `id=eq.${household.id}` },
        (payload) => setHousehold(payload.new as Household)
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // Re-souscrire uniquement au changement de foyer, pas à chaque champ modifié.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [household?.id, supabase]);

  const updateHousehold = useCallback(
    async (input: HouseholdSettings) => {
      if (!household) return;
      const previous = household;
      setHousehold((h) => (h ? { ...h, ...input } : h));

      const ok = await writeChecked(supabase, () =>
        supabase.from("households").update(input).eq("id", previous.id).select()
      );

      // Écriture refusée : on remet l'affichage en accord avec la base plutôt
      // que de laisser croire à une sauvegarde.
      if (!ok) setHousehold(previous);
    },
    [household, supabase]
  );

  return (
    <HouseholdContext.Provider value={{ household, user, loading, refresh: load, updateHousehold }}>
      {children}
    </HouseholdContext.Provider>
  );
}

export function useHousehold() {
  const ctx = useContext(HouseholdContext);
  if (!ctx) throw new Error("useHousehold must be used within HouseholdProvider");
  return ctx;
}
