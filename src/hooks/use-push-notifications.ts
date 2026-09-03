"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

export function usePushNotifications(householdId: string | undefined) {
  const supabase = createClient();
  const [supported, setSupported] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

  useEffect(() => {
    const ok =
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window &&
      Boolean(publicKey);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- capacités du navigateur
    setSupported(ok);
    if (!ok) return;

    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setSubscribed(Boolean(sub)))
      .catch(() => setSubscribed(false));
  }, [publicKey]);

  const subscribe = useCallback(async () => {
    if (!householdId || !publicKey) return;
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        toast.error("Notifications refusées dans le navigateur.");
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      const sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh: string; auth: string } };
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || !json.endpoint || !json.keys) return;

      const { error } = await supabase.from("push_subscriptions").upsert(
        {
          household_id: householdId,
          user_id: user.id,
          endpoint: json.endpoint,
          p256dh: json.keys.p256dh,
          auth: json.keys.auth,
        },
        { onConflict: "endpoint" }
      );

      if (error) {
        toast.error(error.message);
        return;
      }
      setSubscribed(true);
      toast.success("Rappels d'échéance activés sur cet appareil.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Impossible d'activer les notifications.");
    } finally {
      setBusy(false);
    }
  }, [householdId, publicKey, supabase]);

  const unsubscribe = useCallback(async () => {
    setBusy(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const sub = await registration.pushManager.getSubscription();
      if (sub) {
        await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
        await sub.unsubscribe();
      }
      setSubscribed(false);
      toast.success("Rappels désactivés sur cet appareil.");
    } catch {
      toast.error("Impossible de désactiver les notifications.");
    } finally {
      setBusy(false);
    }
  }, [supabase]);

  return { supported, subscribed, busy, subscribe, unsubscribe };
}
