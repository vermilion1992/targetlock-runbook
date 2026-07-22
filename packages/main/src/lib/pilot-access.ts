/**
 * Optional Railway pilot access gate helpers.
 * This is a deployment access gate, not full authentication.
 */

export type PilotAccessConfig = {
  enabled: boolean;
  username: string;
  password: string;
};

export function readPilotAccessConfig(
  env: Record<string, string | undefined> = process.env,
): PilotAccessConfig {
  const enabled = (env.PILOT_ACCESS_ENABLED ?? "").trim().toLowerCase() === "true";
  return {
    enabled,
    username: env.PILOT_ACCESS_USERNAME ?? "",
    password: env.PILOT_ACCESS_PASSWORD ?? "",
  };
}

export function isPilotAccessConfigured(config: PilotAccessConfig): boolean {
  return (
    config.enabled &&
    config.username.trim().length > 0 &&
    config.password.trim().length > 0
  );
}

/** Paths that must remain reachable when the gate is enabled. */
export function isPilotAccessPublicPath(pathname: string): boolean {
  if (pathname === "/api/health") {
    return true;
  }

  return (
    pathname.startsWith("/_next/static/") ||
    pathname.startsWith("/_next/image") ||
    pathname === "/favicon.ico" ||
    pathname === "/favicon.svg" ||
    pathname === "/robots.txt"
  );
}

export function parseBasicAuthorizationHeader(
  header: string | null,
): { username: string; password: string } | null {
  if (!header) {
    return null;
  }

  const [scheme, encoded] = header.split(" ");
  if (scheme?.toLowerCase() !== "basic" || !encoded) {
    return null;
  }

  try {
    const decoded = atob(encoded);
    const separator = decoded.indexOf(":");
    if (separator < 0) {
      return null;
    }

    return {
      username: decoded.slice(0, separator),
      password: decoded.slice(separator + 1),
    };
  } catch {
    return null;
  }
}

function timingSafeEqualString(left: string, right: string): boolean {
  const length = Math.max(left.length, right.length);
  let mismatch = left.length === right.length ? 0 : 1;

  for (let index = 0; index < length; index += 1) {
    const leftCode = left.charCodeAt(index) || 0;
    const rightCode = right.charCodeAt(index) || 0;
    mismatch |= leftCode ^ rightCode;
  }

  return mismatch === 0;
}

export function credentialsMatch(
  provided: { username: string; password: string } | null,
  config: PilotAccessConfig,
): boolean {
  if (!provided) {
    return false;
  }

  return (
    timingSafeEqualString(provided.username, config.username) &&
    timingSafeEqualString(provided.password, config.password)
  );
}
