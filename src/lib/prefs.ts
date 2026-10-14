/** Cookie names shared by client and server. Preferences only — never auth. */
export const AGE_COOKIE = "nz_age_ok";
export const INTEREST_COOKIE = "nz_interest";
export const ONE_YEAR = 60 * 60 * 24 * 365;

export function setPrefCookie(name: string, value: string) {
  document.cookie = `${name}=${encodeURIComponent(value)}; Max-Age=${ONE_YEAR}; Path=/; SameSite=Lax`;
}

export function readCookie(name: string) {
  return document.cookie.split("; ").find((c) => c.startsWith(`${name}=`))?.split("=")[1];
}
