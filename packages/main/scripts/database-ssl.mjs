export function databaseSslOptions(env = process.env) {
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
