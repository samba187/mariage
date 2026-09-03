import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import { ensureFreshSession } from "@/lib/supabase/session";
import { toast } from "sonner";

interface WriteResult<T> {
  data: T[] | null;
  error: PostgrestError | null;
}

/**
 * Exécute une écriture en s'assurant qu'elle a réellement affecté une ligne.
 *
 * Une écriture bloquée par RLS (jeton expiré, foyer changé) renvoie 200 avec
 * zéro ligne et aucune erreur. Sans cette vérification, l'interface annonce
 * une sauvegarde qui n'a jamais eu lieu.
 *
 * Retourne true si la ligne a bien été écrite.
 */
export async function writeChecked<T>(
  supabase: SupabaseClient,
  run: () => PromiseLike<WriteResult<T>>,
  options: { expectRows?: boolean } = {}
): Promise<boolean> {
  const { expectRows = true } = options;

  await ensureFreshSession(supabase);
  let { data, error } = await run();

  // Aucune erreur mais aucune ligne touchée : jeton probablement périmé.
  // On rafraîchit explicitement puis on réessaie une fois.
  if (!error && expectRows && (!data || data.length === 0)) {
    const session = await supabase.auth.refreshSession();
    if (session.data.session) {
      ({ data, error } = await run());
    }
  }

  if (error) {
    toast.error(error.message);
    return false;
  }

  if (expectRows && (!data || data.length === 0)) {
    toast.error("Modification non enregistrée. Rechargez la page et réessayez.");
    return false;
  }

  return true;
}
