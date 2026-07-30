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
import { acquireLeaseInputSchema } from "@/server/pilot/types";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const environment = requireSecurePilotEnvironment();
    assertSameOrigin(request, environment);
    const context = await requirePilotRequestContext();
    const input = acquireLeaseInputSchema.parse(await request.json());
    const lease = await getPilotService(environment).acquireLease(
      context,
      input,
    );
    return secureJson({ state: "OWNED_BY_THIS_DEVICE", lease });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
