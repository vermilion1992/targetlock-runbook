import { AsyncLocalStorage } from "node:async_hooks";
import {
  Pool,
  type PoolClient,
  type QueryResult,
  type QueryResultRow,
} from "pg";

import {
  readPilotEnvironment,
  type SecurePilotEnvironment,
} from "./environment";

declare global {
  var __targetLockPilotPool: Pool | undefined;
}

const pilotTransaction = new AsyncLocalStorage<PoolClient>();

export const EXPECTED_PILOT_SCHEMA_MIGRATION =
  "0005_stage_7c_review_hardening.sql";

export function databaseSslOptions(
  env: Record<string, string | undefined> = process.env,
): { readonly rejectUnauthorized: boolean; readonly ca?: string } | undefined {
  const mode = env.DATABASE_SSL?.trim().toLowerCase();
  if (!mode || mode === "disable") return undefined;
  if (mode === "require") return { rejectUnauthorized: false };
  if (mode === "verify-ca") {
    const ca = env.DATABASE_CA_CERT?.replace(/\\n/g, "\n").trim();
    if (!ca) {
      throw new Error(
        "DATABASE_CA_CERT is required when DATABASE_SSL=verify-ca.",
      );
    }
    return { rejectUnauthorized: true, ca };
  }
  throw new Error(
    "DATABASE_SSL must be disable, require, or verify-ca when set.",
  );
}

function createPool(environment: SecurePilotEnvironment): Pool {
  return new Pool({
    connectionString: environment.databaseUrl,
    max: 10,
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 30_000,
    ssl: databaseSslOptions(),
  });
}

export function getPilotPool(): Pool {
  const environment = readPilotEnvironment();
  if (environment.mode !== "pilot") {
    throw new Error("The pilot database is unavailable in demo mode.");
  }
  globalThis.__targetLockPilotPool ??= createPool(environment);
  return globalThis.__targetLockPilotPool;
}

export async function withTransaction<T>(
  operation: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const active = pilotTransaction.getStore();
  if (active) return operation(active);
  const client = await getPilotPool().connect();
  try {
    await client.query("BEGIN");
    const result = await pilotTransaction.run(client, () =>
      operation(client),
    );
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function queryPilotDatabase<T extends QueryResultRow>(
  text: string,
  values?: readonly unknown[],
): Promise<QueryResult<T>> {
  const client = pilotTransaction.getStore() ?? getPilotPool();
  return client.query<T>(text, values ? [...values] : undefined);
}

export async function checkPilotDatabase(): Promise<boolean> {
  return (await getPilotDatabaseReadiness()).ready;
}

export interface PilotDatabaseReadiness {
  readonly ready: boolean;
  readonly reachable: boolean;
  readonly expectedMigration: string;
  readonly currentMigration: string | null;
}

export async function getPilotDatabaseReadiness(): Promise<PilotDatabaseReadiness> {
  try {
    const result = await getPilotPool().query<{ filename: string }>(
      `SELECT filename
       FROM pilot_schema_migrations
       ORDER BY filename DESC
       LIMIT 1`,
    );
    const currentMigration = result.rows[0]?.filename ?? null;
    return {
      ready: currentMigration === EXPECTED_PILOT_SCHEMA_MIGRATION,
      reachable: true,
      expectedMigration: EXPECTED_PILOT_SCHEMA_MIGRATION,
      currentMigration,
    };
  } catch {
    return {
      ready: false,
      reachable: false,
      expectedMigration: EXPECTED_PILOT_SCHEMA_MIGRATION,
      currentMigration: null,
    };
  }
}

export function firstRow<T extends QueryResultRow>(
  rows: readonly T[],
): T | null {
  return rows[0] ?? null;
}
