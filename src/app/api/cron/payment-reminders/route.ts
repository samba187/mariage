import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";

export const dynamic = "force-dynamic";

/** Jours avant l'échéance où un rappel est envoyé. */
const REMINDER_OFFSETS = [14, 7, 1, 0];

interface PaymentRow {
  id: string;
  household_id: string;
  label: string;
  amount: number;
  due_date: string | null;
  due_on_wedding_day: boolean;
  vendors: { name: string } | null;
  households: { wedding_date: string | null } | null;
}

interface SubscriptionRow {
  id: string;
  household_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

function isoDay(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

function euro(amount: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Rappels d'échéance envoyés en push, y compris quand l'application est fermée.
 * Appelé par un cron (Vercel Cron ou autre) une fois par jour.
 */
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY;

  if (!supabaseUrl || !serviceKey || !vapidPublic || !vapidPrivate) {
    return Response.json(
      { error: "Configuration incomplète (SUPABASE_SERVICE_ROLE_KEY et clés VAPID requises)." },
      { status: 500 }
    );
  }

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT ?? "mailto:noreply@example.com",
    vapidPublic,
    vapidPrivate
  );

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const targetDates = REMINDER_OFFSETS.map(isoDay);

  const { data: payments, error } = await supabase
    .from("vendor_payments")
    .select("id, household_id, label, amount, due_date, due_on_wedding_day, vendors(name), households(wedding_date)")
    .eq("paid", false)
    .returns<PaymentRow[]>();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  // Une échéance « jour du mariage » n'a pas de due_date : elle est datée par
  // la date de mariage du foyer.
  const due = (payments ?? []).filter((p) => {
    const date = p.due_on_wedding_day ? p.households?.wedding_date : p.due_date;
    return date != null && targetDates.includes(date);
  });

  if (due.length === 0) {
    return Response.json({ sent: 0, checked: payments?.length ?? 0 });
  }

  const householdIds = [...new Set(due.map((p) => p.household_id))];
  const { data: subscriptions } = await supabase
    .from("push_subscriptions")
    .select("id, household_id, endpoint, p256dh, auth")
    .in("household_id", householdIds)
    .returns<SubscriptionRow[]>();

  let sent = 0;
  const stale: string[] = [];

  for (const payment of due) {
    const date = payment.due_on_wedding_day ? payment.households?.wedding_date : payment.due_date;
    const days = Math.round(
      (new Date(`${date}T00:00:00`).getTime() - new Date(new Date().toDateString()).getTime()) / 86_400_000
    );
    const when = days === 0 ? "aujourd'hui" : days === 1 ? "demain" : `dans ${days} jours`;

    const body = JSON.stringify({
      title: `Échéance ${when}`,
      body: `${payment.vendors?.name ?? "Prestataire"} — ${payment.label} : ${euro(Number(payment.amount))}`,
      url: "/vendors",
      tag: `payment-${payment.id}-${date}`,
    });

    for (const sub of (subscriptions ?? []).filter((s) => s.household_id === payment.household_id)) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          body
        );
        sent++;
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        // 404/410 : l'abonnement n'existe plus côté navigateur.
        if (status === 404 || status === 410) stale.push(sub.id);
      }
    }
  }

  if (stale.length > 0) {
    await supabase.from("push_subscriptions").delete().in("id", stale);
  }

  return Response.json({ sent, dueCount: due.length, removedStale: stale.length });
}
