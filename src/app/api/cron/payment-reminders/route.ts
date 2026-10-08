import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";

export const dynamic = "force-dynamic";

/**
 * Nombre de jours avant l'échéance déclenchant un rappel. Les valeurs
 * négatives relancent un versement resté impayé après sa date.
 */
const REMINDER_OFFSETS = [14, 7, 3, 1, 0, -1, -3, -7, -14];

interface ReminderRow {
  payment_id: string;
  vendor_name: string;
  payment_label: string;
  amount: number;
  due_on: string;
  days_left: number;
  endpoint: string;
  p256dh: string;
  auth_key: string;
}

function euro(amount: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function whenLabel(days: number): string {
  if (days < 0) return `en retard de ${-days} jour${days < -1 ? "s" : ""}`;
  if (days === 0) return "aujourd'hui";
  if (days === 1) return "demain";
  return `dans ${days} jours`;
}

/**
 * Rappels d'échéance envoyés en push, y compris application fermée.
 * Déclenché quotidiennement par le cron Vercel (voir vercel.json).
 *
 * Les données sont lues via une fonction SECURITY DEFINER protégée par
 * CRON_SECRET : aucune clé service_role n'est nécessaire.
 */
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY;

  if (!cronSecret || !supabaseUrl || !anonKey || !vapidPublic || !vapidPrivate) {
    return Response.json({ error: "Configuration incomplète." }, { status: 500 });
  }

  // Vercel Cron envoie `Authorization: Bearer <CRON_SECRET>`. On accepte aussi
  // `?secret=` pour pouvoir déclencher un envoi manuellement.
  const url = new URL(request.url);
  const provided =
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? url.searchParams.get("secret");

  if (provided !== cronSecret) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT ?? "mailto:noreply@example.com",
    vapidPublic,
    vapidPrivate
  );

  const supabase = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase.rpc("due_payment_reminders", {
    secret: cronSecret,
    day_offsets: REMINDER_OFFSETS,
  });

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  const rows = (data ?? []) as ReminderRow[];
  let sent = 0;
  const stale = new Set<string>();

  for (const row of rows) {
    const body = JSON.stringify({
      title: `Paiement ${whenLabel(row.days_left)}`,
      body: `${row.vendor_name} — ${row.payment_label} : ${euro(Number(row.amount))}`,
      url: "/vendors",
      tag: `payment-${row.payment_id}-${row.due_on}`,
    });

    try {
      await webpush.sendNotification(
        { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth_key } },
        body
      );
      sent++;
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode;
      // 404/410 : l'abonnement n'existe plus côté navigateur.
      if (status === 404 || status === 410) stale.add(row.endpoint);
    }
  }

  for (const endpoint of stale) {
    await supabase.rpc("prune_push_subscription", { secret: cronSecret, target_endpoint: endpoint });
  }

  return Response.json({ sent, due: rows.length, pruned: stale.size });
}
