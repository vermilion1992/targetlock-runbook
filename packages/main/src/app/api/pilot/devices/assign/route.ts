import { requireSecurePilotEnvironment } from "@/server/pilot/environment";
import {
  apiErrorResponse,
  assertSameOrigin,
  secureJson,
} from "@/server/pilot/http";
import {
  getPilotService,
  requirePilotRequestContext,
} from "@/server/pilot/runtime";
import { assignDeviceInputSchema } from "@/server/pilot/types";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const environment = requireSecurePilotEnvironment();
    assertSameOrigin(request, environment);
    const context = await requirePilotRequestContext();
    const input = assignDeviceInputSchema.parse(await request.json());
    const device = await getPilotService(environment).assignDevice(
      context,
      input,
    );
    return secureJson({ device });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
