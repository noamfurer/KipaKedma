import {
  createHmac,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";

const COOKIE_NAME = "kedma_admin_session";
const SESSION_SECONDS = 60 * 60 * 8;

function configuredPasswordHash() {
  return process.env.ADMIN_PASSWORD_HASH?.trim() ?? "";
}

function safeEqual(left: Buffer, right: Buffer) {
  return left.length === right.length && timingSafeEqual(left, right);
}

export function adminPasswordIsConfigured() {
  return configuredPasswordHash().length > 0;
}

export function verifyAdminPassword(password: string) {
  const encoded = configuredPasswordHash();
  const [algorithm, saltBase64, hashBase64] = encoded.split("$");

  if (algorithm !== "scrypt" || !saltBase64 || !hashBase64) return false;

  try {
    const salt = Buffer.from(saltBase64, "base64url");
    const expected = Buffer.from(hashBase64, "base64url");
    const actual = scryptSync(password, salt, expected.length);
    return safeEqual(actual, expected);
  } catch {
    return false;
  }
}

function signSession(expiresAt: number) {
  return createHmac("sha256", configuredPasswordHash())
    .update(`kedma-admin:${expiresAt}`)
    .digest("base64url");
}

export function createAdminSession() {
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_SECONDS;
  return `v1.${expiresAt}.${signSession(expiresAt)}`;
}

function cookieValue(request: Request) {
  const cookieHeader = request.headers.get("cookie") ?? "";
  for (const cookie of cookieHeader.split(";")) {
    const [name, ...valueParts] = cookie.trim().split("=");
    if (name === COOKIE_NAME) return valueParts.join("=");
  }
  return "";
}

export function isAdminRequest(request: Request) {
  if (!adminPasswordIsConfigured()) return false;

  const [version, rawExpiry, signature] = cookieValue(request).split(".");
  const expiresAt = Number(rawExpiry);
  if (
    version !== "v1" ||
    !Number.isFinite(expiresAt) ||
    expiresAt <= Math.floor(Date.now() / 1000) ||
    !signature
  ) {
    return false;
  }

  return safeEqual(
    Buffer.from(signature, "base64url"),
    Buffer.from(signSession(expiresAt), "base64url"),
  );
}

export function adminSessionCookie(token: string) {
  return `${COOKIE_NAME}=${token}; HttpOnly; Secure; SameSite=Strict; Path=/api/admin; Max-Age=${SESSION_SECONDS}`;
}

export function clearAdminSessionCookie() {
  return `${COOKIE_NAME}=; HttpOnly; Secure; SameSite=Strict; Path=/api/admin; Max-Age=0`;
}

export function requestHasValidOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return Boolean(origin && origin === new URL(request.url).origin);
}
