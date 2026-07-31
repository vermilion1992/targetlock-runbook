import { cookies } from "next/headers";

import { readPilotEnvironment } from "@/server/pilot/environment";
import {
  isBetaGuestAllowed,
  shouldBypassPilotAuthForGuest,
} from "@/server/pilot/guest";
import { apiErrorResponse, secureJson } from "@/server/pilot/http";
import {
  getCookieNames,
  resolvePilotRequestContext,
} from "@/server/pilot/runtime";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const environment = readPilotEnvironment();
    const betaGuestAllowed = isBetaGuestAllowed();
    if (environment.mode === "demo") {
      return secureJson({
        mode: "demo",
        authenticated: false,
        localDomainData: true,
        betaGuestAllowed: false,
      });
    }
    const cookieStore = await cookies();
    const names = getCookieNames(environment);
    if (
      shouldBypassPilotAuthForGuest(
        environment,
        cookieStore.get(names.guest)?.value ?? null,
      )
    ) {
      return secureJson({
        mode: "demo",
        guest: true,
        authenticated: false,
        localDomainData: true,
        betaGuestAllowed: true,
      });
    }
    const context = await resolvePilotRequestContext();
    if (context === null) {
      return secureJson({
        mode: "pilot",
        authenticated: false,
        localDomainData: true,
        betaGuestAllowed,
      });
    }
    return secureJson({
      mode: "pilot",
      authenticated: true,
      localDomainData: true,
      betaGuestAllowed,
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
