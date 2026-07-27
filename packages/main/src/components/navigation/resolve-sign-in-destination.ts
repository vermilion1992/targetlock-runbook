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

/**
 * Resolves the local route requested by the session gate without permitting an
 * external redirect or a return to inherited template surfaces.
 */
export function resolveSignInDestination(
  requested: string | readonly string[] | undefined,
): string {
  if (typeof requested !== "string") return SIGN_IN_FALLBACK;

  const value = requested.trim();
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return SIGN_IN_FALLBACK;
  }

  try {
    const parsed = new URL(value, "https://targetlock.local");
    if (
      parsed.origin !== "https://targetlock.local" ||
      !isAllowedApplicationPath(parsed.pathname)
    ) {
      return SIGN_IN_FALLBACK;
    }
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return SIGN_IN_FALLBACK;
  }
}
