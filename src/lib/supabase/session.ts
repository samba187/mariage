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
let refreshing: Promise<Session | null> | null = null;

/**
 * Force un rafraîchissement, en dernier recours après une écriture refusée.
 *
 * Utile quand l'horloge de l'appareil est décalée : le jeton paraît valide
 * localement alors que le serveur le rejette (ou l'inverse). Strictement
 * sérialisé, pour la même raison que ci-dessus.
 */
export function forceRefresh(supabase: SupabaseClient): Promise<Session | null> {
  if (!refreshing) {
    refreshing = supabase.auth
      .refreshSession()
      .then(({ data }) => data.session ?? null)
      .catch(() => null)
      .finally(() => {
        refreshing = null;
      });
  }
  return refreshing;
}

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
