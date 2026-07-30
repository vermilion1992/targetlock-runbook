import type { PoolClient } from "pg";

import { firstRow } from "./database";
import type { RecordOperationInput } from "./repository";
import {
  coreJsonObjectSchema,
  type CoreChangesPage,
  type CoreConflictDetails,
  type CoreDirectorySnapshot,
  type CoreEntityKind,
  type CoreHoleSnapshot,
  type CoreMaterializationOutcome,
  type CoreProjection,
} from "./core-types";

interface ReferenceIds {
  readonly projectId: string | null;
  readonly rigId: string | null;
  readonly holeId: string | null;
}

async function referenceIds(
  client: PoolClient,
  organisationId: string,
  projection: CoreProjection,
): Promise<ReferenceIds> {
  const project = projection.projectRef
    ? firstRow(
        (
          await client.query<{ id: string }>(
            `SELECT id FROM pilot_projects
             WHERE organisation_id = $1 AND external_ref = $2`,
            [organisationId, projection.projectRef],
          )
        ).rows,
      )
    : null;
  const rig = projection.rigRef
    ? firstRow(
        (
          await client.query<{ id: string }>(
            `SELECT id FROM pilot_rigs
             WHERE organisation_id = $1 AND external_ref = $2`,
            [organisationId, projection.rigRef],
          )
        ).rows,
      )
    : null;
  const hole = projection.holeRef
    ? firstRow(
        (
          await client.query<{ id: string }>(
            `SELECT id FROM pilot_holes
             WHERE organisation_id = $1 AND external_ref = $2`,
            [organisationId, projection.holeRef],
          )
        ).rows,
      )
    : null;
  return {
    projectId: project?.id ?? null,
    rigId: rig?.id ?? null,
    holeId: hole?.id ?? null,
  };
}

function stateJson(projection: CoreProjection): string {
  return JSON.stringify(projection.state);
}

async function existingProjectionState(
  client: PoolClient,
  organisationId: string,
  projection: CoreProjection,
  references: ReferenceIds,
): Promise<{ readonly version: number; readonly same: boolean } | null> {
  const values = [organisationId, projection.localId, stateJson(projection)];
  const base = `SELECT version, authoritative_state = $3::jsonb AS same`;
  let query: string;
  switch (projection.kind) {
    case "PROJECT":
      query = `${base} FROM pilot_projects
        WHERE organisation_id = $1 AND external_ref = $2
          AND authoritative_state IS NOT NULL`;
      break;
    case "RIG":
      query = `${base} FROM pilot_rigs
        WHERE organisation_id = $1 AND external_ref = $2
          AND authoritative_state IS NOT NULL`;
      break;
    case "HOLE":
      query = `${base} FROM pilot_holes
        WHERE organisation_id = $1 AND external_ref = $2
          AND authoritative_state IS NOT NULL`;
      break;
    case "HOLE_CONFIGURATION":
      query = `${base} FROM pilot_core_hole_configurations
        WHERE organisation_id = $1 AND local_id = $2
          AND hole_id = '${references.holeId}'::uuid
          AND configuration_kind = '${projection.configurationKind}'`;
      break;
    case "BHA_SETUP":
      query = `${base} FROM pilot_core_bha_setups
        WHERE organisation_id = $1 AND local_id = $2
          AND hole_id = '${references.holeId}'::uuid`;
      break;
    case "SHIFT":
      query = `${base} FROM pilot_core_shifts
        WHERE organisation_id = $1 AND local_id = $2
          AND hole_id = '${references.holeId}'::uuid`;
      break;
    case "RUN":
      query = `${base} FROM pilot_core_runs
        WHERE organisation_id = $1 AND local_id = $2
          AND hole_id = '${references.holeId}'::uuid`;
      break;
    case "ROD_EVENT":
      query = `SELECT version, authoritative_state = $3::jsonb AS same
        FROM pilot_core_rod_events
        WHERE organisation_id = $1 AND local_id = $2
          AND hole_id = '${references.holeId}'::uuid`;
      break;
    case "RUN_CORRECTION":
      query = `SELECT version, authoritative_state = $3::jsonb AS same
        FROM pilot_core_run_corrections
        WHERE organisation_id = $1 AND local_id = $2
          AND hole_id = '${references.holeId}'::uuid`;
      break;
    case "COMPLETION_REVIEW":
      query = `${base} FROM pilot_core_completion_reviews
        WHERE organisation_id = $1 AND local_id = $2
          AND hole_id = '${references.holeId}'::uuid`;
      break;
    case "COMPLETION_RECORD":
      query = `${base} FROM pilot_core_completion_records
        WHERE organisation_id = $1 AND local_id = $2
          AND hole_id = '${references.holeId}'::uuid`;
      break;
    case "REOPEN_RECORD":
      query = `${base} FROM pilot_core_reopen_records
        WHERE organisation_id = $1 AND local_id = $2
          AND hole_id = '${references.holeId}'::uuid`;
      break;
    case "HANDOVER":
      query = `${base} FROM pilot_core_handovers
        WHERE organisation_id = $1 AND local_id = $2
          AND hole_id = '${references.holeId}'::uuid`;
      break;
  }
  const result = await client.query<{ version: number; same: boolean }>(
    query,
    values,
  );
  return firstRow(result.rows);
}

async function validateProjectionSet(
  client: PoolClient,
  input: RecordOperationInput,
): Promise<
  | {
      readonly valid: true;
      readonly references: ReadonlyMap<CoreProjection, ReferenceIds>;
    }
  | { readonly valid: false; readonly reasonCode: string }
