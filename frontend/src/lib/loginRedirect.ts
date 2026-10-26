/** Send people back to the page they were on after signing in. */

/** "/login?next=<current page>" (plain "/login" when already there). */
export function loginUrl(next: string = window.location.pathname + window.location.search): string {
  return next.startsWith("/login") ? "/login" : `/login?next=${encodeURIComponent(next)}`;
}

/** Only same-site paths: rejects "https://…", "//evil.com" and "/\evil.com" (open redirect). */
export function safeNext(next: string | null): string | null {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\") || next.startsWith("/login")) {
    return null;
  }
  return next;
}
