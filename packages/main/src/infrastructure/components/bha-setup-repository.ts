import { z } from "zod";

import {
  calculateBaseRodString,
  decimetres,
  type BarrelStyle,
  type Decimetres,
  type ReamerStyle,
  type RodStringConfiguration,
} from "@/domain";
import {
  getBrowserLocalStorageAdapter,
  type LocalStorageAdapter,
} from "@/infrastructure/drafts";
import type { HoleMutationGuardPort } from "@/infrastructure/completion";

const STORAGE_VERSION = 1 as const;

const barrelStyleSchema = z.enum(["STANDARD", "FLEXI", "CHROME"]);
const reamerStyleSchema = z.enum(["BLANK", "STANDARD", "OVERSIZE"]);

const setupSchema = z.object({
  localId: z.string().min(1),
  holeId: z.string().min(1),
  effectiveAt: z.string().datetime(),
  bottomHoleAssemblyLengthDm: z.number().int().positive(),
  constantStickUpDm: z.number().int().nonnegative(),
  baseRodStringLengthDm: z.number().int().nonnegative(),
  bitStyle: z.string().trim().max(100).optional(),
  bitSerialNumber: z.string().trim().max(100).optional(),
  frontReamerStyle: reamerStyleSchema.optional(),
  frontReamerSerialNumber: z.string().trim().max(100).optional(),
  barrelStyle: barrelStyleSchema.optional(),
  barrelSerialNumber: z.string().trim().max(100).optional(),
  rearReamerStyle: reamerStyleSchema.optional(),
  rearReamerSerialNumber: z.string().trim().max(100).optional(),
  innerTubeSerialNumber: z.string().trim().max(100).optional(),
  overshotSerialNumber: z.string().trim().max(100).optional(),
  reason: z.string().trim().min(1).max(500),
  recordedByUserId: z.string().min(1),
  recordedByNameSnapshot: z.string().trim().min(1),
});

const envelopeSchema = z.object({
  version: z.literal(STORAGE_VERSION),
  holeId: z.string().min(1),
  setups: z.array(setupSchema),
});

export interface BottomHoleAssemblySetup {
  readonly localId: string;
  readonly holeId: string;
  readonly effectiveAt: string;
  readonly bottomHoleAssemblyLengthDm: Decimetres;
  readonly constantStickUpDm: Decimetres;
  readonly baseRodStringLengthDm: Decimetres;
  readonly bitStyle?: string;
  readonly bitSerialNumber?: string;
  readonly frontReamerStyle?: ReamerStyle;
  readonly frontReamerSerialNumber?: string;
  readonly barrelStyle?: BarrelStyle;
  readonly barrelSerialNumber?: string;
  readonly rearReamerStyle?: ReamerStyle;
  readonly rearReamerSerialNumber?: string;
  readonly innerTubeSerialNumber?: string;
  readonly overshotSerialNumber?: string;
  readonly reason: string;
  readonly recordedByUserId: string;
  readonly recordedByNameSnapshot: string;
}

export interface SaveBottomHoleAssemblySetupInput {
  readonly operationId: string;
  readonly holeId: string;
  readonly effectiveAt: string;
  readonly bottomHoleAssemblyLengthDm: Decimetres;
  readonly constantStickUpDm: Decimetres;
  readonly bitStyle?: string;
  readonly bitSerialNumber?: string;
  readonly frontReamerStyle?: ReamerStyle;
  readonly frontReamerSerialNumber?: string;
  readonly barrelStyle?: BarrelStyle;
  readonly barrelSerialNumber?: string;
  readonly rearReamerStyle?: ReamerStyle;
  readonly rearReamerSerialNumber?: string;
  readonly innerTubeSerialNumber?: string;
  readonly overshotSerialNumber?: string;
  readonly reason: string;
  readonly recordedByUserId: string;
  readonly recordedByNameSnapshot: string;
}

export interface BottomHoleAssemblySetupRepository {
  listByHole(holeId: string): Promise<readonly BottomHoleAssemblySetup[]>;
  getCurrent(holeId: string): Promise<BottomHoleAssemblySetup | null>;
  save(
    input: SaveBottomHoleAssemblySetupInput,
  ): Promise<BottomHoleAssemblySetup>;
}

function storageKey(holeId: string): string {
  return `targetlock:prototype:v${STORAGE_VERSION}:hole:${encodeURIComponent(holeId)}:bha-setups`;
}

