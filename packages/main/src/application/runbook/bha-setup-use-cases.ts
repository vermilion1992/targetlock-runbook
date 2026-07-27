import type {
  BottomHoleAssemblySetup,
  BottomHoleAssemblySetupRepository,
  SaveBottomHoleAssemblySetupInput,
} from "@/infrastructure/components";

import {
  getCurrentHoleState,
  type CurrentHoleStateDependencies,
} from "./current-hole-state";

export interface BottomHoleAssemblySetupServices {
  readonly bhaSetups: BottomHoleAssemblySetupRepository;
  readonly currentState: CurrentHoleStateDependencies;
}

export type RecordBottomHoleAssemblySetupInput = Omit<
  SaveBottomHoleAssemblySetupInput,
  "effectiveDepthDm"
>;

/**
 * Captures the authoritative completed depth before appending the setup.
 * Existing run snapshots are intentionally left untouched; the new setup is
 * selected only for calculations occurring after its effective time.
 */
export async function recordBottomHoleAssemblySetup(
  input: RecordBottomHoleAssemblySetupInput,
  services: BottomHoleAssemblySetupServices,
): Promise<BottomHoleAssemblySetup> {
  const state = await getCurrentHoleState(input.holeId, services.currentState);
  return services.bhaSetups.save({
    ...input,
    effectiveDepthDm: state.currentDepthDm,
  });
}
