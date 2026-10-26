export function checkoutRequestId(kind: string, id: string): string {
  const key = `cosmic-checkout:${kind}:${id}`;
  try {
    const stored = JSON.parse(sessionStorage.getItem(key) ?? "null") as { id: string; at: number } | null;
    if (stored && Date.now() - stored.at < 30 * 60_000) return stored.id;
    const requestId = crypto.randomUUID();
    sessionStorage.setItem(key, JSON.stringify({ id: requestId, at: Date.now() }));
    return requestId;
  } catch {
    return crypto.randomUUID();
  }
}
