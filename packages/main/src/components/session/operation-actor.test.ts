import { describe, expect, it } from "vitest";

import type { OperatorSession } from "@/infrastructure/session";
import { resolveOperationActor } from "./operation-actor";

const session = {
  operator: {
    localId: "40000000-0000-4000-8000-000000000001",
    displayName: "Real Pilot Operator",
  },
} as OperatorSession;
const fallback = {
  id: "user-driller-hoffman",
  name: "M. Hoffman",
  organisationId: "organisation-briggs",
};

describe("operation actor attribution", () => {
  it("uses the authenticated pilot identity instead of demo actors", () => {
    expect(
      resolveOperationActor(
        "pilot",
        session,
        {
          organisationId: "20000000-0000-4000-8000-000000000001",
          operatorId: session.operator.localId,
        },
        fallback,
      ),
    ).toEqual({
      id: session.operator.localId,
      name: "Real Pilot Operator",
      organisationId: "20000000-0000-4000-8000-000000000001",
    });
  });

  it("fails closed when pilot session identities do not agree", () => {
    expect(() =>
      resolveOperationActor(
        "pilot",
        session,
        {
          organisationId: "20000000-0000-4000-8000-000000000001",
          operatorId: "40000000-0000-4000-8000-000000000099",
        },
        fallback,
      ),
    ).toThrow(/active pilot identity/i);
  });

  it("preserves explicit demo attribution", () => {
    expect(resolveOperationActor("demo", session, null, fallback)).toBe(
      fallback,
    );
  });
});
