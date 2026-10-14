import type { NextRequest } from "next/server";

/**
 * The public address of the site. Behind a proxy (Railway) the request URL is
 * the internal one (e.g. localhost:8080), so use the configured app URL first,
 * then the proxy's forwarded host, then the raw request origin.
 */
export function publicOrigin(request: NextRequest) {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  if (configured) return configured;
  const host = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  if (host) {
    const proto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || "https";
    return `${proto}://${host}`;
  }
  return request.nextUrl.origin;
}
