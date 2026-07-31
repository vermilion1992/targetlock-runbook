import { createHmac, timingSafeEqual } from "node:crypto";

import type { SecurePilotEnvironment } from "./environment";

/** Short-lived beta guest session (4 hours). */
export const BETA_GUEST_TTL_SECONDS = 4 * 60 * 60;

const GUEST_TOKEN_PREFIX = "beta-guest:v1:";

function isTrue(value: string | undefined): boolean {
  return value?.trim().toLowerCase() === "true";
}

/**
 * Beta guest/demo bypass is allowed when explicitly enabled, or outside
 * production for local development convenience.
 */
export function isBetaGuestAllowed(
  env: Record<string, string | undefined> = process.env,
): boolean {
  const nodeEnv = env.NODE_ENV ?? "development";
  return isTrue(env.ALLOW_BETA_GUEST) || nodeEnv !== "production";
}

function signGuestPayload(secret: string, expiresAtUnix: number): string {
  return createHmac("sha256", secret)
    .update(`${GUEST_TOKEN_PREFIX}${expiresAtUnix}`)
    .digest("base64url");
}

export function createGuestToken(
  secret: string,
  nowMs: number = Date.now(),
  ttlSeconds: number = BETA_GUEST_TTL_SECONDS,
): string {
  const expiresAtUnix = Math.floor(nowMs / 1_000) + ttlSeconds;
  const signature = signGuestPayload(secret, expiresAtUnix);
  return `${expiresAtUnix}.${signature}`;
}

export function verifyGuestToken(
  token: string | null | undefined,
  secret: string,
  nowMs: number = Date.now(),
): boolean {
  if (!token) return false;
  const separator = token.indexOf(".");
  if (separator <= 0 || separator === token.length - 1) return false;
  const expiresRaw = token.slice(0, separator);
  const signature = token.slice(separator + 1);
  const expiresAtUnix = Number(expiresRaw);
  if (!Number.isInteger(expiresAtUnix) || expiresAtUnix <= 0) return false;
  if (expiresAtUnix * 1_000 <= nowMs) return false;
  const expected = signGuestPayload(secret, expiresAtUnix);
  try {
    const left = Buffer.from(signature);
    const right = Buffer.from(expected);
    if (left.length !== right.length) return false;
    return timingSafeEqual(left, right);
  } catch {
    return false;
  }
}

/**
 * When true, Library/Runbook layouts may skip real pilot auth (demo behaviour).
 * Requires a valid HMAC guest cookie and the beta guest gate.
 */
export function shouldBypassPilotAuthForGuest(
  environment: SecurePilotEnvironment,
  guestCookieValue: string | null | undefined,
  env: Record<string, string | undefined> = process.env,
): boolean {
  return (
    isBetaGuestAllowed(env) &&
    verifyGuestToken(guestCookieValue, environment.sessionSecret)
  );
}
