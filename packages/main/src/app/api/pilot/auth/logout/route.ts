import { requireSecurePilotEnvironment } from "@/server/pilot/environment";
import {
  apiErrorResponse,
  assertSameOrigin,
  secureJson,
} from "@/server/pilot/http";
import {
  getCookieNames,
  getPilotService,
  pilotCookieOptions,
  pilotCookieLifecycle,
  requirePilotRequestContext,
} from "@/server/pilot/runtime";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const environment = requireSecurePilotEnvironment();
    assertSameOrigin(request, environment);
    const context = await requirePilotRequestContext({
      allowTemporaryPassword: true,
    });
    await getPilotService(environment).logout(context.principal);
    const response = secureJson({ signedOut: true });
    const names = getCookieNames(environment);
    const lifecycle = pilotCookieLifecycle("OPERATOR_LOGOUT");
    if (lifecycle.clearSession) {
      response.cookies.set(
        names.session,
        "",
        pilotCookieOptions(environment, 0),
      );
    }
    if (lifecycle.clearDevice) {
      response.cookies.set(
        names.device,
        "",
        pilotCookieOptions(environment, 0),
      );
    }
    return response;
  } catch (error) {
    return apiErrorResponse(error);
  }
}
