import type { Session, SupabaseClient } from "@supabase/supabase-js";

let pending: Promise<Session | null> | null = null;
let refreshing: Promise<Session | null> | null = null;

/** Empêche de réessayer en boucle quand le serveur refuse (429, panne...). */
let cooldownUntil = 0;
const COOLDOWN_MS = 30_000;

/**
 * Force un rafraîchissement, en dernier recours après une écriture refusée.
 *
 * Utile quand l'horloge de l'appareil est décalée : le jeton peut sembler
 * valide localement tout en étant rejeté par le serveur, ou l'inverse.
 * Strictement sérialisé — un refresh token est à usage unique, deux appels
 * simultanés le détruiraient et condamneraient la session.
 */
export function forceRefresh(supabase: SupabaseClient): Promise<Session | null> {
  if (Date.now() < cooldownUntil) return Promise.resolve(null);

  if (!refreshing) {
    refreshing = supabase.auth
      .refreshSession()
      .then(({ data, error }) => {
        if (error) cooldownUntil = Date.now() + COOLDOWN_MS;
        return data.session ?? null;
      })
      .catch(() => {
        cooldownUntil = Date.now() + COOLDOWN_MS;
        return null;
      })
      .finally(() => {
        refreshing = null;
      });
  }
  return refreshing;
}

/**
 * Garantit une session utilisable avant toute requête.
 *
 * Quand aucune session n'est disponible, supabase-js retombe silencieusement
 * sur la clé anonyme (`_getAccessToken` : `?? this.supabaseKey`). La requête
 * part alors sans identité : `auth.uid()` est nul, les policies RLS ne
 * correspondent plus, les lectures renvoient une liste vide et les
 * suppressions n'affectent aucune ligne — le tout en HTTP 200.
 *
 * Les appels concurrents partagent la même promesse, et une ouverture de
 * session en échec impose un délai avant nouvelle tentative : sans ce
 * garde-fou, une horloge décalée ou un serveur indisponible entraînerait une
 * rafale de connexions jusqu'au blocage par le serveur.
 */
export function ensureSession(supabase: SupabaseClient): Promise<Session | null> {
  if (!pending) {
    pending = (async () => {
      // getSession() rafraîchit lui-même un jeton expiré, sous son propre verrou.
      const { data } = await supabase.auth.getSession();
      if (data.session) return data.session;

      if (Date.now() < cooldownUntil) return null;

      // Session définitivement perdue : on en ouvre une nouvelle plutôt que de
      // laisser partir des requêtes anonymes qui échoueraient en silence.
      await supabase.auth.signOut().catch(() => undefined);
      const { data: fresh, error } = await supabase.auth.signInAnonymously();
      if (error) {
        cooldownUntil = Date.now() + COOLDOWN_MS;
        return null;
      }
      return fresh.session ?? null;
    })().finally(() => {
      pending = null;
    });
  }
  return pending;
}
