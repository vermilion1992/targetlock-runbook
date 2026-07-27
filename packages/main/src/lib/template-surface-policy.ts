export type TemplateSurfaceDecision = "allow" | "not-found";

const TARGET_LOCK_ROUTE_ROOTS = ["/holes", "/projects"];
const TARGET_LOCK_EXACT_ROUTES = new Set([
  "/",
  "/sign-in",
  "/start",
  "/components",
  "/components/new",
]);
const PUBLIC_ASSET_ROUTE_ROOTS = [
  "/_next/static",
  "/_next/image",
  "/images",
  "/assets",
  "/serwist",
];
const PUBLIC_FILES = new Set([
  "/favicon.ico",
  "/favicon.svg",
  "/robots.txt",
]);

function isPathOrDescendant(pathname: string, root: string): boolean {
  return pathname === root || pathname.startsWith(`${root}/`);
}

function isComponentDetailRoute(pathname: string): boolean {
  return /^\/components\/component-[A-Za-z0-9._-]+$/.test(pathname);
}

function isInvalidReservedHoleRoute(pathname: string): boolean {
  const lower = pathname.toLocaleLowerCase("en-AU");
  return (
    (lower === "/holes/new" && pathname !== "/holes/new") ||
    lower.startsWith("/holes/new/") ||
    (lower === "/holes/completed" && pathname !== "/holes/completed") ||
    lower.startsWith("/holes/completed/")
  );
}

export function areTemplateDemosEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return (env.ENABLE_TEMPLATE_DEMOS ?? "").trim().toLowerCase() === "true";
}

export function isRequiredPublicAsset(pathname: string): boolean {
  return (
    PUBLIC_FILES.has(pathname) ||
    PUBLIC_ASSET_ROUTE_ROOTS.some((root) =>
      isPathOrDescendant(pathname, root),
    )
  );
}

export function isTargetLockRoute(pathname: string): boolean {
  if (isInvalidReservedHoleRoute(pathname)) return false;
  return (
    TARGET_LOCK_EXACT_ROUTES.has(pathname) ||
    isComponentDetailRoute(pathname) ||
    pathname === "/api/health" ||
    TARGET_LOCK_ROUTE_ROOTS.some((root) =>
      isPathOrDescendant(pathname, root),
    )
  );
}

/**
 * In production, inherited template pages and APIs are closed by default.
 * Local development remains unchanged, and production demos require an
 * explicit opt-in.
 */
export function getTemplateSurfaceDecision(
  pathname: string,
  env: Record<string, string | undefined> = process.env,
): TemplateSurfaceDecision {
  if (env.NODE_ENV !== "production" || areTemplateDemosEnabled(env)) {
    return "allow";
  }

  if (isTargetLockRoute(pathname) || isRequiredPublicAsset(pathname)) {
    return "allow";
  }

  return "not-found";
}
