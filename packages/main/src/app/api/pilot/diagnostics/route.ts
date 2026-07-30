import {
  EXPECTED_PILOT_SCHEMA_MIGRATION,
  getPilotDatabaseReadiness,
} from "@/server/pilot/database";
import { requireSecurePilotEnvironment } from "@/server/pilot/environment";
import { apiErrorResponse, secureJson } from "@/server/pilot/http";
import { requirePilotRequestContext } from "@/server/pilot/runtime";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    requireSecurePilotEnvironment();
    const context = await requirePilotRequestContext();
    const database = await getPilotDatabaseReadiness();
    return secureJson({
      diagnostics: {
        appVersion: "1.3.0-stage7c",
        expectedSchema: EXPECTED_PILOT_SCHEMA_MIGRATION,
        currentSchema: database.currentMigration,
        serverReady: database.ready,
        runtimeMode: "pilot",
        sessionExpiresAt: context.principal.sessionExpiresAt,
        role: context.principal.role,
        deviceId: context.device?.id ?? null,
        deviceLastSeenAt: context.device?.lastSeenAt ?? null,
        journalSemantics: "AUTHORITATIVE_CORE_WITH_JOURNAL_ONLY_PERIPHERALS",
        domainMaterialization: true,
        blobUpload: false,
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
