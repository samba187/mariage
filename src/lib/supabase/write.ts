import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import { ensureSession, forceRefresh } from "@/lib/supabase/session";
import { toast } from "sonner";

interface WriteResult<T> {
  data: T[] | null;
  error: PostgrestError | null;
}

/** Refus dû à RLS : l'identité n'a pas été reconnue par le serveur. */
function isPermissionError(error: PostgrestError | null): boolean {
  return error?.code === "42501" || error?.code === "PGRST301";
}

/**
 * Exécute une écriture avec une session garantie, puis vérifie qu'elle a bien
 * affecté une ligne.
 *
 * Une écriture partie sans identité valable ne renvoie pas toujours d'erreur :
 * une suppression répond 200 avec zéro ligne. Sans cette vérification,
 * l'interface annoncerait une sauvegarde qui n'a jamais eu lieu.
 *
 * En cas de refus, on force un unique rafraîchissement — sérialisé — puis on
 * réessaie une fois : cela couvre les appareils dont l'horloge est décalée,
 * où le jeton semble valide localement mais est rejeté par le serveur.
 */
export async function writeChecked<T>(
  supabase: SupabaseClient,
  run: () => PromiseLike<WriteResult<T>>
): Promise<boolean> {
  const session = await ensureSession(supabase);
  if (!session) {
    toast.error("Session expirée. Rechargez la page.");
    return false;
  }

  let { data, error } = await run();

  const rejected = isPermissionError(error) || (!error && (!data || data.length === 0));
  if (rejected) {
    const refreshed = await forceRefresh(supabase);
    if (refreshed) ({ data, error } = await run());
  }

  if (error) {
    toast.error(error.message);
    return false;
  }

  if (!data || data.length === 0) {
    toast.error("Modification non enregistrée. Rechargez la page et réessayez.");
    return false;
  }

  return true;
}
