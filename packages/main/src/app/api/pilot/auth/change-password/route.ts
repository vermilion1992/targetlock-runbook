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
  requirePilotRequestContext,
} from "@/server/pilot/runtime";
import { changePasswordInputSchema } from "@/server/pilot/types";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const environment = requireSecurePilotEnvironment();
    assertSameOrigin(request, environment);
    const context = await requirePilotRequestContext({
      allowTemporaryPassword: true,
    });
    const input = changePasswordInputSchema.parse(await request.json());
    await getPilotService(environment).changePassword(context.principal, input);
    const response = secureJson({
      changed: true,
      signedOut: true,
      message: "Password changed. Sign in again on this device.",
    });
    response.cookies.set(
      getCookieNames(environment).session,
      "",
      pilotCookieOptions(environment, 0),
    );
    return response;
  } catch (error) {
    return apiErrorResponse(error);
  }
}
