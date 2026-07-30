import type { OperatorSession } from "@/infrastructure/session";

export interface OperationActor {
  readonly id: string;
  readonly name: string;
  readonly organisationId: string;
}

export function resolveOperationActor(
  runtimeMode: "loading" | "demo" | "pilot",
  session: OperatorSession | null,
  pilot: {
    readonly organisationId: string;
    readonly operatorId: string;
  } | null,
  demoFallback: OperationActor,
): OperationActor {
  if (runtimeMode !== "pilot") return demoFallback;
  if (
    session === null ||
    pilot === null ||
    session.operator.localId !== pilot.operatorId
  ) {
    throw new Error(
      "The active pilot identity is unavailable. Sign in again before recording work.",
    );
  }
  return {
    id: pilot.operatorId,
    name: session.operator.displayName,
    organisationId: pilot.organisationId,
  };
}
