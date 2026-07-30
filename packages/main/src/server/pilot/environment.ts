import { z } from "zod";

const modeSchema = z.enum(["demo", "pilot"]);

export class PilotConfigurationError extends Error {
  constructor(readonly issues: readonly string[]) {
    super(`Pilot configuration is invalid: ${issues.join("; ")}`);
    this.name = "PilotConfigurationError";
  }
}

export interface DemoEnvironment {
  readonly mode: "demo";
  readonly nodeEnv: string;
}

export interface SecurePilotEnvironment {
  readonly mode: "pilot";
  readonly nodeEnv: string;
  readonly databaseUrl: string;
  readonly sessionSecret: string;
  readonly appOrigin: string;
  readonly sessionTtlSeconds: number;
}

export type PilotEnvironment = DemoEnvironment | SecurePilotEnvironment;

function isTrue(value: string | undefined): boolean {
  return value?.trim().toLowerCase() === "true";
}

function parseTtl(value: string | undefined, issues: string[]): number {
  if (!value) return 28_800;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 900 || parsed > 86_400) {
    issues.push("PILOT_SESSION_TTL_SECONDS must be between 900 and 86400");
    return 28_800;
  }
  return parsed;
}

export function readPilotEnvironment(
  env: Record<string, string | undefined> = process.env,
): PilotEnvironment {
  const nodeEnv = env.NODE_ENV ?? "development";
  const rawMode = env.TARGETLOCK_MODE?.trim().toLowerCase();
  const modeResult = modeSchema.safeParse(
    rawMode ?? (nodeEnv === "production" ? undefined : "demo"),
  );
  if (!modeResult.success) {
    throw new PilotConfigurationError([
      "TARGETLOCK_MODE must be explicitly set to demo or pilot",
    ]);
  }

  if (modeResult.data === "demo") {
    if (
      nodeEnv === "production" &&
      !isTrue(env.ALLOW_LOCAL_DEMO_IN_PRODUCTION)
    ) {
      throw new PilotConfigurationError([
        "demo mode is blocked in production unless ALLOW_LOCAL_DEMO_IN_PRODUCTION=true",
      ]);
    }
    return { mode: "demo", nodeEnv };
  }

  const issues: string[] = [];
  const databaseUrl = env.DATABASE_URL?.trim() ?? "";
  const sessionSecret = env.PILOT_SESSION_SECRET ?? "";
  const appOrigin = env.APP_ORIGIN?.trim() ?? "";
  const databaseSsl = env.DATABASE_SSL?.trim().toLowerCase();

  if (!databaseUrl.startsWith("postgres://") && !databaseUrl.startsWith("postgresql://")) {
    issues.push("DATABASE_URL must be a Postgres connection URL");
  }
  if (sessionSecret.length < 32) {
    issues.push("PILOT_SESSION_SECRET must contain at least 32 characters");
  }
  if (
    databaseSsl &&
    !["disable", "require", "verify-ca"].includes(databaseSsl)
  ) {
    issues.push("DATABASE_SSL must be disable, require, or verify-ca");
  }
  if (
    databaseSsl === "verify-ca" &&
    (env.DATABASE_CA_CERT?.trim().length ?? 0) < 20
  ) {
    issues.push("DATABASE_CA_CERT is required when DATABASE_SSL=verify-ca");
  }
  try {
    const parsedOrigin = new URL(appOrigin);
    if (parsedOrigin.origin !== appOrigin || parsedOrigin.pathname !== "/") {
      issues.push("APP_ORIGIN must be an origin without a path");
    }
    if (
      nodeEnv === "production" &&
      parsedOrigin.protocol !== "https:" &&
      !isTrue(env.ALLOW_INSECURE_PILOT_HTTP)
    ) {
      issues.push("APP_ORIGIN must use HTTPS in production");
    }
  } catch {
    issues.push("APP_ORIGIN must be a valid absolute origin");
  }

  const sessionTtlSeconds = parseTtl(
    env.PILOT_SESSION_TTL_SECONDS,
    issues,
  );
  if (issues.length > 0) throw new PilotConfigurationError(issues);

  return {
    mode: "pilot",
    nodeEnv,
    databaseUrl,
    sessionSecret,
    appOrigin,
    sessionTtlSeconds,
  };
}

export function isSecurePilotMode(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return readPilotEnvironment(env).mode === "pilot";
}

export function requireSecurePilotEnvironment(
  env: Record<string, string | undefined> = process.env,
): SecurePilotEnvironment {
  const environment = readPilotEnvironment(env);
  if (environment.mode !== "pilot") {
    throw new PilotConfigurationError([
      "this server endpoint is available only in pilot mode",
    ]);
  }
  return environment;
}
