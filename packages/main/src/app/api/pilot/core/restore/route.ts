import { requireSecurePilotEnvironment } from "@/server/pilot/environment";
import {
  apiErrorResponse,
  assertSameOrigin,
  readBoundedJson,
  secureJson,
} from "@/server/pilot/http";
import {
  getPilotService,
  requirePilotRequestContext,
} from "@/server/pilot/runtime";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const environment = requireSecurePilotEnvironment();
    assertSameOrigin(request, environment);
    const context = await requirePilotRequestContext();
    await getPilotService(environment).recordCoreRestore(
      context,
      await readBoundedJson(request),
    );
    return secureJson({ restored: true });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
