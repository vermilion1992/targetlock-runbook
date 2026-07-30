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
import { syncOperationEnvelopeSchema } from "@/server/pilot/types";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const environment = requireSecurePilotEnvironment();
    assertSameOrigin(request, environment);
    const context = await requirePilotRequestContext();
    const envelope = syncOperationEnvelopeSchema.parse(
      await readBoundedJson(request),
    );
    const receipt = await getPilotService(environment).recordOperation(
      context,
      envelope,
    );
    const httpStatus =
      receipt.status === "ACCEPTED"
        ? 202
        : receipt.status === "CONFLICT"
          ? 409
          : 422;
    return secureJson({ receipt }, { status: httpStatus });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