> {
  const plan = input.corePlan!;
  const references = new Map<CoreProjection, ReferenceIds>();
  for (const projection of plan.projections) {
    const ids = await referenceIds(
      client,
      input.envelope.organisationId,
      projection,
    );
    references.set(projection, ids);
    if (
      (projection.projectRef !== null && ids.projectId === null) ||
      (projection.rigRef !== null && ids.rigId === null) ||
      (projection.holeRef !== null && ids.holeId === null)
    ) {
      return { valid: false, reasonCode: "CORE_REFERENCE_NOT_FOUND" };
    }
    if (ids.holeId !== null) {
      const relationalContext = await client.query(
        `SELECT 1
         FROM pilot_holes h
         JOIN pilot_rigs r
           ON r.organisation_id = h.organisation_id
          AND r.id = h.rig_id
          AND r.project_id = h.project_id
         WHERE h.organisation_id = $1 AND h.id = $2
           AND ($3::uuid IS NULL OR h.project_id = $3)
           AND ($4::uuid IS NULL OR h.rig_id = $4)
         LIMIT 1`,
        [
          input.envelope.organisationId,
          ids.holeId,
          ids.projectId,
          ids.rigId,
        ],
      );
      if (!relationalContext.rowCount) {
        return { valid: false, reasonCode: "REFERENCE_CONTEXT_MISMATCH" };
      }
    } else if (ids.rigId !== null && ids.projectId !== null) {
      const relationalContext = await client.query(
        `SELECT 1 FROM pilot_rigs
         WHERE organisation_id = $1 AND id = $2 AND project_id = $3
         LIMIT 1`,
        [input.envelope.organisationId, ids.rigId, ids.projectId],
      );
      if (!relationalContext.rowCount) {
        return { valid: false, reasonCode: "REFERENCE_CONTEXT_MISMATCH" };
      }
    }
    const existing = await existingProjectionState(
      client,
      input.envelope.organisationId,
      projection,
      ids,
    );
    if (
      existing !== null &&
      (existing.version > projection.version ||
        (existing.version === projection.version && !existing.same))
    ) {
      return { valid: false, reasonCode: "CORE_ENTITY_VERSION_CONFLICT" };
    }

    if (projection.kind === "PROJECT") {
      const state = projection.state as { code?: unknown };
      const duplicate = await client.query(
        `SELECT 1 FROM pilot_projects
         WHERE organisation_id = $1 AND lower(code) = lower($2)
           AND external_ref <> $3 AND status <> 'archived'
         LIMIT 1`,
        [
          input.envelope.organisationId,
          String(state.code ?? ""),
          projection.localId,
        ],
      );
      if (duplicate.rowCount) {
        return { valid: false, reasonCode: "DUPLICATE_PROJECT_CODE" };
      }
    }
    if (projection.kind === "RIG") {
      const state = projection.state as { serialNumber?: unknown };
      const duplicate = await client.query(
        `SELECT 1 FROM pilot_rigs
         WHERE organisation_id = $1 AND lower(serial_number) = lower($2)
           AND external_ref <> $3 AND status <> 'retired'
         LIMIT 1`,
        [
          input.envelope.organisationId,
          String(state.serialNumber ?? ""),
          projection.localId,
        ],
      );
      if (duplicate.rowCount) {
        return { valid: false, reasonCode: "DUPLICATE_RIG_SERIAL" };
      }
    }
    if (projection.kind === "SHIFT" && ids.holeId) {
      const state = projection.state as {
        shiftDate?: unknown;
        shiftType?: unknown;
        status?: unknown;
      };
      if (state.status !== "CLOSED") {
        const duplicate = await client.query(
          `SELECT 1 FROM pilot_core_shifts
           WHERE organisation_id = $1 AND hole_id = $2
             AND local_id <> $3
             AND lifecycle_status IN ('OPEN', 'HANDOVER_PENDING')
           LIMIT 1`,
          [
            input.envelope.organisationId,
            ids.holeId,
            projection.localId,
          ],
        );
        if (duplicate.rowCount) {
          return { valid: false, reasonCode: "ACTIVE_SHIFT_EXISTS" };
        }
      }
    }
    if (projection.kind === "RUN" && ids.holeId) {
      const state = projection.state as {
        runNumber?: unknown;
        status?: unknown;
        startedShiftId?: unknown;
        completedShiftId?: unknown;
      };
      const shiftRefs = [state.startedShiftId, state.completedShiftId].filter(
        (value): value is string => typeof value === "string" && value.length > 0,
      );
      for (const shiftRef of shiftRefs) {
        const shift = await client.query(
          `SELECT 1 FROM pilot_core_shifts
           WHERE organisation_id = $1 AND hole_id = $2 AND local_id = $3
           LIMIT 1`,
          [input.envelope.organisationId, ids.holeId, shiftRef],
        );
        if (!shift.rowCount) {
          return { valid: false, reasonCode: "RUN_SHIFT_CONTEXT_MISMATCH" };
        }
      }
      if (state.status !== "void") {
        const duplicate = await client.query(
          `SELECT 1 FROM pilot_core_runs
           WHERE organisation_id = $1 AND hole_id = $2
             AND run_number = $3 AND local_id <> $4
             AND lifecycle_status <> 'void'
           LIMIT 1`,
          [
            input.envelope.organisationId,
            ids.holeId,
            state.runNumber,
            projection.localId,
          ],
        );
        if (duplicate.rowCount) {
          return { valid: false, reasonCode: "DUPLICATE_RUN_NUMBER" };
        }
      }
    }
  }
  return { valid: true, references };
}

