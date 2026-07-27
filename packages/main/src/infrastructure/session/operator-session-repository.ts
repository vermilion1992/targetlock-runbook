import { z } from "zod";

import {
  getBrowserLocalStorageAdapter,
  type LocalStorageAdapter,
} from "@/infrastructure/drafts";

const SESSION_STORAGE_VERSION = 1 as const;

export const operatorRoleSchema = z.enum(["DRILLER", "SUPERVISOR"]);
export type OperatorRole = z.infer<typeof operatorRoleSchema>;

const operatorProfileSchema = z
  .object({
    localId: z.string().trim().min(1).max(200),
    displayName: z.string().trim().min(2).max(100),
    role: operatorRoleSchema,
    createdAt: z.string().datetime(),
    lastSignedInAt: z.string().datetime(),
    lastHoleId: z.string().trim().min(1).max(64).optional(),
  })
  .strict();

const envelopeSchema = z
  .object({
    version: z.literal(SESSION_STORAGE_VERSION),
    activeOperatorId: z.string().min(1).nullable(),
    signedInAt: z.string().datetime().nullable(),
    profiles: z.array(operatorProfileSchema),
  })
  .strict();

export type OperatorProfile = z.infer<typeof operatorProfileSchema>;

export interface OperatorSession {
  readonly operator: OperatorProfile;
  readonly signedInAt: string;
  readonly lastHoleId?: string;
}

export interface SignInOperatorInput {
  readonly displayName: string;
  readonly role: OperatorRole;
  readonly signedInAt: string;
}

export interface OperatorSessionSnapshot {
  readonly session: OperatorSession | null;
  readonly profiles: readonly OperatorProfile[];
}

export interface OperatorSessionRepository {
  getSnapshot(): OperatorSessionSnapshot;
  signIn(input: SignInOperatorInput): OperatorSession;
  signOut(): void;
  rememberHole(holeId: string, occurredAt: string): OperatorSession;
}

export class OperatorSessionRepositoryError extends Error {
  constructor(
    readonly code:
      | "CORRUPTED_STORAGE"
      | "NO_ACTIVE_OPERATOR"
      | "STORAGE_UNAVAILABLE"
      | "VALIDATION_FAILED",
    message: string,
  ) {
    super(message);
    this.name = "OperatorSessionRepositoryError";
  }
}

type Envelope = z.infer<typeof envelopeSchema>;

function normalizeName(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("en-AU");
}

function createOperatorId(): string {
  const unique =
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  return `operator-${unique}`;
}

function sortProfiles(
  profiles: readonly OperatorProfile[],
): readonly OperatorProfile[] {
  return [...profiles].sort(
    (left, right) =>
      Date.parse(right.lastSignedInAt) - Date.parse(left.lastSignedInAt) ||
      left.displayName.localeCompare(right.displayName, "en-AU"),
  );
}

export function operatorSessionStorageKey(): string {
  return `targetlock:prototype:v${SESSION_STORAGE_VERSION}:operator-session`;
}

