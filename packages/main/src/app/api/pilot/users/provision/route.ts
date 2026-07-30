import { requireSecurePilotEnvironment } from "@/server/pilot/environment";
import {
  apiErrorResponse,
  assertSameOrigin,
  secureJson,
} from "@/server/pilot/http";
import { consumeRateLimit } from "@/server/pilot/rate-limit";
import {
  getPilotService,
  requirePilotRequestContext,
} from "@/server/pilot/runtime";
import { provisionUserInputSchema } from "@/server/pilot/types";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const environment = requireSecurePilotEnvironment();
    assertSameOrigin(request, environment);
    const context = await requirePilotRequestContext();
    consumeRateLimit(`user-provision:${context.principal.userId}`, {
      limit: 20,
      windowMs: 60 * 60 * 1_000,
    });
    const input = provisionUserInputSchema.parse(await request.json());
    const user = await getPilotService(environment).provisionUser(
      context.principal,
      input,
    );
    return secureJson({ user }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
