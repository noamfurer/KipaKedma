import {
  clearAdminSessionCookie,
  requestHasValidOrigin,
} from "../../../../lib/admin-auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!requestHasValidOrigin(request)) {
    return Response.json({ error: "הבקשה נדחתה." }, { status: 403 });
  }

  return Response.json(
    { authenticated: false },
    { headers: { "Set-Cookie": clearAdminSessionCookie() } },
  );
}
