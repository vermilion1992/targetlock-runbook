import type { ReactNode } from "react";

import { requirePilotPageSession } from "./runtime";
import { PILOT_ROUTE_PERMISSIONS } from "./permissions";
import type { PilotPermission } from "./types";

export async function PilotPermissionBoundary({
  children,
  permission,
}: {
  readonly children: ReactNode;
  readonly permission: PilotPermission;
}) {
  await requirePilotPageSession("/start", permission);
  return children;
}

export async function PilotRoutePermissionBoundary({
  children,
  route,
}: {
  readonly children: ReactNode;
  readonly route: keyof typeof PILOT_ROUTE_PERMISSIONS;
}) {
  await requirePilotPageSession("/start", PILOT_ROUTE_PERMISSIONS[route]);
  return children;
}
