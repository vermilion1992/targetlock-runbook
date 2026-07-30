import {
  requireSecurePilotEnvironment,
} from "@/server/pilot/environment";
import {
  apiErrorResponse,
  assertSameOrigin,
  getClientAddress,
  secureJson,
} from "@/server/pilot/http";
import { consumeRateLimit } from "@/server/pilot/rate-limit";
import {
  getCookieNames,
  getPilotService,
  pilotCookieOptions,
} from "@/server/pilot/runtime";
import { loginInputSchema } from "@/server/pilot/types";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const environment = requireSecurePilotEnvironment();
    assertSameOrigin(request, environment);
    const input = loginInputSchema.parse(await request.json());
    const clientAddress = getClientAddress(request);
    consumeRateLimit(
      `login:${clientAddress}:${input.email.toLocaleLowerCase("en-AU")}`,
      { limit: 8, windowMs: 15 * 60 * 1_000 },
    );
    const result = await getPilotService(environment).login(input, {
      ipAddress: clientAddress,
      userAgent: request.headers.get("user-agent") ?? undefined,
    });
    const response = secureJson({
      mode: "pilot",
      user: {
        id: result.principal.userId,
        organisationId: result.principal.organisationId,
        organisationName: result.principal.organisationName,
        email: result.principal.email,
        displayName: result.principal.displayName,
        role: result.principal.role,
        mustChangePassword: result.principal.mustChangePassword,
        sessionExpiresAt: result.principal.sessionExpiresAt,
      },
    });
    response.cookies.set(
      getCookieNames(environment).session,
      result.token,
      pilotCookieOptions(environment, environment.sessionTtlSeconds),
    );
    return response;
  } catch (error) {
    return apiErrorResponse(error);
  }
}
