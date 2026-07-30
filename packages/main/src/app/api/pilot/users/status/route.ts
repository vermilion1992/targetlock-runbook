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
import { setUserStatusInputSchema } from "@/server/pilot/types";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const environment = requireSecurePilotEnvironment();
    assertSameOrigin(request, environment);
    const context = await requirePilotRequestContext();
    const input = setUserStatusInputSchema.parse(await request.json());
    await getPilotService(environment).setUserStatus(
      context.principal,
      input,
    );
    return secureJson({ changed: true });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
