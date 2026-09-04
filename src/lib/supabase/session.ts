import type { Session, SupabaseClient } from "@supabase/supabase-js";

let pending: Promise<Session | null> | null = null;

/**
 * Garantit une session utilisable avant toute requête.
 *
 * Quand aucune session n'est disponible, supabase-js retombe silencieusement
 * sur la clé anonyme (`_getAccessToken` : `?? this.supabaseKey`). La requête
 * part alors sans identité : `auth.uid()` est nul, les policies RLS ne
 * correspondent plus, les lectures renvoient une liste vide et les
 * suppressions n'affectent aucune ligne — le tout en HTTP 200.
 *
 * Les appels concurrents partagent volontairement la même promesse : un
 * refresh token est à usage unique, deux rafraîchissements simultanés le
 * détruiraient et condamneraient la session.
 */
export function ensureSession(supabase: SupabaseClient): Promise<Session | null> {
  if (!pending) {
    pending = (async () => {
      // getSession() rafraîchit lui-même un jeton expiré, sous son propre verrou.
      const { data } = await supabase.auth.getSession();
      if (data.session) return data.session;

      // Session définitivement perdue : on en ouvre une nouvelle plutôt que de
      // laisser partir des requêtes anonymes qui échoueraient en silence.
      await supabase.auth.signOut().catch(() => undefined);
      const { data: fresh } = await supabase.auth.signInAnonymously();
      return fresh.session ?? null;
    })().finally(() => {
      pending = null;
    });
  }
  return pending;
}