async function applyProjection(
  client: PoolClient,
  input: RecordOperationInput,
  projection: CoreProjection,
  references: ReferenceIds,
): Promise<void> {
  const organisationId = input.envelope.organisationId;
  const actorUserId =
    projection.sourceActorUserId ?? input.envelope.operatorId;
  const actorDeviceId = input.envelope.deviceId;
  const appliedAt = input.receivedAt;
  const state = projection.state as Record<string, unknown>;
  const json = stateJson(projection);

  if (projection.kind === "PROJECT") {
    await client.query(
      `UPDATE pilot_projects
       SET display_name = $3, code = $4, client_name = $5, location = $6,
           version = $7, status = $8, client_created_at = $9,
           client_updated_at = $10, applied_at = $11, actor_user_id = $12,
           actor_device_id = $13, authoritative_state = $14::jsonb,
           updated_at = $11
       WHERE organisation_id = $1 AND external_ref = $2`,
      [
        organisationId,
        projection.localId,
        state.name,
        state.code,
        state.clientName,
        state.location,
        projection.version,
        projection.lifecycleStatus,
        projection.clientCreatedAt,
        projection.clientUpdatedAt,
        appliedAt,
        actorUserId,
        actorDeviceId,
        json,
      ],
    );
    return;
  }
  if (projection.kind === "RIG") {
    await client.query(
      `UPDATE pilot_rigs
       SET project_id = $3, display_name = $4, serial_number = $5, model = $6,
           version = $7, status = $8, client_created_at = $9,
           client_updated_at = $10, applied_at = $11, actor_user_id = $12,
           actor_device_id = $13, authoritative_state = $14::jsonb,
           updated_at = $11
       WHERE organisation_id = $1 AND external_ref = $2`,
      [
        organisationId,
        projection.localId,
        references.projectId,
        state.name,
        state.serialNumber,
        state.model,
        projection.version,
        projection.lifecycleStatus,
        projection.clientCreatedAt,
        projection.clientUpdatedAt,
        appliedAt,
        actorUserId,
        actorDeviceId,
        json,
      ],
    );
    return;
  }
  if (projection.kind === "HOLE") {
    await client.query(
      `UPDATE pilot_holes
       SET project_id = $3, rig_id = $4, display_name = $5, version = $6,
           status = $7, hole_size = $8, planned_depth_dm = $9,
           current_depth_dm = $10, collar_easting = $11,
           collar_northing = $12, collar_elevation = $13,
           client_created_at = $14, client_updated_at = $15, applied_at = $16,
           actor_user_id = $17, actor_device_id = $18,
           authoritative_state = $19::jsonb, updated_at = $16
       WHERE organisation_id = $1 AND external_ref = $2`,
      [
        organisationId,
        projection.localId,
        references.projectId,
        references.rigId,
        state.name,
        projection.version,
        projection.lifecycleStatus,
        state.holeSize,
        state.plannedDepth,
        state.currentDepth,
        state.collarEasting ?? null,
        state.collarNorthing ?? null,
        state.collarElevation ?? null,
        projection.clientCreatedAt,
        projection.clientUpdatedAt,
        appliedAt,
        actorUserId,
        actorDeviceId,
        json,
      ],
    );
    return;
  }
  if (projection.kind === "HOLE_CONFIGURATION") {
    await client.query(
      `INSERT INTO pilot_core_hole_configurations (
         organisation_id, hole_id, configuration_kind, local_id, version,
         lifecycle_status, client_created_at, client_updated_at, applied_at,
         actor_user_id, actor_device_id, authoritative_state
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb)
       ON CONFLICT (organisation_id, hole_id, configuration_kind, local_id)
       DO UPDATE SET version = EXCLUDED.version,
         lifecycle_status = EXCLUDED.lifecycle_status,
         client_updated_at = EXCLUDED.client_updated_at,
         applied_at = EXCLUDED.applied_at,
         actor_user_id = EXCLUDED.actor_user_id,
         actor_device_id = EXCLUDED.actor_device_id,
         authoritative_state = EXCLUDED.authoritative_state`,
      [
        organisationId,
        references.holeId,
        projection.configurationKind,
        projection.localId,
        projection.version,
        projection.lifecycleStatus,
        projection.clientCreatedAt,
        projection.clientUpdatedAt,
        appliedAt,
        actorUserId,
        actorDeviceId,
        json,
      ],
    );
    return;
  }
  if (projection.kind === "BHA_SETUP") {
    await client.query(
      `INSERT INTO pilot_core_bha_setups (
         organisation_id, hole_id, local_id, version, effective_at,
         effective_depth_dm, bottom_hole_assembly_length_dm,
         constant_stick_up_dm, base_rod_string_length_dm, client_updated_at,
         applied_at, actor_user_id, actor_device_id, actor_name_snapshot,
         authoritative_state
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15::jsonb)
       ON CONFLICT (organisation_id, hole_id, local_id)
       DO UPDATE SET version = EXCLUDED.version,
         client_updated_at = EXCLUDED.client_updated_at,
         applied_at = EXCLUDED.applied_at,
         actor_user_id = EXCLUDED.actor_user_id,
         actor_device_id = EXCLUDED.actor_device_id,
         actor_name_snapshot = EXCLUDED.actor_name_snapshot,
         authoritative_state = EXCLUDED.authoritative_state`,
      [
        organisationId,
        references.holeId,
        projection.localId,
        projection.version,
        state.effectiveAt,
        state.effectiveDepthDm,
        state.bottomHoleAssemblyLengthDm,
        state.constantStickUpDm,
        state.baseRodStringLengthDm,
        projection.clientUpdatedAt,
        appliedAt,
        actorUserId,
        actorDeviceId,
        projection.actorNameSnapshot,
        json,
      ],
    );
    return;
  }
  if (projection.kind === "SHIFT") {
    await client.query(
      `INSERT INTO pilot_core_shifts (
         organisation_id, hole_id, rig_id, local_id, version, shift_type,
         shift_date, lifecycle_status, started_at, closed_at,
         starting_depth_dm, ending_depth_dm, primary_driller_id,
         primary_driller_name_snapshot, client_updated_at, applied_at,
         actor_user_id, actor_device_id, authoritative_state
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19::jsonb)
       ON CONFLICT (organisation_id, hole_id, local_id)
       DO UPDATE SET version = EXCLUDED.version,
         lifecycle_status = EXCLUDED.lifecycle_status,
         closed_at = EXCLUDED.closed_at,
         ending_depth_dm = EXCLUDED.ending_depth_dm,
         client_updated_at = EXCLUDED.client_updated_at,
         applied_at = EXCLUDED.applied_at,
         actor_user_id = EXCLUDED.actor_user_id,
         actor_device_id = EXCLUDED.actor_device_id,
         authoritative_state = EXCLUDED.authoritative_state`,
      [
        organisationId,
        references.holeId,
        references.rigId,
        projection.localId,
        projection.version,
        state.shiftType,
        state.shiftDate,
        projection.lifecycleStatus,
        state.startedAt,
        state.closedAt ?? null,
        state.startingDepthDm,
        state.endingDepthDm ?? null,
        state.primaryDrillerId,
        state.primaryDrillerNameSnapshot,
        projection.clientUpdatedAt,
        appliedAt,
        actorUserId,
        actorDeviceId,
        json,
      ],
    );
    return;
  }
  if (projection.kind === "RUN") {
    await client.query(
      `INSERT INTO pilot_core_runs (
         organisation_id, hole_id, local_id, started_shift_local_id,
         completed_shift_local_id, run_number, version, lifecycle_status,
         started_at, completed_at, hole_depth_dm, drilled_length_dm,
         recovered_length_dm, client_updated_at, applied_at, actor_user_id,
         actor_device_id, actor_name_snapshot, authoritative_state
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19::jsonb)
       ON CONFLICT (organisation_id, hole_id, local_id)
       DO UPDATE SET run_number = EXCLUDED.run_number,
         version = EXCLUDED.version,
         lifecycle_status = EXCLUDED.lifecycle_status,
         hole_depth_dm = EXCLUDED.hole_depth_dm,
         drilled_length_dm = EXCLUDED.drilled_length_dm,
         recovered_length_dm = EXCLUDED.recovered_length_dm,
         client_updated_at = EXCLUDED.client_updated_at,
         applied_at = EXCLUDED.applied_at,
         actor_user_id = pilot_core_runs.actor_user_id,
         actor_device_id = pilot_core_runs.actor_device_id,
         actor_name_snapshot = pilot_core_runs.actor_name_snapshot,
         authoritative_state = EXCLUDED.authoritative_state`,
      [
        organisationId,
        references.holeId,
        projection.localId,
        state.startedShiftId,
        state.completedShiftId,
        state.runNumber,
        projection.version,
        projection.lifecycleStatus,
        state.startedAt,
        state.completedAt,
        state.holeDepthDm,
        state.drilledLengthDm,
        state.recoveredLengthDm,
        projection.clientUpdatedAt,
        appliedAt,
        actorUserId,
        actorDeviceId,
        projection.actorNameSnapshot,
        json,
      ],
    );
    return;
  }
  if (projection.kind === "ROD_EVENT") {
    const runLocalId = String(state.runId);
    const run = firstRow(
      (
        await client.query<{ id: string }>(
          `SELECT id FROM pilot_core_runs
           WHERE organisation_id = $1 AND hole_id = $2 AND local_id = $3`,
          [organisationId, references.holeId, runLocalId],
        )
      ).rows,
    );
    if (!run) throw new Error("A rod event has no authoritative run.");
    await client.query(
      `INSERT INTO pilot_core_rod_events (
         organisation_id, hole_id, run_id, local_id, sequence, action,
         rod_length_dm, affected_rod_number, rod_number_after_event,
         occurred_at, applied_at, actor_user_id, actor_device_id, version,
         authoritative_state
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15::jsonb)
       ON CONFLICT (organisation_id, hole_id, local_id)
       DO UPDATE SET sequence = EXCLUDED.sequence,
         action = EXCLUDED.action,
         rod_length_dm = EXCLUDED.rod_length_dm,
         affected_rod_number = EXCLUDED.affected_rod_number,
         rod_number_after_event = EXCLUDED.rod_number_after_event,
         version = EXCLUDED.version,
         applied_at = EXCLUDED.applied_at,
         actor_user_id = pilot_core_rod_events.actor_user_id,
         actor_device_id = pilot_core_rod_events.actor_device_id,
         authoritative_state = EXCLUDED.authoritative_state`,
      [
        organisationId,
        references.holeId,
        run.id,
        projection.localId,
        state.sequence,
        state.action,
        state.rodLengthDm,
        state.affectedRodNumber,
        state.rodNumberAfterEvent,
        state.occurredAt,
        appliedAt,
        actorUserId,
        actorDeviceId,
        projection.version,
        json,
      ],
    );
    return;
  }
  if (
    projection.kind === "COMPLETION_REVIEW" ||
    projection.kind === "COMPLETION_RECORD"
  ) {
    const table =
      projection.kind === "COMPLETION_REVIEW"
        ? "pilot_core_completion_reviews"
        : "pilot_core_completion_records";
    await client.query(
      `INSERT INTO ${table} (
         organisation_id, hole_id, local_id, version, lifecycle_status,
         client_created_at, client_updated_at, applied_at, actor_user_id,
         actor_device_id, actor_name_snapshot, authoritative_state
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb)
       ON CONFLICT (organisation_id, hole_id, local_id)
       DO UPDATE SET version = EXCLUDED.version,
         lifecycle_status = EXCLUDED.lifecycle_status,
         client_updated_at = EXCLUDED.client_updated_at,
         applied_at = EXCLUDED.applied_at,
         actor_user_id = EXCLUDED.actor_user_id,
         actor_device_id = EXCLUDED.actor_device_id,
         actor_name_snapshot = EXCLUDED.actor_name_snapshot,
         authoritative_state = EXCLUDED.authoritative_state`,
      [
        organisationId,
        references.holeId,
        projection.localId,
        projection.version,
        projection.lifecycleStatus,
        projection.clientCreatedAt,
        projection.clientUpdatedAt,
        appliedAt,
        actorUserId,
        actorDeviceId,
        projection.actorNameSnapshot,
        json,
      ],
    );
    return;
  }
  if (projection.kind === "REOPEN_RECORD") {
    const completion = firstRow(
      (
        await client.query<{ id: string }>(
          `SELECT id FROM pilot_core_completion_records
           WHERE organisation_id = $1 AND hole_id = $2 AND local_id = $3`,
          [
            organisationId,
            references.holeId,
            state.completionRecordId,
          ],
        )
      ).rows,
    );
    if (!completion) {
      throw new Error("A reopen record has no authoritative completion.");
    }
    await client.query(
      `INSERT INTO pilot_core_reopen_records (
         organisation_id, hole_id, completion_record_id, local_id, version,
         lifecycle_status, client_created_at, client_updated_at, applied_at,
         actor_user_id, actor_device_id, actor_name_snapshot,
         authoritative_state
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb)
       ON CONFLICT (organisation_id, hole_id, local_id)
       DO UPDATE SET version = EXCLUDED.version,
         lifecycle_status = EXCLUDED.lifecycle_status,
         client_updated_at = EXCLUDED.client_updated_at,
         applied_at = EXCLUDED.applied_at,
         actor_user_id = EXCLUDED.actor_user_id,
         actor_device_id = EXCLUDED.actor_device_id,
         actor_name_snapshot = EXCLUDED.actor_name_snapshot,
         authoritative_state = EXCLUDED.authoritative_state`,
      [
        organisationId,
        references.holeId,
        completion.id,
        projection.localId,
        projection.version,
        projection.lifecycleStatus,
        projection.clientCreatedAt,
        projection.clientUpdatedAt,
        appliedAt,
        actorUserId,
        actorDeviceId,
        projection.actorNameSnapshot,
        json,
      ],
    );
    return;
  }
  if (projection.kind === "RUN_CORRECTION") {
    const run = firstRow(
      (
        await client.query<{ id: string }>(
          `SELECT id FROM pilot_core_runs
           WHERE organisation_id = $1 AND hole_id = $2 AND local_id = $3`,
          [organisationId, references.holeId, state.runId],
        )
      ).rows,
    );
    if (!run) throw new Error("A correction has no authoritative run.");
    await client.query(
      `INSERT INTO pilot_core_run_corrections (
         organisation_id, hole_id, run_id, local_id, version, operation_id,
         correction_type, reason, corrected_at, client_updated_at, applied_at,
         actor_user_id, actor_device_id, actor_name_snapshot,
         authoritative_state
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15::jsonb)
       ON CONFLICT (organisation_id, hole_id, local_id)
       DO UPDATE SET version = EXCLUDED.version,
         client_updated_at = EXCLUDED.client_updated_at,
         applied_at = EXCLUDED.applied_at,
         actor_user_id = EXCLUDED.actor_user_id,
         actor_device_id = EXCLUDED.actor_device_id,
         actor_name_snapshot = EXCLUDED.actor_name_snapshot,
         authoritative_state = EXCLUDED.authoritative_state`,
      [
        organisationId,
        references.holeId,
        run.id,
        projection.localId,
        projection.version,
        input.envelope.operationId,
        state.correctionType,
        state.reason,
        state.correctedAt,
        projection.clientUpdatedAt,
        appliedAt,
        actorUserId,
        actorDeviceId,
        projection.actorNameSnapshot,
        json,
      ],
    );
    return;
  }
  if (projection.kind === "HANDOVER") {
    const outgoing = firstRow(
      (
        await client.query<{ id: string }>(
          `SELECT id FROM pilot_core_shifts
           WHERE organisation_id = $1 AND hole_id = $2 AND local_id = $3`,
          [organisationId, references.holeId, state.outgoingShiftId],
        )
      ).rows,
    );
    const incoming =
      state.incomingShiftId === null
        ? null
        : firstRow(
            (
              await client.query<{ id: string }>(
                `SELECT id FROM pilot_core_shifts
                 WHERE organisation_id = $1 AND hole_id = $2 AND local_id = $3`,
                [organisationId, references.holeId, state.incomingShiftId],
              )
            ).rows,
          );
    if (!outgoing) throw new Error("A handover has no outgoing shift.");
    await client.query(
      `INSERT INTO pilot_core_handovers (
         organisation_id, hole_id, local_id, version, outgoing_shift_id,
         incoming_shift_id, lifecycle_status, accepted_at,
         client_updated_at, applied_at, actor_user_id, actor_device_id,
         authoritative_state
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb)
       ON CONFLICT (organisation_id, hole_id, local_id)
       DO UPDATE SET version = EXCLUDED.version,
         incoming_shift_id = EXCLUDED.incoming_shift_id,
         lifecycle_status = EXCLUDED.lifecycle_status,
         accepted_at = EXCLUDED.accepted_at,
         client_updated_at = EXCLUDED.client_updated_at,
         applied_at = EXCLUDED.applied_at,
         actor_user_id = EXCLUDED.actor_user_id,
         actor_device_id = EXCLUDED.actor_device_id,
         authoritative_state = EXCLUDED.authoritative_state`,
      [
        organisationId,
        references.holeId,
        projection.localId,
        projection.version,
        outgoing.id,
        incoming?.id ?? null,
        projection.lifecycleStatus,
        state.acceptedAt ?? null,
        projection.clientUpdatedAt,
        appliedAt,
        actorUserId,
        actorDeviceId,
        json,
      ],
    );
  }
}

