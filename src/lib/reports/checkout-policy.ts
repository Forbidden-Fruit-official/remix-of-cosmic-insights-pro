/** Retry one checkout attempt without creating a second Stripe session. */
export function checkoutIdempotencyKey(userId: string, kind: "report" | "bundle", id: string, requestId: string) {
  return `checkout:${userId}:${kind}:${id}:${requestId}`;
}

export function checkoutOrigin(requestUrl: string, configuredUrl?: string) {
  const request = new URL(requestUrl);
  if (!["http:", "https:"].includes(request.protocol)) throw new Error("Invalid checkout address.");
  // Same-origin returns work in preview and production; SITE_URL is only a fallback.
  return request.origin || new URL(configuredUrl ?? requestUrl).origin;
}
