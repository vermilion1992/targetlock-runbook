import { requireSecurePilotEnvironment } from "@/server/pilot/environment";
import { apiErrorResponse, secureJson } from "@/server/pilot/http";
import {
  getPilotService,
  requirePilotRequestContext,
} from "@/server/pilot/runtime";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  {
    params,
  }: { readonly params: Promise<{ readonly operationId: string }> },
) {
  try {
    const environment = requireSecurePilotEnvironment();
    const context = await requirePilotRequestContext();
    const { operationId } = await params;
    const conflict = await getPilotService(
      environment,
    ).getCoreConflictDetails(context, operationId);
    return secureJson({ conflict });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
