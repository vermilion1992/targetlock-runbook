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
import { leaseIdInputSchema } from "@/server/pilot/types";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const environment = requireSecurePilotEnvironment();
    assertSameOrigin(request, environment);
    const context = await requirePilotRequestContext();
    const input = leaseIdInputSchema.parse(await request.json());
    const lease = await getPilotService(environment).releaseLease(
      context,
      input.leaseId,
    );
    return secureJson({ state: "RELEASED", lease });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
