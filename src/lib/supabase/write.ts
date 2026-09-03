import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import { toast } from "sonner";

interface WriteResult<T> {
  data: T[] | null;
  error: PostgrestError | null;
}

/**
 * Exécute une écriture et vérifie qu'elle a bien affecté une ligne.
 *
 * Une écriture bloquée par RLS ne renvoie pas d'erreur : elle répond 200 avec
 * zéro ligne. Sans cette vérification, l'interface annoncerait une sauvegarde
 * qui n'a jamais eu lieu.
 *
 * Ne touche jamais à la session : supabase-js rafraîchit déjà le jeton avant
 * chaque requête, sous verrou. Rafraîchir manuellement ici ferait courir
 * plusieurs appels concurrents sur un refresh token à usage unique, ce qui
 * invalide la session et casse toutes les écritures.
 */
export async function writeChecked<T>(
  supabase: SupabaseClient,
  run: () => PromiseLike<WriteResult<T>>
): Promise<boolean> {
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