export async function applyCoreMaterialization(
  client: PoolClient,
  input: RecordOperationInput,
): Promise<CoreMaterializationOutcome> {
  const plan = input.corePlan;
  if (plan === null) {
    return {
      status: "MATERIALIZED",
      reasonCode: null,
      aggregateVersion: null,
      cursor: null,
    };
  }
  await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
    `${input.envelope.organisationId}:core:${plan.aggregateType}:${plan.aggregateRef}`,
  ]);
  const validation = await validateProjectionSet(client, input);
  if (!validation.valid) {
    return {
      status: "CONFLICT",
      reasonCode: validation.reasonCode,
      aggregateVersion: null,
      cursor: null,
    };
  }
  await client.query("SAVEPOINT core_projection_apply");
  try {
    for (const projection of plan.projections) {
      await applyProjection(
        client,
        input,
        projection,
        validation.references.get(projection)!,
      );
    }
    await client.query("RELEASE SAVEPOINT core_projection_apply");
  } catch (error) {
    await client.query("ROLLBACK TO SAVEPOINT core_projection_apply");
    await client.query("RELEASE SAVEPOINT core_projection_apply");
    const databaseError = error as { readonly code?: string; readonly constraint?: string };
    if (
      databaseError.code === "23505" &&
      databaseError.constraint === "pilot_core_shifts_one_active_per_hole_idx"
    ) {
      return {
        status: "CONFLICT",
        reasonCode: "ACTIVE_SHIFT_EXISTS",
        aggregateVersion: null,
        cursor: null,
      };
    }
    throw error;
  }
  if (plan.aggregateType === "HOLE") {
    await client.query(
      `UPDATE pilot_holes h
       SET current_depth_dm = latest.hole_depth_dm,
           authoritative_state = jsonb_set(
             h.authoritative_state,
             '{currentDepth}',
             to_jsonb(latest.hole_depth_dm),
             true
           ),
           updated_at = $3
       FROM pilot_core_runs latest
       WHERE h.organisation_id = $1
         AND h.external_ref = $2
         AND h.authoritative_state IS NOT NULL
         AND latest.id = (
           SELECT r.id
           FROM pilot_core_runs r
           WHERE r.organisation_id = h.organisation_id
             AND r.hole_id = h.id
             AND r.lifecycle_status <> 'void'
           ORDER BY r.run_number DESC, r.completed_at DESC, r.id DESC
           LIMIT 1
         )`,
      [input.envelope.organisationId, plan.aggregateRef, input.receivedAt],
    );
  }
  const head = firstRow(
    (
      await client.query<{ current_version: number }>(
        `INSERT INTO pilot_core_aggregate_heads (
           organisation_id, aggregate_type, aggregate_ref, current_version,
           last_operation_id, updated_at
         ) VALUES ($1,$2,$3,1,$4,$5)
         ON CONFLICT (organisation_id, aggregate_type, aggregate_ref)
         DO UPDATE SET current_version =
           pilot_core_aggregate_heads.current_version + 1,
           last_operation_id = EXCLUDED.last_operation_id,
           updated_at = EXCLUDED.updated_at
         RETURNING current_version`,
        [
          input.envelope.organisationId,
          plan.aggregateType,
          plan.aggregateRef,
          input.envelope.operationId,
          input.receivedAt,
        ],
      )
    ).rows,
  );
  if (!head) throw new Error("Core aggregate revision did not advance.");
  const holeId =
    plan.aggregateType === "HOLE"
      ? (
          await referenceIds(client, input.envelope.organisationId, {
            ...plan.projections[0]!,
            holeRef: plan.aggregateRef,
          })
        ).holeId
      : null;
  const entityKinds = [
    ...new Set(plan.projections.map((projection) => projection.kind)),
  ];
  const change = firstRow(
    (
      await client.query<{ cursor_id: string }>(
        `INSERT INTO pilot_core_change_feed (
           organisation_id, operation_id, aggregate_type, aggregate_ref,
           aggregate_version, hole_id, operation_type, entity_kinds,
           server_received_at, client_time, actor_user_id, actor_device_id
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::text[],$9,$10,$11,$12)
         RETURNING cursor_id::text`,
        [
          input.envelope.organisationId,
          input.envelope.operationId,
          plan.aggregateType,
          plan.aggregateRef,
          head.current_version,
          holeId,
          input.envelope.operationType,
          entityKinds,
          input.receivedAt,
          input.envelope.clientTime,
          input.envelope.operatorId,
          input.envelope.deviceId,
        ],
      )
    ).rows,
  );
  return {
    status: "MATERIALIZED",
    reasonCode: null,
    aggregateVersion: head.current_version,
    cursor: change?.cursor_id ?? null,
  };
}

