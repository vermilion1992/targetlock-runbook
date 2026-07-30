import { requireSecurePilotEnvironment } from "@/server/pilot/environment";
import { apiErrorResponse, secureJson } from "@/server/pilot/http";
import {
  getPilotService,
  requirePilotRequestContext,
} from "@/server/pilot/runtime";
import { workLeaseTargetSchema } from "@/server/pilot/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const environment = requireSecurePilotEnvironment();
    const context = await requirePilotRequestContext();
    const url = new URL(request.url);
    const target = workLeaseTargetSchema.parse({
      resourceType: url.searchParams.get("resourceType"),
      resourceRef: url.searchParams.get("resourceRef"),
      projectRef: url.searchParams.get("projectRef") || undefined,
      holeRef: url.searchParams.get("holeRef") || undefined,
      shiftRef: url.searchParams.get("shiftRef") || undefined,
    });
    return secureJson(
      await getPilotService(environment).getLeaseStatus(context, target),
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
