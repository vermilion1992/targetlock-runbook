import { NextResponse, type NextRequest } from "next/server";

import {
  credentialsMatch,
  isPilotAccessConfigured,
  isPilotAccessPublicPath,
  parseBasicAuthorizationHeader,
  readPilotAccessConfig,
} from "@/lib/pilot-access";
import { getTemplateSurfaceDecision } from "@/lib/template-surface-policy";
import { readPilotEnvironment } from "@/server/pilot/environment";

function withSecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set(
    "Permissions-Policy",
    "camera=(self), geolocation=(), microphone=()",
  );
  return response;
}

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
    return withSecurityHeaders(NextResponse.redirect(destination));
  }

  if (getTemplateSurfaceDecision(pathname) === "not-found") {
    return withSecurityHeaders(new NextResponse("Not Found", {
      status: 404,
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": "text/plain; charset=utf-8",
      },
    }));
  }

  if (isPilotAccessPublicPath(pathname)) {
    return withSecurityHeaders(NextResponse.next());
  }

  try {
    if (readPilotEnvironment().mode === "pilot") {
      return withSecurityHeaders(NextResponse.next());
    }
  } catch {
    return withSecurityHeaders(
      new NextResponse("Service unavailable: secure runtime is not configured.", {
        status: 503,
        headers: {
          "Cache-Control": "no-store",
          "Content-Type": "text/plain; charset=utf-8",
        },
      }),
    );
  }

  const config = readPilotAccessConfig();
  if (!config.enabled) {
    return withSecurityHeaders(NextResponse.next());
  }

  if (!isPilotAccessConfigured(config)) {
    return withSecurityHeaders(new NextResponse(
      "Pilot access gate is enabled but credentials are not configured.",
      {
        status: 503,
        headers: {
          "Cache-Control": "no-store",
          "Content-Type": "text/plain; charset=utf-8",
        },
      },
    ));
  }

  const provided = parseBasicAuthorizationHeader(
    request.headers.get("authorization"),
  );

  if (credentialsMatch(provided, config)) {
    return withSecurityHeaders(NextResponse.next());
  }

  return withSecurityHeaders(new NextResponse(
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
  ));
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|favicon.svg|robots.txt|serwist/).*)",
  ],
};
