import { hash } from "bcryptjs";
import { Pool } from "pg";
import { databaseSslOptions } from "./database-ssl.mjs";

const required = [
  "DATABASE_URL",
  "PILOT_BOOTSTRAP_ORG_SLUG",
  "PILOT_BOOTSTRAP_ORG_NAME",
  "PILOT_BOOTSTRAP_ADMIN_EMAIL",
  "PILOT_BOOTSTRAP_ADMIN_NAME",
  "PILOT_BOOTSTRAP_ADMIN_PASSWORD",
];
const missing = required.filter((name) => !process.env[name]?.trim());
if (missing.length > 0) {
  throw new Error(`Missing bootstrap variables: ${missing.join(", ")}`);
}

const databaseUrl = process.env.DATABASE_URL;
const organisationSlug = process.env.PILOT_BOOTSTRAP_ORG_SLUG.trim().toLowerCase();
const organisationName = process.env.PILOT_BOOTSTRAP_ORG_NAME.trim();
const adminEmail = process.env.PILOT_BOOTSTRAP_ADMIN_EMAIL.trim().toLowerCase();
const adminName = process.env.PILOT_BOOTSTRAP_ADMIN_NAME.trim();
const adminPassword = process.env.PILOT_BOOTSTRAP_ADMIN_PASSWORD;

if (!/^[a-z0-9][a-z0-9-]{1,78}[a-z0-9]$/.test(organisationSlug)) {
  throw new Error("PILOT_BOOTSTRAP_ORG_SLUG must use lowercase letters, digits, and hyphens.");
}
if (!adminEmail.includes("@")) {
  throw new Error("PILOT_BOOTSTRAP_ADMIN_EMAIL is invalid.");
}
if (adminPassword.length < 12) {
  throw new Error("PILOT_BOOTSTRAP_ADMIN_PASSWORD must contain at least 12 characters.");
}

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: databaseSslOptions(),
});
const client = await pool.connect();

try {
  await client.query("BEGIN");
  const organisationResult = await client.query(
    `INSERT INTO pilot_organisations (slug, name)
     VALUES ($1, $2)
     ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
     RETURNING id`,
    [organisationSlug, organisationName],
  );
  const organisationId = organisationResult.rows[0].id;
  const memberCount = await client.query(
    "SELECT count(*)::int AS count FROM pilot_memberships WHERE organisation_id = $1",
    [organisationId],
  );
  if (memberCount.rows[0].count > 0) {
    throw new Error(
      "Bootstrap refused: this organisation already has members. Use the authenticated provisioning endpoint.",
    );
  }

  const passwordHash = await hash(adminPassword, 12);
  const userResult = await client.query(
    `INSERT INTO pilot_users (email, display_name, password_hash)
     VALUES ($1, $2, $3)
     RETURNING id`,
    [adminEmail, adminName, passwordHash],
  );
  const userId = userResult.rows[0].id;
  await client.query(
    `INSERT INTO pilot_memberships (organisation_id, user_id, role)
     VALUES ($1, $2, 'COMPANY_ADMIN')`,
    [organisationId, userId],
  );
  await client.query(
    `INSERT INTO pilot_audit_events (
       organisation_id, actor_user_id, action, target_type, target_id, metadata
     ) VALUES ($1, $2, 'ORGANISATION_BOOTSTRAPPED', 'ORGANISATION', $3, $4::jsonb)`,
    [
      organisationId,
      userId,
      String(organisationId),
      JSON.stringify({ adminUserId: userId, role: "COMPANY_ADMIN" }),
    ],
  );
  await client.query("COMMIT");
  console.log(
    `Bootstrapped organisation "${organisationSlug}" and its company administrator.`,
  );
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  client.release();
  await pool.end();
}
