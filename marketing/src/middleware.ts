import { NextRequest, NextResponse } from "next/server";

// Gates the whole marketing dashboard behind HTTP Basic Auth, the same way
// the ops dashboard (../frontend/middleware.ts) does. Credentials come from
// DASHBOARD_USER / DASHBOARD_PASSWORD in this Vercel project's own env vars
// (not committed here) — set them to the same values as the ops dashboard's
// project so there's one login to remember. Fails open (no gate) if either
// is unset, rather than locking everyone out of a misconfigured deploy.

function unauthorized(): NextResponse {
  return new NextResponse("Authentication required.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Briggs Marketing"' },
  });
}

export function middleware(request: NextRequest): NextResponse {
  const expectedUser = process.env.DASHBOARD_USER;
  const expectedPass = process.env.DASHBOARD_PASSWORD;

  if (!expectedUser || !expectedPass) {
    return NextResponse.next();
  }

  const authHeader = request.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Basic ")) {
    return unauthorized();
  }

  const decoded = atob(authHeader.slice("Basic ".length));
  const separatorIndex = decoded.indexOf(":");
  const user = decoded.slice(0, separatorIndex);
  const pass = decoded.slice(separatorIndex + 1);

  if (user !== expectedUser || pass !== expectedPass) {
    return unauthorized();
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/((?!_next/static|_next/image|favicon.ico).*)",
};