export class LocalOperatorSessionRepository
  implements OperatorSessionRepository
{
  constructor(private readonly storage: LocalStorageAdapter) {}

  private read(): Envelope {
    let raw: string | null;
    try {
      raw = this.storage.getItem(operatorSessionStorageKey());
    } catch {
      throw new OperatorSessionRepositoryError(
        "STORAGE_UNAVAILABLE",
        "Browser storage is unavailable.",
      );
    }
    if (raw === null) {
      return {
        version: SESSION_STORAGE_VERSION,
        activeOperatorId: null,
        signedInAt: null,
        profiles: [],
      };
    }
    try {
      const parsed = envelopeSchema.safeParse(JSON.parse(raw) as unknown);
      if (!parsed.success) {
        throw new OperatorSessionRepositoryError(
          "CORRUPTED_STORAGE",
          "The saved operator session is incompatible.",
        );
      }
      return parsed.data;
    } catch (error) {
      if (error instanceof OperatorSessionRepositoryError) throw error;
      throw new OperatorSessionRepositoryError(
        "CORRUPTED_STORAGE",
        "The saved operator session is not valid JSON.",
      );
    }
  }

  private write(envelope: Envelope): void {
    const parsed = envelopeSchema.safeParse(envelope);
    if (!parsed.success) {
      throw new OperatorSessionRepositoryError(
        "VALIDATION_FAILED",
        parsed.error.issues[0]?.message ?? "Operator session is invalid.",
      );
    }
    try {
      this.storage.setItem(
        operatorSessionStorageKey(),
        JSON.stringify(parsed.data),
      );
    } catch {
      throw new OperatorSessionRepositoryError(
        "STORAGE_UNAVAILABLE",
        "The operator session could not be saved on this device.",
      );
    }
  }

  getSnapshot(): OperatorSessionSnapshot {
    const envelope = this.read();
    const operator =
      envelope.activeOperatorId === null
        ? undefined
        : envelope.profiles.find(
            ({ localId }) => localId === envelope.activeOperatorId,
          );
    if (
      envelope.activeOperatorId !== null &&
      (operator === undefined || envelope.signedInAt === null)
    ) {
      throw new OperatorSessionRepositoryError(
        "CORRUPTED_STORAGE",
        "The active operator profile is missing.",
      );
    }
    return {
      session:
        operator === undefined || envelope.signedInAt === null
          ? null
          : {
              operator,
              signedInAt: envelope.signedInAt,
              lastHoleId: operator.lastHoleId,
            },
      profiles: sortProfiles(envelope.profiles),
    };
  }

  signIn(input: SignInOperatorInput): OperatorSession {
    const parsed = z
      .object({
        displayName: z.string().trim().min(2).max(100),
        role: operatorRoleSchema,
        signedInAt: z.string().datetime(),
      })
      .strict()
      .safeParse(input);
    if (!parsed.success) {
      throw new OperatorSessionRepositoryError(
        "VALIDATION_FAILED",
        parsed.error.issues[0]?.message ?? "Operator details are invalid.",
      );
    }

    const envelope = this.read();
    const existing = envelope.profiles.find(
      (profile) =>
        normalizeName(profile.displayName) ===
          normalizeName(parsed.data.displayName) &&
        profile.role === parsed.data.role,
    );
    const operator: OperatorProfile =
      existing === undefined
        ? {
            localId: createOperatorId(),
            displayName: parsed.data.displayName,
            role: parsed.data.role,
            createdAt: parsed.data.signedInAt,
            lastSignedInAt: parsed.data.signedInAt,
          }
        : {
            ...existing,
            displayName: parsed.data.displayName,
            lastSignedInAt: parsed.data.signedInAt,
          };
    this.write({
      ...envelope,
      activeOperatorId: operator.localId,
      signedInAt: parsed.data.signedInAt,
      profiles:
        existing === undefined
          ? [...envelope.profiles, operator]
          : envelope.profiles.map((profile) =>
              profile.localId === operator.localId ? operator : profile,
            ),
    });
    return {
      operator,
      signedInAt: parsed.data.signedInAt,
      lastHoleId: operator.lastHoleId,
    };
  }

  signOut(): void {
    const envelope = this.read();
    this.write({
      ...envelope,
      activeOperatorId: null,
      signedInAt: null,
    });
  }

  rememberHole(holeId: string, occurredAt: string): OperatorSession {
    const parsed = z
      .object({
        holeId: z.string().trim().min(1).max(64),
        occurredAt: z.string().datetime(),
      })
      .safeParse({ holeId, occurredAt });
    if (!parsed.success) {
      throw new OperatorSessionRepositoryError(
        "VALIDATION_FAILED",
        "A valid hole ID and time are required.",
      );
    }
    const envelope = this.read();
    if (envelope.activeOperatorId === null || envelope.signedInAt === null) {
      throw new OperatorSessionRepositoryError(
        "NO_ACTIVE_OPERATOR",
        "Sign in before opening a hole.",
      );
    }
    const operator = envelope.profiles.find(
      ({ localId }) => localId === envelope.activeOperatorId,
    );
    if (operator === undefined) {
      throw new OperatorSessionRepositoryError(
        "CORRUPTED_STORAGE",
        "The active operator profile is missing.",
      );
    }
    const updated = { ...operator, lastHoleId: parsed.data.holeId };
    this.write({
      ...envelope,
      profiles: envelope.profiles.map((profile) =>
        profile.localId === updated.localId ? updated : profile,
      ),
    });
    return {
      operator: updated,
      signedInAt: envelope.signedInAt,
      lastHoleId: updated.lastHoleId,
    };
  }
}

export function createBrowserOperatorSessionRepository(): OperatorSessionRepository | null {
  const storage = getBrowserLocalStorageAdapter();
  return storage === null ? null : new LocalOperatorSessionRepository(storage);
}
