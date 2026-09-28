// Next.js 16 renamed the middleware.ts convention to proxy.ts (same
// mechanics, new file/export name) — see node_modules/next/dist/docs/
// 01-app/03-api-reference/03-file-conventions/proxy.md. This is the first
// line of defense gating every route behind the interim password login;
// see src/auth.ts for why this exists and requireSession() for the
// second line of defense inside Server Actions themselves.

import { NextResponse } from "next/server";
import { auth } from "@/auth";

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const isLoginPage = req.nextUrl.pathname.startsWith("/login");

  if (!isLoggedIn && !isLoginPage) {
    return NextResponse.redirect(new URL("/login", req.nextUrl));
  }
  if (isLoggedIn && isLoginPage) {
    return NextResponse.redirect(new URL("/", req.nextUrl));
  }
});

export const config = {
  // Everything except NextAuth's own routes and static assets. Deliberately
  // NOT excluding /login itself, since the handler above needs to see
  // requests to it to redirect an already-logged-in visitor away.
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico).*)"],
};
