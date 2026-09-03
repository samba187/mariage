"use client";

import { useEffect } from "react";
import type { VendorPayment } from "@/types/database";
import { dueUrgency, effectiveDueDate, daysUntil } from "@/lib/vendor-status";

const STORAGE_KEY = "last-due-reminder";

/**
 * Rappel affiché à l'ouverture de l'application, au plus une fois par jour.
 * Complète les notifications push du cron : celui-ci couvre l'app fermée,
 * celui-ci fonctionne sans aucune configuration serveur.
 */
export function useDueReminders(payments: VendorPayment[], weddingDate: string | null) {
  useEffect(() => {
    if (payments.length === 0) return;
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;

    const today = new Date().toISOString().slice(0, 10);
    try {
      if (localStorage.getItem(STORAGE_KEY) === today) return;
    } catch {
      return; // stockage indisponible (navigation privée) : on n'insiste pas
    }

    const urgent = payments.filter((p) => {
      const urgency = dueUrgency(p, weddingDate);
      return urgency === "overdue" || urgency === "due_soon";
    });
    if (urgent.length === 0) return;

    const overdue = urgent.filter((p) => dueUrgency(p, weddingDate) === "overdue");
    const total = urgent.reduce((sum, p) => sum + Number(p.amount), 0);
    const amount = new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0,
    }).format(total);

    let body: string;
    if (overdue.length > 0) {
      body = `${overdue.length} en retard · ${urgent.length} au total (${amount})`;
    } else {
      const next = urgent
        .map((p) => ({ p, due: effectiveDueDate(p, weddingDate) }))
        .filter((x) => x.due)
        .sort((a, b) => a.due!.localeCompare(b.due!))[0];
      const days = next ? daysUntil(next.due!) : 0;
      const when = days === 0 ? "aujourd'hui" : days === 1 ? "demain" : `dans ${days} jours`;
      body = `${urgent.length} à venir (${amount}) · le prochain ${when}`;
    }

    try {
      new Notification("Paiements à prévoir", { body, icon: "/icons/icon-192.png", tag: "due-summary" });
      localStorage.setItem(STORAGE_KEY, today);
    } catch {
      // notification refusée par le navigateur
    }
  }, [payments, weddingDate]);
}
