import { hash } from "bcryptjs";
import { Pool } from "pg";
import { databaseSslOptions } from "./database-ssl.mjs";

const email = process.env.PILOT_RESET_EMAIL?.trim().toLowerCase();
const password = process.env.PILOT_RESET_PASSWORD ?? "";

if (!email?.includes("@")) {
  throw new Error("Set PILOT_RESET_EMAIL to the account email.");
}
if (password.length < 12) {
  throw new Error("Set PILOT_RESET_PASSWORD to at least 12 characters.");
}
if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required.");
}

const passwordHash = await hash(password, 12);
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: databaseSslOptions(),
});

try {
  const result = await pool.query(
    `UPDATE pilot_users
     SET password_hash = $1,
         password_changed_at = now(),
         session_version = session_version + 1
     WHERE email = $2
     RETURNING email`,
    [passwordHash, email],
  );
  if (result.rowCount !== 1) {
    throw new Error(`No user found for email: ${email}`);
  }
  console.log(`Password reset for ${result.rows[0].email}`);
} finally {
  await pool.end();
}
