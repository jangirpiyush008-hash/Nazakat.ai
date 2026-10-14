import { NextResponse, type NextRequest } from "next/server";

/**
 * Coarse visitor location from the hosting edge (Vercel sets x-vercel-ip-*;
 * Cloudflare sets cf-ipcountry). City/country only — never stored or logged.
 * Locally there are no headers, so this returns nulls and the UI says "near you".
 */
export function GET(request: NextRequest) {
  const h = request.headers;
  const city = decode(h.get("x-vercel-ip-city"));
  const country = h.get("x-vercel-ip-country") ?? h.get("cf-ipcountry");
  return NextResponse.json(
    { city, country: country && country !== "XX" ? country : null },
    { headers: { "Cache-Control": "private, max-age=3600" } },
  );
}

function decode(v: string | null) {
  if (!v) return null;
  try {
    return decodeURIComponent(v);
  } catch {
    return null;
  }
}
