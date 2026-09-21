import { useEffect, useState } from "react";

/**
 * iOS home-screen apps resume from the background without reloading, so they never
 * ask the server for a newer service worker on their own. Check whenever the app
 * comes back to the foreground, and report when a new version has taken over so the
 * user can reload on their own terms instead of losing an in-progress edit.
 */
export function useAppUpdate(): boolean {
  const [updateReady, setUpdateReady] = useState(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const container = navigator.serviceWorker;
    const hadController = Boolean(container.controller);

    const handleControllerChange = () => {
      if (hadController) setUpdateReady(true);
    };
    const checkForUpdate = () => {
      if (document.visibilityState !== "visible") return;
      void container
        .getRegistration()
        .then((registration) => registration?.update())
        .catch(() => {});
    };

    container.addEventListener("controllerchange", handleControllerChange);
    document.addEventListener("visibilitychange", checkForUpdate);
    checkForUpdate();
    return () => {
      container.removeEventListener("controllerchange", handleControllerChange);
      document.removeEventListener("visibilitychange", checkForUpdate);
    };
  }, []);

  return updateReady;
}
