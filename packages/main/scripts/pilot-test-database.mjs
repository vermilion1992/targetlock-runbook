import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import { databaseSslOptions } from "./database-ssl.mjs";

const databaseUrl = process.env.TEST_DATABASE_URL?.trim();
if (!databaseUrl) {
  throw new Error(
    "TEST_DATABASE_URL is required for the pilot Postgres integration test.",
  );
}

const migrateScript = fileURLToPath(
  new URL("./pilot-migrate.mjs", import.meta.url),
);

await new Promise((resolve, reject) => {
  const child = spawn(process.execPath, [migrateScript], {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: databaseUrl },
  });
  child.once("error", reject);
  child.once("exit", (code) => {
    if (code === 0) resolve();
    else reject(new Error(`Pilot migrations failed with exit code ${code}.`));
  });
});

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: databaseSslOptions(),
});
try {
  const result = await pool.query(
    `SELECT
       to_regclass('public.pilot_domain_operations') IS NOT NULL AS journal,
       to_regclass('public.pilot_domain_revisions') IS NOT NULL AS revisions,
       to_regclass('public.pilot_core_runs') IS NOT NULL AS core_runs,
       to_regclass('public.pilot_core_change_feed') IS NOT NULL AS core_changes,
       EXISTS (
         SELECT 1
         FROM information_schema.columns
         WHERE table_name = 'pilot_domain_operations'
           AND column_name = 'payload'
           AND data_type = 'jsonb'
       ) AS payload_jsonb,
       EXISTS (
         SELECT 1
         FROM pilot_schema_migrations
         WHERE filename = '0004_stage_7c_core_materialisation.sql'
       ) AS current_schema`,
  );
  const row = result.rows[0];
  if (
    !row?.journal ||
    !row?.revisions ||
    !row?.core_runs ||
    !row?.core_changes ||
    !row?.payload_jsonb ||
    !row?.current_schema
  ) {
    throw new Error("Stage 7C pilot schema assertions failed.");
  }
} finally {
  await pool.end();
}

await new Promise((resolve, reject) => {
  const vitestCli = fileURLToPath(
    new URL("../node_modules/vitest/vitest.mjs", import.meta.url),
  );
  const child = spawn(
    process.execPath,
    [
      vitestCli,
      "run",
      "src/server/pilot/postgres-repository.integration.test.ts",
    ],
    {
      stdio: "inherit",
      env: {
        ...process.env,
        TARGETLOCK_MODE: "pilot",
        DATABASE_URL: databaseUrl,
        PILOT_SESSION_SECRET:
          "integration-test-session-secret-at-least-thirty-two-characters",
        APP_ORIGIN: "http://127.0.0.1:3000",
        ALLOW_INSECURE_PILOT_HTTP: "true",
      },
    },
  );
  child.once("error", reject);
  child.once("exit", (code) => {
    if (code === 0) resolve();
    else reject(
      new Error(`Pilot repository integration failed with exit code ${code}.`),
    );
  });
});

console.log(
  "Pilot Postgres integration passed: authoritative schema, idempotency, materialisation, snapshots, pull cursors, conflicts, and organisation isolation.",
);