function serverState(
  state: unknown,
  serverId: string,
): CoreProjection["state"] {
  return coreJsonObjectSchema.parse({
    ...coreJsonObjectSchema.parse(state),
    serverId,
    syncStatus: "synced",
  });
}

export async function readCoreDirectory(
  client: PoolClient,
  organisationId: string,
  assignment: {
    readonly projectRef: string | null;
    readonly rigRef: string | null;
    readonly includeAvailable: boolean;
  },
  generatedAt: string,
): Promise<CoreDirectorySnapshot> {
  const projects = await client.query<{
    id: string;
    external_ref: string;
    version: number;
    authoritative_state: Record<string, unknown>;
  }>(
    `SELECT DISTINCT p.id, p.external_ref, p.version, p.authoritative_state
     FROM pilot_projects p
     LEFT JOIN pilot_rigs r ON r.organisation_id = p.organisation_id
       AND r.project_id = p.id
     WHERE p.organisation_id = $1 AND p.authoritative_state IS NOT NULL
       AND ($2::boolean OR p.external_ref = $3 OR r.external_ref = $4)
     ORDER BY p.external_ref
     LIMIT 250`,
    [
      organisationId,
      assignment.includeAvailable,
      assignment.projectRef,
      assignment.rigRef,
    ],
  );
  const rigs = await client.query<{
    id: string;
    external_ref: string;
    project_ref: string;
    version: number;
    authoritative_state: Record<string, unknown>;
  }>(
    `SELECT r.id, r.external_ref, p.external_ref AS project_ref, r.version,
            r.authoritative_state
     FROM pilot_rigs r
     JOIN pilot_projects p ON p.organisation_id = r.organisation_id
       AND p.id = r.project_id
     WHERE r.organisation_id = $1 AND r.authoritative_state IS NOT NULL
       AND ($2::boolean OR p.external_ref = $3 OR r.external_ref = $4)
     ORDER BY p.external_ref, r.external_ref
     LIMIT 500`,
    [
      organisationId,
      assignment.includeAvailable,
      assignment.projectRef,
      assignment.rigRef,
    ],
  );
  const holes = await client.query<{
    id: string;
    external_ref: string;
    project_ref: string;
    rig_ref: string;
    version: number;
    authoritative_state: Record<string, unknown>;
    last_cursor: string | null;
  }>(
    `SELECT h.id, h.external_ref, p.external_ref AS project_ref,
            r.external_ref AS rig_ref, h.version, h.authoritative_state,
            max(c.cursor_id)::text AS last_cursor
     FROM pilot_holes h
     JOIN pilot_projects p ON p.organisation_id = h.organisation_id
       AND p.id = h.project_id
     JOIN pilot_rigs r ON r.organisation_id = h.organisation_id
       AND r.id = h.rig_id
     LEFT JOIN pilot_core_change_feed c ON c.organisation_id = h.organisation_id
       AND c.hole_id = h.id
     WHERE h.organisation_id = $1 AND h.authoritative_state IS NOT NULL
       AND ($2::boolean OR p.external_ref = $3 OR r.external_ref = $4)
     GROUP BY h.id, p.external_ref, r.external_ref
     ORDER BY p.external_ref, r.external_ref, h.external_ref
     LIMIT 1000`,
    [
      organisationId,
      assignment.includeAvailable,
      assignment.projectRef,
      assignment.rigRef,
    ],
  );
  const cursor = firstRow(
    (
      await client.query<{ cursor: string }>(
        `SELECT COALESCE(max(cursor_id), 0)::text AS cursor
         FROM pilot_core_change_feed WHERE organisation_id = $1`,
        [organisationId],
      )
    ).rows,
  )?.cursor ?? "0";
  return {
    schemaVersion: 1,
    generatedAt,
    organisationId,
    assignment: {
      projectRef: assignment.projectRef,
      rigRef: assignment.rigRef,
    },
    source: "AUTHORITATIVE_SERVER",
    projects: projects.rows.map((row) => ({
      serverId: row.id,
      localId: row.external_ref,
      version: Math.max(1, row.version),
      state: serverState(row.authoritative_state, row.id),
    })),
    rigs: rigs.rows.map((row) => ({
      serverId: row.id,
      localId: row.external_ref,
      projectLocalId: row.project_ref,
      version: Math.max(1, row.version),
      state: serverState(row.authoritative_state, row.id),
    })),
    holes: holes.rows.map((row) => ({
      serverId: row.id,
      localId: row.external_ref,
      projectLocalId: row.project_ref,
      rigLocalId: row.rig_ref,
      version: Math.max(1, row.version),
      state: serverState(row.authoritative_state, row.id),
      lastCursor: row.last_cursor,
    })),
    cursor,
  };
}

