/**
 * A user-facing message from an API error. FastAPI returns `detail` as a string
 * for HTTPException but as a list of objects for validation errors (422);
 * rendering that list directly crashes React (white screen).
 */
export function apiErrorMessage(err: unknown, fallback: string): string {
  const detail = (err as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
  if (typeof detail === "string" && detail.trim()) return detail;
  if (Array.isArray(detail) && detail.length) {
    const first = detail[0] as { msg?: unknown; loc?: unknown[] };
    const field = Array.isArray(first?.loc) ? String(first.loc[first.loc.length - 1] ?? "") : "";
    if (typeof first?.msg === "string") return field ? `${field}: ${first.msg}` : first.msg;
  }
  return fallback;
}
