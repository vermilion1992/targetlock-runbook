import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import { databaseSslOptions } from "./database-ssl.mjs";

const databaseUrl = process.env.DATABASE_URL;
if (
  !databaseUrl ||
  (!databaseUrl.startsWith("postgres://") &&
    !databaseUrl.startsWith("postgresql://"))
) {
  throw new Error("DATABASE_URL must be a Postgres connection URL.");
}

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: databaseSslOptions(),
});
const migrationsDirectory = fileURLToPath(
  new URL("../migrations/", import.meta.url),
);

try {
  const lockClient = await pool.connect();
  try {
    await lockClient.query(
      "SELECT pg_advisory_lock(hashtext('targetlock:pilot:migrations'))",
    );
    await lockClient.query(`
      CREATE TABLE IF NOT EXISTS pilot_schema_migrations (
        filename text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `);
  const filenames = (await readdir(migrationsDirectory))
    .filter((filename) => filename.endsWith(".sql"))
    .sort();

    if (process.argv.includes("--check")) {
      const applied = await lockClient.query(
        "SELECT filename FROM pilot_schema_migrations ORDER BY filename",
      );
      const appliedNames = new Set(applied.rows.map(({ filename }) => filename));
      const missing = filenames.filter((filename) => !appliedNames.has(filename));
      if (missing.length > 0) {
        throw new Error(`Pending pilot migrations: ${missing.join(", ")}`);
      }
      console.log(`Pilot schema current: ${filenames.at(-1) ?? "none"}`);
      process.exitCode = 0;
    } else {
  for (const filename of filenames) {
    const existing = await lockClient.query(
      "SELECT 1 FROM pilot_schema_migrations WHERE filename = $1",
      [filename],
    );
    if (existing.rowCount) {
      console.log(`Already applied: ${filename}`);
      continue;
    }
    const sql = await readFile(`${migrationsDirectory}/${filename}`, "utf8");
    try {
      await lockClient.query("BEGIN");
      await lockClient.query(sql);
      await lockClient.query(
        "INSERT INTO pilot_schema_migrations (filename) VALUES ($1)",
        [filename],
      );
      await lockClient.query("COMMIT");
      console.log(`Applied: ${filename}`);
    } catch (error) {
      await lockClient.query("ROLLBACK");
      throw error;
    }
  }
    }
    await lockClient.query(
      "SELECT pg_advisory_unlock(hashtext('targetlock:pilot:migrations'))",
    );
  } finally {
    lockClient.release();
  }
} finally {
  await pool.end();
}
