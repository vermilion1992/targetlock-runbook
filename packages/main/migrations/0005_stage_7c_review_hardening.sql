ALTER TABLE pilot_work_leases
  ADD COLUMN IF NOT EXISTS offline_grace_issued_at timestamptz,
  ADD COLUMN IF NOT EXISTS offline_grace_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS completion_grace_expires_at timestamptz;

UPDATE pilot_work_leases
SET offline_grace_issued_at = COALESCE(offline_grace_issued_at, heartbeat_at),
    offline_grace_expires_at = COALESCE(
      offline_grace_expires_at,
      heartbeat_at + interval '30 minutes'
    ),
    completion_grace_expires_at = COALESCE(
      completion_grace_expires_at,
      heartbeat_at + interval '12 hours'
    )
WHERE offline_grace_issued_at IS NULL
   OR offline_grace_expires_at IS NULL
   OR completion_grace_expires_at IS NULL;

ALTER TABLE pilot_work_leases
  ALTER COLUMN offline_grace_issued_at SET DEFAULT clock_timestamp(),
  ALTER COLUMN offline_grace_issued_at SET NOT NULL,
  ALTER COLUMN offline_grace_expires_at
    SET DEFAULT (clock_timestamp() + interval '30 minutes'),
  ALTER COLUMN offline_grace_expires_at SET NOT NULL,
  ALTER COLUMN completion_grace_expires_at
    SET DEFAULT (clock_timestamp() + interval '12 hours'),
  ALTER COLUMN completion_grace_expires_at SET NOT NULL;

ALTER TABLE pilot_core_rod_events
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1
    CHECK (version > 0);

DROP INDEX IF EXISTS pilot_core_shifts_one_active_per_hole_idx;
CREATE UNIQUE INDEX pilot_core_shifts_one_active_per_hole_idx
  ON pilot_core_shifts (organisation_id, hole_id)
  WHERE lifecycle_status IN ('OPEN', 'HANDOVER_PENDING');

CREATE TABLE pilot_core_completion_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES pilot_organisations(id) ON DELETE CASCADE,
  hole_id uuid NOT NULL,
  local_id text NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  lifecycle_status text NOT NULL,
  client_created_at timestamptz,
  client_updated_at timestamptz NOT NULL,
  applied_at timestamptz NOT NULL,
  actor_user_id uuid NOT NULL,
  actor_device_id uuid NOT NULL,
  actor_name_snapshot text,
  authoritative_state jsonb NOT NULL CHECK (jsonb_typeof(authoritative_state) = 'object'),
  FOREIGN KEY (organisation_id, hole_id)
    REFERENCES pilot_holes(organisation_id, id) ON DELETE CASCADE,
  FOREIGN KEY (organisation_id, actor_user_id)
    REFERENCES pilot_memberships(organisation_id, user_id) ON DELETE RESTRICT,
  FOREIGN KEY (organisation_id, actor_device_id)
    REFERENCES pilot_devices(organisation_id, id) ON DELETE RESTRICT,
  UNIQUE (organisation_id, hole_id, local_id),
  UNIQUE (organisation_id, id)
);

CREATE TABLE pilot_core_completion_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES pilot_organisations(id) ON DELETE CASCADE,
  hole_id uuid NOT NULL,
  local_id text NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  lifecycle_status text NOT NULL,
  client_created_at timestamptz,
  client_updated_at timestamptz NOT NULL,
  applied_at timestamptz NOT NULL,
  actor_user_id uuid NOT NULL,
  actor_device_id uuid NOT NULL,
  actor_name_snapshot text NOT NULL,
  authoritative_state jsonb NOT NULL CHECK (jsonb_typeof(authoritative_state) = 'object'),
  FOREIGN KEY (organisation_id, hole_id)
    REFERENCES pilot_holes(organisation_id, id) ON DELETE CASCADE,
  FOREIGN KEY (organisation_id, actor_user_id)
    REFERENCES pilot_memberships(organisation_id, user_id) ON DELETE RESTRICT,
  FOREIGN KEY (organisation_id, actor_device_id)
    REFERENCES pilot_devices(organisation_id, id) ON DELETE RESTRICT,
  UNIQUE (organisation_id, hole_id, local_id),
  UNIQUE (organisation_id, id)
);

CREATE TABLE pilot_core_reopen_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES pilot_organisations(id) ON DELETE CASCADE,
  hole_id uuid NOT NULL,
  completion_record_id uuid NOT NULL,
  local_id text NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  lifecycle_status text NOT NULL,
  client_created_at timestamptz,
  client_updated_at timestamptz NOT NULL,
  applied_at timestamptz NOT NULL,
  actor_user_id uuid NOT NULL,
  actor_device_id uuid NOT NULL,
  actor_name_snapshot text NOT NULL,
  authoritative_state jsonb NOT NULL CHECK (jsonb_typeof(authoritative_state) = 'object'),
  FOREIGN KEY (organisation_id, hole_id)
    REFERENCES pilot_holes(organisation_id, id) ON DELETE CASCADE,
  FOREIGN KEY (organisation_id, completion_record_id)
    REFERENCES pilot_core_completion_records(organisation_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (organisation_id, actor_user_id)
    REFERENCES pilot_memberships(organisation_id, user_id) ON DELETE RESTRICT,
  FOREIGN KEY (organisation_id, actor_device_id)
    REFERENCES pilot_devices(organisation_id, id) ON DELETE RESTRICT,
  UNIQUE (organisation_id, hole_id, local_id),
  UNIQUE (organisation_id, id)
);

CREATE INDEX pilot_core_completion_reviews_snapshot_idx
  ON pilot_core_completion_reviews (organisation_id, hole_id, client_updated_at, id);
CREATE INDEX pilot_core_completion_records_snapshot_idx
  ON pilot_core_completion_records (organisation_id, hole_id, client_updated_at, id);
CREATE INDEX pilot_core_reopen_records_snapshot_idx
  ON pilot_core_reopen_records (organisation_id, hole_id, client_updated_at, id);

CREATE TABLE pilot_core_restore_attempts (
  organisation_id uuid NOT NULL REFERENCES pilot_organisations(id) ON DELETE CASCADE,
  restore_id uuid NOT NULL,
  device_id uuid NOT NULL,
  actor_user_id uuid NOT NULL,
  status text NOT NULL CHECK (status IN ('PREPARED', 'COMMITTED')),
  reason text NOT NULL,
  hole_refs text[] NOT NULL,
  snapshot_cursor bigint NOT NULL,
  dry_run_record_count integer NOT NULL CHECK (dry_run_record_count >= 0),
  prepared_at timestamptz NOT NULL,
  committed_at timestamptz,
  PRIMARY KEY (organisation_id, restore_id),
  FOREIGN KEY (organisation_id, device_id)
    REFERENCES pilot_devices(organisation_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (organisation_id, actor_user_id)
    REFERENCES pilot_memberships(organisation_id, user_id) ON DELETE RESTRICT
);

COMMENT ON TABLE pilot_core_restore_attempts IS
  'Durable two-phase evidence for device restores. PREPARED is written before local replacement and COMMITTED is idempotently recorded afterwards.';
