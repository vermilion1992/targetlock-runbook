import {
  isBetaGuestAllowed,
  createGuestToken,
  BETA_GUEST_TTL_SECONDS,
} from "@/server/pilot/guest";
import { requireSecurePilotEnvironment } from "@/server/pilot/environment";
import {
  apiErrorResponse,
  assertSameOrigin,
  getClientAddress,
  secureJson,
} from "@/server/pilot/http";
import { consumeRateLimit } from "@/server/pilot/rate-limit";
import {
  getCookieNames,
  pilotCookieOptions,
} from "@/server/pilot/runtime";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const environment = requireSecurePilotEnvironment();
    if (!isBetaGuestAllowed()) {
      return secureJson(
        {
          error: {
            code: "FORBIDDEN",
            message: "Beta guest demo is not enabled on this service.",
          },
        },
        { status: 403 },
      );
    }
    assertSameOrigin(request, environment);
    const clientAddress = getClientAddress(request);
    consumeRateLimit(`guest:${clientAddress}`, {
      limit: 20,
      windowMs: 15 * 60 * 1_000,
    });

    const names = getCookieNames(environment);
    const token = createGuestToken(environment.sessionSecret);
    const response = secureJson({
      mode: "demo",
      guest: true,
      localDomainData: true,
      destination: "/holes/DDH041/current",
    });
    response.cookies.set(
      names.guest,
      token,
      pilotCookieOptions(environment, BETA_GUEST_TTL_SECONDS),
    );
    // Avoid dual identity: drop any leftover operator session cookie.
    response.cookies.set(
      names.session,
      "",
      pilotCookieOptions(environment, 0),
    );
    return response;
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const environment = requireSecurePilotEnvironment();
    assertSameOrigin(request, environment);
    const names = getCookieNames(environment);
    const response = secureJson({ guest: false, signedOut: true });
    response.cookies.set(
      names.guest,
      "",
      pilotCookieOptions(environment, 0),
    );
    return response;
  } catch (error) {
    return apiErrorResponse(error);
  }
}