export async function readCoreHoleSnapshot(
  client: PoolClient,
  organisationId: string,
  holeRef: string,
  generatedAt: string,
): Promise<CoreHoleSnapshot | null> {
  const directory = await readCoreDirectory(
    client,
    organisationId,
    { projectRef: null, rigRef: null, includeAvailable: true },
    generatedAt,
  );
  const hole = directory.holes.find((candidate) => candidate.localId === holeRef);
  if (!hole) return null;
  const project = directory.projects.find(
    (candidate) => candidate.localId === hole.projectLocalId,
  );
  const rig = directory.rigs.find(
    (candidate) => candidate.localId === hole.rigLocalId,
  );
  if (!project || !rig) throw new Error("Core directory references are incomplete.");
  const head = firstRow(
    (
      await client.query<{ current_version: number }>(
        `SELECT current_version FROM pilot_core_aggregate_heads
         WHERE organisation_id = $1 AND aggregate_type = 'HOLE'
           AND aggregate_ref = $2`,
        [organisationId, holeRef],
      )
    ).rows,
  );
  if (!head) return null;
  const records = async (
    table: string,
    extra = "",
  ): Promise<
    readonly {
      id: string;
      local_id: string;
      version: number;
      authoritative_state: Record<string, unknown>;
      [key: string]: unknown;
    }[]
  > =>
    (
      await client.query(
        `SELECT r.id, r.local_id, ${extra ? `${extra},` : ""}
                COALESCE(r.version, 1) AS version, r.authoritative_state
         FROM ${table} r
         JOIN pilot_holes h ON h.organisation_id = r.organisation_id
           AND h.id = r.hole_id
         WHERE r.organisation_id = $1 AND h.external_ref = $2
         ORDER BY r.client_updated_at, r.id`,
        [organisationId, holeRef],
      )
    ).rows;
  const [
    configurations,
    bhaSetups,
    shifts,
    handovers,
    runs,
    corrections,
    completionReviews,
    completionRecords,
    reopenRecords,
  ] = await Promise.all([
      records("pilot_core_hole_configurations", "r.configuration_kind"),
      records("pilot_core_bha_setups"),
      records("pilot_core_shifts"),
      records("pilot_core_handovers"),
      records("pilot_core_runs"),
      records(
        "pilot_core_run_corrections",
        `(SELECT local_id FROM pilot_core_runs pr
          WHERE pr.organisation_id = r.organisation_id AND pr.id = r.run_id)
          AS run_local_id`,
      ),
      records("pilot_core_completion_reviews"),
      records("pilot_core_completion_records"),
      records("pilot_core_reopen_records"),
    ]);
  const rodEvents = await client.query<{
    id: string;
    local_id: string;
    run_local_id: string;
    version: number;
    authoritative_state: Record<string, unknown>;
  }>(
    `SELECT e.id, e.local_id, r.local_id AS run_local_id, e.version,
            e.authoritative_state
     FROM pilot_core_rod_events e
     JOIN pilot_holes h ON h.organisation_id = e.organisation_id
       AND h.id = e.hole_id
     JOIN pilot_core_runs r ON r.organisation_id = e.organisation_id
       AND r.id = e.run_id
     WHERE e.organisation_id = $1 AND h.external_ref = $2
     ORDER BY r.run_number, e.sequence`,
    [organisationId, holeRef],
  );
  const asRecord = (row: {
    id: string;
    local_id: string;
    version: number;
    authoritative_state: Record<string, unknown>;
  }) => ({
    serverId: row.id,
    localId: row.local_id,
    version: Math.max(1, row.version),
    state: serverState(row.authoritative_state, row.id),
  });
  return {
    schemaVersion: 1,
    generatedAt,
    organisationId,
    source: "AUTHORITATIVE_SERVER",
    cursor: hole.lastCursor ?? directory.cursor,
    aggregateRevision: head.current_version,
    project,
    rig,
    hole,
    configurations: configurations.map((row) => ({
      ...asRecord(row),
      kind: row.configuration_kind as CoreHoleSnapshot["configurations"][number]["kind"],
    })),
    bhaSetups: bhaSetups.map(asRecord),
    shifts: shifts.map(asRecord),
    handovers: handovers.map(asRecord),
    runs: runs.map(asRecord),
    rodEvents: rodEvents.rows.map((row) => ({
      serverId: row.id,
      localId: row.local_id,
      runLocalId: row.run_local_id,
      version: row.version,
      state: serverState(row.authoritative_state, row.id),
    })),
    runCorrections: corrections.map((row) => ({
      ...asRecord(row),
      runLocalId: String(row.run_local_id),
    })),
    completionReviews: completionReviews.map(asRecord),
    completionRecords: completionRecords.map(asRecord),
    reopenRecords: reopenRecords.map(asRecord),
    media: [],
  };
}

