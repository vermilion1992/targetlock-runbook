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
    const directory = await getPilotService(environment).getCoreDirectory(
      context,
    );
    return secureJson({ directory });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
