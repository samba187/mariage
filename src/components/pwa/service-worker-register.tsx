"use client";

import { useEffect } from "react";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    // Enregistré aussi en développement : sans Service Worker actif, impossible
    // de s'abonner aux notifications push. Le cache est désactivé sur localhost
    // côté sw.js pour ne pas gêner le rechargement à chaud.
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // hors-ligne et push indisponibles, l'app reste utilisable en ligne
    });
  }, []);

  return null;
}
