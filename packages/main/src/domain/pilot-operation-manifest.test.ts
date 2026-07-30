import { describe, expect, it } from "vitest";

import {
  PILOT_OPERATION_MANIFEST,
  canonicalPilotOperationType,
  derivePilotOperationContext,
  derivePilotRevisionRef,
} from "./pilot-operation-manifest";

const authoritativeArguments: Readonly<
  Record<string, readonly unknown[]>
> = {
  "completion.activateDraftHole": [
    "hole-1",
    "2026-07-29T00:00:00.000Z",
  ],
  "trajectory.activate": [
    "hole-1",
    "plan-1",
    "operation-1",
    "2026-07-29T00:00:00.000Z",
  ],
  "trajectory.supersede": [
    "hole-1",
    "plan-1",
    "operation-1",
    "2026-07-29T00:00:00.000Z",
  ],
};

describe("authoritative pilot operation context contracts", () => {
  it("derives pre-mutation hole context and revision identity for positional methods", () => {
    for (const [key, args] of Object.entries(authoritativeArguments)) {
      const [repository, method] = key.split(".");
      const context = derivePilotOperationContext(repository!, method!, args, {
        projectRef: "project-1",
        rigRef: "rig-1",
      });
      expect(context, key).toMatchObject({
        projectRef: "project-1",
        rigRef: "rig-1",
        holeRef: "hole-1",
      });
      expect(derivePilotRevisionRef(repository!, args), key).toBe(
        repository === "trajectory"
          ? "trajectory:plan-1"
          : "completion:hole-1",
      );
    }
  });

  it("gives every authoritative manifest mutation a canonical, assigned context before local mutation", () => {
    for (const [repository, methods] of Object.entries(
      PILOT_OPERATION_MANIFEST,
    )) {
      for (const [method, definition] of Object.entries(methods)) {
        if (definition.materializer === null) continue;
        const key = `${repository}.${method}`;
        const args =
          authoritativeArguments[key] ??
          [
            {
              projectId: "project-1",
              rigId: "rig-1",
              holeId: "hole-1",
              shiftId: "shift-1",
              localId: `${method}-1`,
              expectedVersion: 4,
            },
          ];
        const context = derivePilotOperationContext(
          repository,
          method,
          args,
          {
            projectRef: "project-1",
            rigRef: "rig-1",
          },
        );
        expect(canonicalPilotOperationType(repository, method), key).toBe(
          `${repository}.${method}.v1`,
        );
        expect(context.projectRef, key).toBe("project-1");
        expect(context.rigRef, key).toBe("rig-1");
        if (definition.materializer !== "PROJECT_DIRECTORY") {
          expect(context.holeRef, key).toBe("hole-1");
        }
      }
    }
  });
});
