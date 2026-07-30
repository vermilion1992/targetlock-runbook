import { NextResponse } from "next/server";

import {
  EXPECTED_PILOT_SCHEMA_MIGRATION,
  getPilotDatabaseReadiness,
} from "@/server/pilot/database";
import { readPilotEnvironment } from "@/server/pilot/environment";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const environment = readPilotEnvironment();
    const database =
      environment.mode === "demo"
        ? null
        : await getPilotDatabaseReadiness();
    const databaseReady = database?.ready ?? true;
    return NextResponse.json(
      {
        status: databaseReady ? "ready" : "unavailable",
        mode: environment.mode,
        checks: {
          configuration: "ok",
          database:
            environment.mode === "demo"
              ? "not-required"
              : database?.reachable
                ? "ok"
                : "unavailable",
          ...(environment.mode === "pilot"
            ? {
                schema:
                  database?.currentMigration ===
                  EXPECTED_PILOT_SCHEMA_MIGRATION
                    ? "ok"
                    : "migration-required",
              }
            : {}),
        },
        ...(database
          ? {
              schema: {
                expected: database.expectedMigration,
                current: database.currentMigration,
              },
            }
          : {}),
      },
      {
        status: databaseReady ? 200 : 503,
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch {
    return NextResponse.json(
      {
        status: "unavailable",
        checks: { configuration: "invalid", database: "unknown" },
      },
      {
        status: 503,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}
