import { createHash } from "node:crypto";
import { getStore } from "@netlify/blobs";
import {
  adminPasswordIsConfigured,
  adminSessionCookie,
  createAdminSession,
  requestHasValidOrigin,
  verifyAdminPassword,
} from "../../../../lib/admin-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

type LoginAttempt = {
  count: number;
  resetAt: number;
};

function securityStore() {
  return getStore({ name: "kipa-kedma-admin-security", consistency: "strong" });
}

function requestFingerprint(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const address =
    request.headers.get("x-nf-client-connection-ip") ?? forwarded ?? "unknown";
  return createHash("sha256").update(address).digest("hex");
}

export async function POST(request: Request) {
  if (!requestHasValidOrigin(request)) {
    return Response.json({ error: "הבקשה נדחתה." }, { status: 403 });
  }
  if (!adminPasswordIsConfigured()) {
    return Response.json(
      { error: "אזור הניהול עדיין לא הוגדר ב-Netlify." },
      { status: 503 },
    );
  }

  const store = securityStore();
  const attemptKey = `login-attempts/${requestFingerprint(request)}`;
  const now = Date.now();
  const savedAttempt = (await store.get(attemptKey, {
    type: "json",
  })) as LoginAttempt | null;
  const attempt =
    savedAttempt && savedAttempt.resetAt > now
      ? savedAttempt
      : { count: 0, resetAt: now + LOCK_MINUTES * 60 * 1000 };

  if (attempt.count >= MAX_ATTEMPTS) {
    return Response.json(
      { error: "יותר מדי ניסיונות. נסו שוב בעוד 15 דקות." },
      { status: 429 },
    );
  }

  const payload = (await request.json()) as { password?: string };
  if (!verifyAdminPassword(payload.password ?? "")) {
    await store.setJSON(attemptKey, { ...attempt, count: attempt.count + 1 });
    return Response.json({ error: "הסיסמה אינה נכונה." }, { status: 401 });
  }

  await store.delete(attemptKey);
  return Response.json(
    { authenticated: true },
    { headers: { "Set-Cookie": adminSessionCookie(createAdminSession()) } },
  );
}
