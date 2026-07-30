import { requireSecurePilotEnvironment } from "@/server/pilot/environment";
import { apiErrorResponse, secureJson } from "@/server/pilot/http";
import {
  getPilotService,
  requirePilotRequestContext,
} from "@/server/pilot/runtime";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { readonly params: Promise<{ readonly holeRef: string }> },
) {
  try {
    const environment = requireSecurePilotEnvironment();
    const context = await requirePilotRequestContext();
    const { holeRef } = await params;
    const snapshot = await getPilotService(environment).getCoreHoleSnapshot(
      context,
      decodeURIComponent(holeRef),
    );
    return secureJson({ snapshot });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
