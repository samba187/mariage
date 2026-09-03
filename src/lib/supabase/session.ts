import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Garantit un jeton d'accès valide avant une requête.
 *
 * Sans ça, un jeton expiré ne provoque aucune erreur : les policies RLS ne
 * correspondent plus, les lectures renvoient une liste vide et les écritures
 * ne touchent aucune ligne — le tout avec un statut 200. L'utilisateur voit
 * alors ses données disparaître, ou une sauvegarde « réussie » sans effet.
 */
export async function ensureFreshSession(supabase: SupabaseClient) {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) return null;

  const expiresAtMs = (session.expires_at ?? 0) * 1000;
  // Marge de 60 s pour couvrir la latence réseau.
  if (Date.now() < expiresAtMs - 60_000) return session;

  const { data, error } = await supabase.auth.refreshSession();
  if (error) return null;
  return data.session;
}
