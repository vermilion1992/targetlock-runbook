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
import { removeCurrentDeviceInputSchema } from "@/server/pilot/types";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const environment = requireSecurePilotEnvironment();
    assertSameOrigin(request, environment);
    const context = await requirePilotRequestContext({
      allowTemporaryPassword: true,
    });
    const input = removeCurrentDeviceInputSchema.parse(await request.json());
    const device = await getPilotService(environment).removeCurrentDevice(
      context,
      input,
    );
    const response = secureJson({
      removed: true,
      device: { id: device.id, status: device.status },
      sessionPreserved: true,
    });
    if (pilotCookieLifecycle("REMOVE_CURRENT_DEVICE").clearDevice) {
      response.cookies.set(
        getCookieNames(environment).device,
        "",
        pilotCookieOptions(environment, 0),
      );
    }
    return response;
  } catch (error) {
    return apiErrorResponse(error);
  }
}