export async function readCoreChanges(
  client: PoolClient,
  organisationId: string,
  input: {
    readonly cursor: string;
    readonly limit: number;
    readonly holeRef?: string;
  },
): Promise<CoreChangesPage> {
  const result = await client.query<{
    cursor_id: string;
    operation_id: string;
    aggregate_type: "PROJECT_DIRECTORY" | "HOLE";
    aggregate_ref: string;
    aggregate_version: number;
    hole_ref: string | null;
    operation_type: string;
    entity_kinds: CoreEntityKind[];
    server_received_at: Date;
    client_time: Date;
  }>(
    `SELECT c.cursor_id::text, c.operation_id, c.aggregate_type,
            c.aggregate_ref, c.aggregate_version, h.external_ref AS hole_ref,
            c.operation_type, c.entity_kinds, c.server_received_at,
            c.client_time
     FROM pilot_core_change_feed c
     LEFT JOIN pilot_holes h ON h.organisation_id = c.organisation_id
       AND h.id = c.hole_id
     WHERE c.organisation_id = $1 AND c.cursor_id > $2
       AND ($3::text IS NULL OR h.external_ref = $3)
     ORDER BY c.cursor_id
     LIMIT $4`,
    [organisationId, input.cursor, input.holeRef ?? null, input.limit + 1],
  );
  const hasMore = result.rows.length > input.limit;
  const page = result.rows.slice(0, input.limit);
  const changes = page.map((row) => ({
    cursor: row.cursor_id,
    operationId: row.operation_id,
    aggregateType: row.aggregate_type,
    aggregateRef: row.aggregate_ref,
    aggregateVersion: row.aggregate_version,
    holeRef: row.hole_ref,
    operationType: row.operation_type,
    entityKinds: row.entity_kinds,
    serverReceivedAt: row.server_received_at.toISOString(),
    clientTime: row.client_time.toISOString(),
  }));
  return {
    schemaVersion: 1,
    changes,
    nextCursor: changes.at(-1)?.cursor ?? String(input.cursor),
    hasMore,
  };
}

