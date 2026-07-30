import { requireSecurePilotEnvironment } from "@/server/pilot/environment";
import { apiErrorResponse, secureJson } from "@/server/pilot/http";
import {
  getPilotService,
  requirePilotRequestContext,
} from "@/server/pilot/runtime";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const environment = requireSecurePilotEnvironment();
    const context = await requirePilotRequestContext();
    const search = new URL(request.url).searchParams;
    const changes = await getPilotService(environment).listCoreChanges(
      context,
      {
        cursor: search.has("cursor")
          ? search.get("cursor") ?? undefined
          : undefined,
        limit: search.has("limit") ? Number(search.get("limit")) : undefined,
        holeRef: search.get("holeRef")?.trim() || undefined,
      },
    );
    return secureJson(changes);
  } catch (error) {
    return apiErrorResponse(error);
  }
}
