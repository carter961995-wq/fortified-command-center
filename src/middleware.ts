import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PREFIXES = ["/login"];

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`));

  if (user && (path === "/" || path === "")) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    const redirectRes = NextResponse.redirect(url);
    supabaseResponse.cookies.getAll().forEach((c) => {
      redirectRes.cookies.set(c.name, c.value);
    });
    return redirectRes;
  }

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", path);
    const redirect = NextResponse.redirect(url);
    supabaseResponse.cookies.getAll().forEach((c) => {
      redirect.cookies.set(c.name, c.value, c);
    });
    return redirect;
  }

  if (user && path === "/login") {
    const next = request.nextUrl.searchParams.get("next");
    const url = request.nextUrl.clone();
    url.pathname = next && next.startsWith("/") ? next : "/dashboard";
    url.searchParams.delete("next");
    const redirect = NextResponse.redirect(url);
    supabaseResponse.cookies.getAll().forEach((c) => {
      redirect.cookies.set(c.name, c.value, c);
    });
    return redirect;
  }

  return supabaseResponse;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
