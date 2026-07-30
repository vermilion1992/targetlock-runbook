import { readPilotEnvironment } from "@/server/pilot/environment";
import { apiErrorResponse, secureJson } from "@/server/pilot/http";
import { resolvePilotRequestContext } from "@/server/pilot/runtime";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const environment = readPilotEnvironment();
    if (environment.mode === "demo") {
      return secureJson({
        mode: "demo",
        authenticated: false,
        localDomainData: true,
      });
    }
    const context = await resolvePilotRequestContext();
    if (context === null) {
      return secureJson({
        mode: "pilot",
        authenticated: false,
        localDomainData: true,
      });
    }
    return secureJson({
      mode: "pilot",
      authenticated: true,
      localDomainData: true,
      user: {
        id: context.principal.userId,
        organisationId: context.principal.organisationId,
        organisationName: context.principal.organisationName,
        email: context.principal.email,
        displayName: context.principal.displayName,
        role: context.principal.role,
        mustChangePassword: context.principal.mustChangePassword,
        sessionExpiresAt: context.principal.sessionExpiresAt,
      },
      device: context.device
        ? {
            id: context.device.id,
            displayName: context.device.displayName,
            status: context.device.status,
            siteName: context.device.siteName,
            projectRef: context.device.projectRef,
            rigRef: context.device.rigRef,
            lastSeenAt: context.device.lastSeenAt,
          }
        : null,
      sync: {
        sessionVerified: true,
        deviceVerified: context.device !== null,
        domainWrites: "LOCAL_WITH_SERVER_JOURNAL",
        serverJournal: "AUDIT_BACKUP_ONLY",
        mediaBlobs: "LOCAL_ONLY",
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
