import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";

/**
 * First-party, cookie-free page-view tracking (replaces Umami).
 * Sends one tiny request per route change; skips admin pages and admins'
 * own browsing so the numbers reflect real visitors.
 */
export default function PageViewTracker() {
  const { pathname, search } = useLocation();
  const last = useRef<string | null>(null);
  const first = useRef(true);

  useEffect(() => {
    if (pathname.startsWith("/admin") || pathname === last.current) return;
    try {
      if (localStorage.getItem("admin_token")) return;
    } catch {
      /* storage blocked: still count */
    }
    last.current = pathname;
    const body: Record<string, string> = { path: pathname };
    if (first.current) {
      // Where the visit came from only matters for the landing page.
      first.current = false;
      if (document.referrer) body.referrer = document.referrer;
      const utm = new URLSearchParams(search).get("utm_source");
      if (utm) body.utm_source = utm;
    }
    const payload = new Blob([JSON.stringify(body)], { type: "application/json" });
    if (!navigator.sendBeacon?.("/api/stats/pv", payload)) {
      fetch("/api/stats/pv", { method: "POST", body: payload, keepalive: true, headers: { "Content-Type": "application/json" } }).catch(() => {});
    }
  }, [pathname, search]);

  return null;
}