function optionalTrimmed(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function asSetup(value: z.infer<typeof setupSchema>): BottomHoleAssemblySetup {
  return {
    ...value,
    bottomHoleAssemblyLengthDm: decimetres(
      value.bottomHoleAssemblyLengthDm,
    ),
    constantStickUpDm: decimetres(value.constantStickUpDm),
    baseRodStringLengthDm: decimetres(value.baseRodStringLengthDm),
  };
}

function seedSetup(
  configuration: RodStringConfiguration,
): z.infer<typeof setupSchema> {
  return setupSchema.parse({
    localId: configuration.localId,
    holeId: configuration.holeId,
    effectiveAt: configuration.effectiveAt,
    bottomHoleAssemblyLengthDm: Number(
      configuration.bottomHoleAssemblyLength,
    ),
    constantStickUpDm: Number(configuration.constantStickUp),
    baseRodStringLengthDm: Number(configuration.baseRodStringLength),
    reason: configuration.reason,
    recordedByUserId: "seed",
    recordedByNameSnapshot: "Imported configuration",
  });
}

export class LocalBottomHoleAssemblySetupRepository
  implements BottomHoleAssemblySetupRepository
{
  constructor(
    private readonly storage: LocalStorageAdapter,
    private readonly seedConfigurations: readonly RodStringConfiguration[] = [],
    private readonly mutationGuard?: HoleMutationGuardPort,
  ) {}

  private read(holeId: string): z.infer<typeof envelopeSchema> {
    const raw = this.storage.getItem(storageKey(holeId));
    if (raw === null) {
      return {
        version: STORAGE_VERSION,
        holeId,
        setups: this.seedConfigurations
          .filter((configuration) => configuration.holeId === holeId)
          .map(seedSetup),
      };
    }
    const parsed = envelopeSchema.safeParse(JSON.parse(raw) as unknown);
    if (!parsed.success || parsed.data.holeId !== holeId) {
      throw new Error("Bottom-hole assembly settings are corrupted.");
    }
    return parsed.data;
  }

  async listByHole(
    holeId: string,
  ): Promise<readonly BottomHoleAssemblySetup[]> {
    return this.read(holeId)
      .setups.map(asSetup)
      .sort(
        (left, right) =>
          Date.parse(left.effectiveAt) - Date.parse(right.effectiveAt),
      );
  }

  async getCurrent(
    holeId: string,
  ): Promise<BottomHoleAssemblySetup | null> {
    return (await this.listByHole(holeId)).at(-1) ?? null;
  }

  async save(
    input: SaveBottomHoleAssemblySetupInput,
  ): Promise<BottomHoleAssemblySetup> {
    this.mutationGuard?.assertHoleMutable(input.holeId);
    if (input.constantStickUpDm > input.bottomHoleAssemblyLengthDm) {
      throw new Error(
        "Constant stick-up cannot exceed the bottom-hole assembly length.",
      );
    }
    const envelope = this.read(input.holeId);
    const existing = envelope.setups.find(
      ({ localId }) => localId === input.operationId,
    );
    if (existing) return asSetup(existing);
    const baseRodStringLengthDm = calculateBaseRodString(
      input.bottomHoleAssemblyLengthDm,
      input.constantStickUpDm,
    );
    const setup = setupSchema.parse({
      localId: input.operationId,
      holeId: input.holeId,
      effectiveAt: input.effectiveAt,
      bottomHoleAssemblyLengthDm: Number(input.bottomHoleAssemblyLengthDm),
      constantStickUpDm: Number(input.constantStickUpDm),
      baseRodStringLengthDm: Number(baseRodStringLengthDm),
      bitStyle: optionalTrimmed(input.bitStyle),
      bitSerialNumber: optionalTrimmed(input.bitSerialNumber),
      frontReamerStyle: input.frontReamerStyle,
      frontReamerSerialNumber: optionalTrimmed(input.frontReamerSerialNumber),
      barrelStyle: input.barrelStyle,
      barrelSerialNumber: optionalTrimmed(input.barrelSerialNumber),
      rearReamerStyle: input.rearReamerStyle,
      rearReamerSerialNumber: optionalTrimmed(input.rearReamerSerialNumber),
      innerTubeSerialNumber: optionalTrimmed(input.innerTubeSerialNumber),
      overshotSerialNumber: optionalTrimmed(input.overshotSerialNumber),
      reason: input.reason.trim(),
      recordedByUserId: input.recordedByUserId,
      recordedByNameSnapshot: input.recordedByNameSnapshot,
    });
    this.storage.setItem(
      storageKey(input.holeId),
      JSON.stringify({
        ...envelope,
        setups: [...envelope.setups, setup],
      }),
    );
    return asSetup(setup);
  }
}

export function createBrowserBottomHoleAssemblySetupRepository(
  seedConfigurations: readonly RodStringConfiguration[] = [],
  mutationGuard?: HoleMutationGuardPort,
): BottomHoleAssemblySetupRepository | null {
  const storage = getBrowserLocalStorageAdapter();
  return storage === null
    ? null
    : new LocalBottomHoleAssemblySetupRepository(
        storage,
        seedConfigurations,
        mutationGuard,
      );
}
