import { requireSecurePilotEnvironment } from "@/server/pilot/environment";
import {
  apiErrorResponse,
  assertSameOrigin,
  secureJson,
} from "@/server/pilot/http";
import { consumeRateLimit } from "@/server/pilot/rate-limit";
import {
  getCookieNames,
  getPilotService,
  pilotCookieOptions,
  requirePilotRequestContext,
} from "@/server/pilot/runtime";
import { registerDeviceInputSchema } from "@/server/pilot/types";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const environment = requireSecurePilotEnvironment();
    assertSameOrigin(request, environment);
    const context = await requirePilotRequestContext();
    consumeRateLimit(`device-register:${context.principal.userId}`, {
      limit: 5,
      windowMs: 60 * 60 * 1_000,
    });
    const input = registerDeviceInputSchema.parse(await request.json());
    const result = await getPilotService(environment).registerDevice(
      context.principal,
      input,
    );
    const response = secureJson(
      { registered: true, device: result.device },
      { status: 201 },
    );
    response.cookies.set(
      getCookieNames(environment).device,
      result.token,
      pilotCookieOptions(environment, 180 * 24 * 60 * 60),
    );
    return response;
  } catch (error) {
    return apiErrorResponse(error);
  }
}
