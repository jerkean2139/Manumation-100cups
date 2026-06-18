import crypto from "node:crypto";
import type { Request, Response, NextFunction } from "express";
import { env, authEnabled } from "./env.js";

/**
 * Single-user dashboard authentication (v1).
 *
 * One password (APP_PASSWORD) gates the dashboard and its data/actions. On
 * success we issue a stateless HMAC-signed token (no DB, no extra deps) that the
 * SPA stores and sends as `Authorization: Bearer`. When no password is set, auth
 * is disabled so local/demo use stays frictionless.
 *
 * The GHL webhook is intentionally NOT behind this — it authenticates with its
 * own shared secret (GHL_WEBHOOK_SECRET), since GHL can't carry a user session.
 */

function signingKey(): string {
  // Prefer an explicit secret; otherwise derive a stable one from the password
  // so tokens survive restarts without extra config.
  return env.auth.secret || `manumation::${env.auth.password}`;
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

function hmac(data: string): string {
  return crypto.createHmac("sha256", signingKey()).update(data).digest("base64url");
}

/** Issue a signed token that expires after the configured session lifetime. */
export function issueToken(): string {
  const exp = Date.now() + env.auth.sessionHours * 3600 * 1000;
  const payload = base64url(JSON.stringify({ exp }));
  return `${payload}.${hmac(payload)}`;
}

/** Verify a token's signature and expiry. */
export function verifyToken(token: string | undefined): boolean {
  if (!token) return false;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return false;

  const expected = hmac(payload);
  // Constant-time comparison to avoid signature timing leaks.
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;

  try {
    const { exp } = JSON.parse(Buffer.from(payload, "base64url").toString());
    return typeof exp === "number" && exp > Date.now();
  } catch {
    return false;
  }
}

/** Constant-time password check. */
export function checkPassword(provided: string | undefined): boolean {
  if (!authEnabled() || !provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(env.auth.password);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function bearer(req: Request): string | undefined {
  const header = req.header("authorization");
  if (header?.startsWith("Bearer ")) return header.slice(7);
  return undefined;
}

/** Express middleware: require a valid session token (no-op when auth disabled). */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!authEnabled()) return next();
  if (verifyToken(bearer(req))) return next();
  res.status(401).json({ error: "Unauthorized" });
}
