import { requireSecurePilotEnvironment } from "@/server/pilot/environment";
import { apiErrorResponse, secureJson } from "@/server/pilot/http";
import {
  getPilotService,
  requirePilotRequestContext,
} from "@/server/pilot/runtime";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const environment = requireSecurePilotEnvironment();
    const context = await requirePilotRequestContext();
    const overview = await getPilotService(environment).getAdminOverview(
      context.principal,
    );
    return secureJson({ overview });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
