import { NextResponse, type NextRequest } from "next/server";

import {
  credentialsMatch,
  isPilotAccessConfigured,
  isPilotAccessPublicPath,
  parseBasicAuthorizationHeader,
  readPilotAccessConfig,
} from "@/lib/pilot-access";
import { getTemplateSurfaceDecision } from "@/lib/template-surface-policy";

/**
 * Production request boundary for the template surface and optional pilot gate.
 * The Basic gate is deployment protection, not a user-account system.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === "/holes") {
    const destination = request.nextUrl.clone();
    destination.pathname = "/projects";
    destination.search = "";
    return NextResponse.redirect(destination);
  }

  if (getTemplateSurfaceDecision(pathname) === "not-found") {
    return new NextResponse("Not Found", {
      status: 404,
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": "text/plain; charset=utf-8",
      },
    });
  }

  if (isPilotAccessPublicPath(pathname)) {
    return NextResponse.next();
  }

  const config = readPilotAccessConfig();
  if (!config.enabled) {
    return NextResponse.next();
  }

  if (!isPilotAccessConfigured(config)) {
    return new NextResponse(
      "Pilot access gate is enabled but credentials are not configured.",
      {
        status: 503,
        headers: {
          "Cache-Control": "no-store",
          "Content-Type": "text/plain; charset=utf-8",
        },
      },
    );
  }

  const provided = parseBasicAuthorizationHeader(
    request.headers.get("authorization"),
  );

  if (credentialsMatch(provided, config)) {
    return NextResponse.next();
  }

  return new NextResponse(
    "TargetLock Railway pilot access required. This is a deployment access gate, not full authentication.",
    {
      status: 401,
      headers: {
        "WWW-Authenticate":
          'Basic realm="TargetLock Railway Pilot Access", charset="UTF-8"',
        "Cache-Control": "no-store",
        "Content-Type": "text/plain; charset=utf-8",
      },
    },
  );
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|favicon.svg|robots.txt|serwist/).*)",
  ],
};
