import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * Swaps the <link rel="manifest"> href based on the current route.
 * /admin uses admin-manifest.json, everything else uses manifest.json.
 */
export function useManifestSwap() {
  const location = useLocation();

  useEffect(() => {
    const isAdmin = location.pathname.startsWith("/admin");
    const manifestLink = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    if (!manifestLink) return;

    const target = isAdmin ? "/admin-manifest.json" : "/manifest.json";
    if (manifestLink.href !== new URL(target, window.location.origin).href) {
      manifestLink.setAttribute("href", target);
    }
  }, [location.pathname]);
}
