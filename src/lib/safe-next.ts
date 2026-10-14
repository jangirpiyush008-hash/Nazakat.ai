/** Only same-site relative paths — never an open redirect. */
export function safeNext(next: string | null | undefined, fallback = "/app") {
  return next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : fallback;
}
