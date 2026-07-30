import { z } from "zod";

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

const inputSchema = z
  .object({
    leaseId: z.string().uuid(),
    ttlSeconds: z.number().int().min(60).max(900).default(300),
  })
  .strict();

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const environment = requireSecurePilotEnvironment();
    assertSameOrigin(request, environment);
    const context = await requirePilotRequestContext();
    const input = inputSchema.parse(await request.json());
    const lease = await getPilotService(environment).heartbeatLease(
      context,
      input.leaseId,
      input.ttlSeconds,
    );
    return secureJson({ state: "OWNED_BY_THIS_DEVICE", lease });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
