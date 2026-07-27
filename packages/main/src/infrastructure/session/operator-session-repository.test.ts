import { describe, expect, it } from "vitest";

import type { LocalStorageAdapter } from "@/infrastructure/drafts";
import {
  LocalOperatorSessionRepository,
  operatorSessionStorageKey,
} from "./operator-session-repository";

class MemoryStorage implements LocalStorageAdapter {
  readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}

const FIRST_SIGN_IN = "2026-07-27T14:00:00.000Z";
const SECOND_SIGN_IN = "2026-07-27T15:00:00.000Z";

describe("LocalOperatorSessionRepository", () => {
  it("creates and restores a device-local operator session", () => {
    const storage = new MemoryStorage();
    const repository = new LocalOperatorSessionRepository(storage);

    const session = repository.signIn({
      displayName: "Morgan Lee",
      role: "DRILLER",
      signedInAt: FIRST_SIGN_IN,
    });

    expect(session.operator.localId).toMatch(/^operator-/);
    expect(repository.getSnapshot()).toMatchObject({
      session: {
        operator: {
          displayName: "Morgan Lee",
          role: "DRILLER",
        },
      },
      profiles: [{ displayName: "Morgan Lee" }],
    });
  });

  it("reuses normalized name and role instead of duplicating profiles", () => {
    const repository = new LocalOperatorSessionRepository(new MemoryStorage());
    const first = repository.signIn({
      displayName: "Morgan Lee",
      role: "SUPERVISOR",
      signedInAt: FIRST_SIGN_IN,
    });
    repository.signOut();
    const second = repository.signIn({
      displayName: "  MORGAN   LEE ",
      role: "SUPERVISOR",
      signedInAt: SECOND_SIGN_IN,
    });

    expect(second.operator.localId).toBe(first.operator.localId);
    expect(repository.getSnapshot().profiles).toHaveLength(1);
    expect(second.operator.lastSignedInAt).toBe(SECOND_SIGN_IN);
  });

  it("remembers the last valid hole per operator and retains it after sign-out", () => {
    const repository = new LocalOperatorSessionRepository(new MemoryStorage());
    repository.signIn({
      displayName: "Avery Smith",
      role: "DRILLER",
      signedInAt: FIRST_SIGN_IN,
    });

    expect(
      repository.rememberHole("DDH-050", SECOND_SIGN_IN).lastHoleId,
    ).toBe("DDH-050");
    repository.signOut();
    expect(repository.getSnapshot().session).toBeNull();
    expect(repository.getSnapshot().profiles[0]?.lastHoleId).toBe("DDH-050");
  });

  it("rejects corrupt persisted session data without deleting it", () => {
    const storage = new MemoryStorage();
    storage.setItem(operatorSessionStorageKey(), '{"version":999}');
    const repository = new LocalOperatorSessionRepository(storage);

    expect(() => repository.getSnapshot()).toThrow(
      "saved operator session is incompatible",
    );
    expect(storage.getItem(operatorSessionStorageKey())).toBe(
      '{"version":999}',
    );
  });
});
