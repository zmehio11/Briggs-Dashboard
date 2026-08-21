// Vercel Edge Middleware — gates the whole dashboard (including the /api
// proxy) behind HTTP Basic Auth. Credentials are read from the
// DASHBOARD_USER / DASHBOARD_PASSWORD environment variables set in the
// Vercel project settings (not committed here). If either is unset, this
// fails open rather than locking everyone out of a misconfigured deploy.

function unauthorized(): Response {
  return new Response("Authentication required.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Briggs Dashboard"' },
  });
}

export default function middleware(request: Request): Response | undefined {
  const expectedUser = process.env.DASHBOARD_USER;
  const expectedPass = process.env.DASHBOARD_PASSWORD;

  if (!expectedUser || !expectedPass) {
    return undefined;
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

  return undefined;
}