export async function readCoreConflictDetails(
  client: PoolClient,
  organisationId: string,
  operationId: string,
): Promise<CoreConflictDetails | null> {
  const row = firstRow(
    (
      await client.query<{
        operation_id: string;
        operation_type: string;
        aggregate_ref: string | null;
        project_ref: string | null;
        rig_ref: string | null;
        hole_ref: string | null;
        revision_ref: string | null;
        expected_version: number | null;
        current_version: number | null;
        reason_code: string | null;
        server_received_at: Date;
        payload: Record<string, unknown>;
      }>(
        `SELECT o.operation_id, o.operation_type, o.aggregate_ref,
                o.project_ref, o.rig_ref, o.hole_ref,
                o.revision_ref, o.expected_version, r.current_version,
                o.reason_code, o.server_received_at, o.payload
         FROM pilot_domain_operations o
         LEFT JOIN pilot_domain_revisions r
           ON r.organisation_id = o.organisation_id
          AND r.revision_ref = o.revision_ref
         WHERE o.organisation_id = $1 AND o.operation_id = $2
           AND o.status = 'CONFLICT'
         LIMIT 1`,
        [organisationId, operationId],
      )
    ).rows,
  );
  return row
    ? {
        operationId: row.operation_id,
        operationType: row.operation_type,
        aggregateRef: row.aggregate_ref,
        projectRef: row.project_ref,
        rigRef: row.rig_ref,
        holeRef: row.hole_ref,
        revisionRef: row.revision_ref,
        expectedVersion: row.expected_version,
        currentVersion: row.current_version,
        reasonCode: row.reason_code,
        serverReceivedAt: row.server_received_at.toISOString(),
        pendingPayload: coreJsonObjectSchema.parse(row.payload),
      }
    : null;
}
