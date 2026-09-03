"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

interface Row {
  id: string;
}

/**
 * Charge une table cloisonnée par household_id et la maintient à jour en
 * direct (Realtime), avec rechargement au retour du réseau. Toutes les
 * collections de l'app suivent exactement ce schéma.
 */
export function useRealtimeCollection<T extends Row>(
  table: string,
  householdId: string | undefined,
  options?: { orderBy?: string; errorLabel?: string }
) {
  const supabase = createClient();
  const [rows, setRows] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const orderBy = options?.orderBy ?? "created_at";
  const errorLabel = options?.errorLabel ?? "des données";

  const load = useCallback(async () => {
    if (!householdId) return;
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .eq("household_id", householdId)
      .order(orderBy, { ascending: true });
    if (error) toast.error(`Erreur lors du chargement ${errorLabel}`);
    else setRows((data ?? []) as T[]);
    setLoading(false);
  }, [householdId, supabase, table, orderBy, errorLabel]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- chargement initial
    load();
  }, [load]);

  useEffect(() => {
    window.addEventListener("online", load);
    return () => window.removeEventListener("online", load);
  }, [load]);

  // Un jeton expiré ne provoque pas d'erreur : le RLS filtre simplement tout et
  // la requête renvoie une liste vide. Sans ce rechargement au rafraîchissement
  // du jeton, l'utilisateur croirait ses données perdues.
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "TOKEN_REFRESHED" || event === "SIGNED_IN") load();
    });
    return () => data.subscription.unsubscribe();
  }, [load, supabase]);

  useEffect(() => {
    if (!householdId) return;
    const channel = supabase
      .channel(`${table}-${householdId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table, filter: `household_id=eq.${householdId}` },
        (payload) => {
          setRows((prev) => {
            if (payload.eventType === "INSERT") {
              const row = payload.new as T;
              return prev.some((r) => r.id === row.id) ? prev : [...prev, row];
            }
            if (payload.eventType === "UPDATE") {
              const row = payload.new as T;
              return prev.map((r) => (r.id === row.id ? row : r));
            }
            if (payload.eventType === "DELETE") {
              return prev.filter((r) => r.id !== (payload.old as T).id);
            }
            return prev;
          });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [householdId, supabase, table]);

  return { rows, setRows, loading, reload: load };
}
