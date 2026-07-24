"use client";

import { useEffect } from "react";

/**
 * Clears stale / broken service workers (e.g. leftover Serwist registrations
 * requesting /serwist/sw.js) that can force a continuous full-page reload loop.
 */
export function StaleServiceWorkerCleanup() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    let cancelled = false;

    async function cleanup() {
      try {
        const registrations = await navigator.serviceWorker.getRegistrations();
        if (cancelled || registrations.length === 0) return;

        await Promise.all(
          registrations.map((registration) => registration.unregister()),
        );

        if ("caches" in window) {
          const keys = await caches.keys();
          await Promise.all(
            keys
              .filter(
                (key) =>
                  key.includes("serwist") ||
                  key.includes("workbox") ||
                  key.includes("precache"),
              )
              .map((key) => caches.delete(key)),
          );
        }
      } catch {
        // Best-effort cleanup only.
      }
    }

    void cleanup();
    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
