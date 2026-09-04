import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import { ensureSession } from "@/lib/supabase/session";
import { toast } from "sonner";

interface WriteResult<T> {
  data: T[] | null;
  error: PostgrestError | null;
}

/**
 * Exécute une écriture avec une session garantie, puis vérifie qu'elle a bien
 * affecté une ligne.
 *
 * Une écriture partie sans identité valable ne renvoie pas d'erreur : elle
 * répond 200 avec zéro ligne. Sans cette vérification, l'interface annoncerait
 * une sauvegarde qui n'a jamais eu lieu.
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

  const { data, error } = await run();

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
