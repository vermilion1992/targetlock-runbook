import { isRoutableHoleId } from "@/infrastructure/seed";

const SIGN_IN_FALLBACK = "/start";
const ALLOWED_EXACT_PATHS = new Set([
  "/start",
  "/projects",
  "/components",
  "/components/new",
]);

function isAllowedApplicationPath(pathname: string): boolean {
  return (
    ALLOWED_EXACT_PATHS.has(pathname) ||
    pathname === "/holes" ||
    pathname.startsWith("/holes/") ||
    pathname.startsWith("/projects/") ||
    /^\/components\/component-[A-Za-z0-9._-]+$/.test(pathname)
  );
}

function resolveSafeApplicationPath(
  requested: string | readonly string[] | undefined,
): string | null {
  if (typeof requested !== "string") return null;

  const value = requested.trim();
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return null;
  }

  try {
    const parsed = new URL(value, "https://targetlock.local");
    if (
      parsed.origin !== "https://targetlock.local" ||
      !isAllowedApplicationPath(parsed.pathname)
    ) {
      return null;
    }
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return null;
  }
}

export interface StartHoleDestination {
  readonly holeId: string;
  readonly href: string;
}

/**
 * Revalidates a requested runbook link before Start offers to open its hole.
 * Collection and setup routes are deliberately excluded because they do not
 * identify an operational hole context.
 */
export function resolveStartHoleDestination(
  requested: string | readonly string[] | undefined,
): StartHoleDestination | null {
  const safePath = resolveSafeApplicationPath(requested);
  if (safePath === null) return null;

  const { pathname } = new URL(safePath, "https://targetlock.local");
  const match = /^\/holes\/([^/]+)(?:\/|$)/.exec(pathname);
  if (!match?.[1]) return null;

  try {
    const holeId = decodeURIComponent(match[1]);
    return isRoutableHoleId(holeId) ? { holeId, href: safePath } : null;
  } catch {
    return null;
  }
}

/**
 * Resolves the local route requested by the session gate without permitting an
 * external redirect or a return to inherited template surfaces.
 */
export function resolveSignInDestination(
  requested: string | readonly string[] | undefined,
): string {
  const safePath = resolveSafeApplicationPath(requested);
  if (safePath === null) return SIGN_IN_FALLBACK;

  return resolveStartHoleDestination(safePath) === null
    ? safePath
    : `/start?next=${encodeURIComponent(safePath)}`;
}
