import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/** Refreshes the Supabase session and protects /app. Server pages re-check auth. */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return response;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        list.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  const { data } = await supabase.auth.getUser();

  if (!data.user && request.nextUrl.pathname.startsWith("/app")) {
    const to = request.nextUrl.clone();
    to.pathname = "/explore";
    to.search = new URLSearchParams({ auth: "login", next: request.nextUrl.pathname + request.nextUrl.search }).toString();
    return NextResponse.redirect(to);
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|manifest.webmanifest|.*\\.(?:png|jpg|svg|webp)$).*)"],
};
