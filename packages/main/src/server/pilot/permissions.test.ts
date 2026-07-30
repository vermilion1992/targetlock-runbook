import { describe, expect, it } from "vitest";

import {
  hasPilotPermission,
  permissionForDomainOperationType,
  PILOT_ROUTE_PERMISSIONS,
  PilotAuthorizationError,
  requirePilotPermission,
} from "./permissions";

describe("pilot permissions", () => {
  it("limits Drillers to assigned Draft-hole onboarding and field writes", () => {
    expect(hasPilotPermission("DRILLER", "PROJECT_SETUP")).toBe(false);
    expect(hasPilotPermission("DRILLER", "CREATE_ASSIGNED_HOLE")).toBe(true);
    expect(hasPilotPermission("DRILLER", "INITIALISE_ASSIGNED_HOLE")).toBe(true);
    expect(hasPilotPermission("DRILLER", "START_ASSIGNED_HOLE")).toBe(true);
    expect(hasPilotPermission("DRILLER", "HOLE_SETUP")).toBe(false);
    expect(hasPilotPermission("DRILLER", "HOLE_COMPLETE")).toBe(false);
    expect(hasPilotPermission("DRILLER", "RECORD_CORRECTION")).toBe(false);
    expect(() =>
      requirePilotPermission({ role: "DRILLER" }, "LEASE_TAKEOVER"),
    ).toThrow(PilotAuthorizationError);
  });

  it("keeps provisioning exclusive to the company administrator", () => {
    expect(hasPilotPermission("SUPERVISOR", "PROVISION_USER")).toBe(false);
    expect(hasPilotPermission("COMPANY_ADMIN", "PROVISION_USER")).toBe(true);
  });

  it("maps privileged domain journal operations to server permissions", () => {
    expect(permissionForDomainOperationType("bha-setups.save.v1")).toBe(
      "INITIALISE_ASSIGNED_HOLE",
    );
    expect(permissionForDomainOperationType("components.assignInitial.v1")).toBe(
      "HOLE_SETUP",
    );
    expect(permissionForDomainOperationType("run-corrections.voidRun.v1")).toBe(
      "RECORD_CORRECTION",
    );
    expect(
      permissionForDomainOperationType("runs.saveCompletedRun.v1"),
    ).toBeNull();
    expect(permissionForDomainOperationType("completion.createHole.v1")).toBe(
      "CREATE_ASSIGNED_HOLE",
    );
    expect(
      permissionForDomainOperationType("completion.activateDraftHole.v1"),
    ).toBe("START_ASSIGNED_HOLE");
    expect(
      permissionForDomainOperationType(
        "trajectory.saveActualConfiguration.v1",
      ),
    ).toBe("INITIALISE_ASSIGNED_HOLE");
    expect(
      permissionForDomainOperationType("completion.beginReview.v1"),
    ).toBe("HOLE_COMPLETE");
    expect(
      permissionForDomainOperationType("completion.commitCompletion.v1"),
    ).toBe("HOLE_COMPLETE");
    expect(permissionForDomainOperationType("completion.reopenHole.v1")).toBe(
      "HOLE_REOPEN",
    );
  });

  it("allows supervisors to view pilot administration without provisioning users", () => {
    expect(hasPilotPermission("SUPERVISOR", "VIEW_PILOT_ADMIN")).toBe(true);
    expect(hasPilotPermission("DRILLER", "VIEW_PILOT_ADMIN")).toBe(false);
  });

  it("keeps every direct setup and correction route outside Driller access", () => {
    expect(
      hasPilotPermission(
        "DRILLER",
        PILOT_ROUTE_PERMISSIONS.INITIAL_BHA_SETUP,
      ),
    ).toBe(true);
    expect(
      hasPilotPermission("DRILLER", PILOT_ROUTE_PERMISSIONS.NEW_HOLE),
    ).toBe(true);
    for (const route of [
      "BHA_SETUP",
      "COMPONENT_ASSIGN",
      "COMPONENT_CHANGE",
      "SURVEY_TOOL_SETUP",
      "SURVEY_SETTINGS",
      "TRAJECTORY_SETUP",
      "TRAJECTORY_PLAN",
      "RUN_CORRECTION",
      "RUN_VOID",
      "CASING_SETUP",
      "CASING_CORRECTION",
      "SURVEY_CORRECTION",
      "TRAY_CORRECTION",
    ] as const) {
      const permission = PILOT_ROUTE_PERMISSIONS[route];
      expect(hasPilotPermission("DRILLER", permission), route).toBe(false);
      expect(hasPilotPermission("SUPERVISOR", permission), route).toBe(true);
    }
  });
});
