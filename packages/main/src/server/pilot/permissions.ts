import type { PilotPermission, PilotPrincipal, PilotRole } from "./types";
import {
  canonicalPilotOperationType,
  pilotRepositoryMethodDefinition,
} from "@/domain/pilot-operation-manifest";

const ROLE_PERMISSIONS: Readonly<Record<PilotRole, ReadonlySet<PilotPermission>>> =
  {
    COMPANY_ADMIN: new Set([
      "PROJECT_SETUP",
      "CREATE_ASSIGNED_HOLE",
      "INITIALISE_ASSIGNED_HOLE",
      "START_ASSIGNED_HOLE",
      "HOLE_SETUP",
      "HOLE_COMPLETE",
      "HOLE_REOPEN",
      "RECORD_CORRECTION",
      "VIEW_PILOT_ADMIN",
      "PROVISION_USER",
      "REGISTER_DEVICE",
      "ASSIGN_DEVICE",
      "LEASE_TAKEOVER",
      "LEASE_WRITE",
      "SYNC_OPERATION",
    ]),
    SUPERVISOR: new Set([
      "PROJECT_SETUP",
      "CREATE_ASSIGNED_HOLE",
      "INITIALISE_ASSIGNED_HOLE",
      "START_ASSIGNED_HOLE",
      "HOLE_SETUP",
      "HOLE_COMPLETE",
      "HOLE_REOPEN",
      "RECORD_CORRECTION",
      "VIEW_PILOT_ADMIN",
      "REGISTER_DEVICE",
      "ASSIGN_DEVICE",
      "LEASE_TAKEOVER",
      "LEASE_WRITE",
      "SYNC_OPERATION",
    ]),
    DRILLER: new Set([
      "CREATE_ASSIGNED_HOLE",
      "INITIALISE_ASSIGNED_HOLE",
      "START_ASSIGNED_HOLE",
      "LEASE_WRITE",
      "SYNC_OPERATION",
    ]),
  };

export function hasPilotPermission(
  role: PilotRole,
  permission: PilotPermission,
): boolean {
  return ROLE_PERMISSIONS[role].has(permission);
}

export class PilotAuthorizationError extends Error {
  constructor(readonly permission: PilotPermission) {
    super("You do not have permission to perform this action.");
    this.name = "PilotAuthorizationError";
  }
}

export function requirePilotPermission(
  principal: Pick<PilotPrincipal, "role">,
  permission: PilotPermission,
): void {
  if (!hasPilotPermission(principal.role, permission)) {
    throw new PilotAuthorizationError(permission);
  }
}

export function permissionForDomainOperationType(
  operationType: string,
): PilotPermission | null {
  const [repository, method, version, ...rest] = operationType.split(".");
  if (!repository || !method || version !== "v1" || rest.length > 0) {
    return null;
  }
  if (canonicalPilotOperationType(repository, method) !== operationType) {
    return null;
  }
  return pilotRepositoryMethodDefinition(repository, method)?.permission ?? null;
}

export const PILOT_ROUTE_PERMISSIONS = {
  PROJECTS: "PROJECT_SETUP",
  NEW_HOLE: "CREATE_ASSIGNED_HOLE",
  INITIAL_BHA_SETUP: "INITIALISE_ASSIGNED_HOLE",
  BHA_SETUP: "HOLE_SETUP",
  COMPONENT_ASSIGN: "HOLE_SETUP",
  COMPONENT_CHANGE: "HOLE_SETUP",
  SURVEY_TOOL_SETUP: "HOLE_SETUP",
  SURVEY_SETTINGS: "HOLE_SETUP",
  TRAJECTORY_SETUP: "HOLE_SETUP",
  TRAJECTORY_PLAN: "HOLE_SETUP",
  RUN_CORRECTION: "RECORD_CORRECTION",
  RUN_VOID: "RECORD_CORRECTION",
  CASING_SETUP: "HOLE_SETUP",
  CASING_CORRECTION: "RECORD_CORRECTION",
  SURVEY_CORRECTION: "RECORD_CORRECTION",
  TRAY_CORRECTION: "RECORD_CORRECTION",
  HOLE_COMPLETE: "HOLE_COMPLETE",
  HOLE_REOPEN: "HOLE_REOPEN",
  PILOT_ADMIN: "VIEW_PILOT_ADMIN",
} as const satisfies Readonly<Record<string, PilotPermission>>;
