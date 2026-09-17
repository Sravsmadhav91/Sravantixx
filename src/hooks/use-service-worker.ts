import { useEffect, useRef } from "react";
import { toast } from "sonner";

export function useServiceWorker() {
  const toastShown = useRef(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    // In dev, a service worker caches Vite's HMR token and breaks hot reload.
    // Also unregisters any worker installed before this guard existed.
    if (!import.meta.env.PROD) {
      navigator.serviceWorker
        .getRegistrations()
        .then((rs) => rs.forEach((r) => r.unregister()));
      return;
    }

    const showUpdateToast = () => {
      if (toastShown.current) return;
      toastShown.current = true;
      toast("A new version is available!", {
        duration: Infinity,
        action: { label: "Refresh", onClick: () => window.location.reload() },
      });
    };

    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        if (registration.waiting) {
          showUpdateToast();
          return;
        }
        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          if (!newWorker) return;
          newWorker.addEventListener("statechange", () => {
            if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
              showUpdateToast();
            }
          });
        });
      })
      .catch((err) => console.warn("Service Worker registration failed:", err));
  }, []);
}
