ALTER TABLE pilot_domain_operations
  DROP CONSTRAINT IF EXISTS pilot_domain_operations_payload_size_bounded;
ALTER TABLE pilot_domain_operations
  ADD CONSTRAINT pilot_domain_operations_payload_size_bounded
    CHECK (payload_size_bytes BETWEEN 2 AND 262144);

ALTER TABLE pilot_projects
  ADD COLUMN IF NOT EXISTS code text,
  ADD COLUMN IF NOT EXISTS client_name text,
  ADD COLUMN IF NOT EXISTS location text,
  ADD COLUMN IF NOT EXISTS client_created_at timestamptz,
  ADD COLUMN IF NOT EXISTS client_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS applied_at timestamptz,
  ADD COLUMN IF NOT EXISTS actor_user_id uuid REFERENCES pilot_users(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS actor_device_id uuid REFERENCES pilot_devices(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS authoritative_state jsonb;

ALTER TABLE pilot_rigs
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS serial_number text,
  ADD COLUMN IF NOT EXISTS model text,
  ADD COLUMN IF NOT EXISTS client_created_at timestamptz,
  ADD COLUMN IF NOT EXISTS client_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS applied_at timestamptz,
  ADD COLUMN IF NOT EXISTS actor_user_id uuid REFERENCES pilot_users(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS actor_device_id uuid REFERENCES pilot_devices(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS authoritative_state jsonb;

ALTER TABLE pilot_holes
  ADD COLUMN IF NOT EXISTS hole_size text,
  ADD COLUMN IF NOT EXISTS planned_depth_dm integer,
  ADD COLUMN IF NOT EXISTS current_depth_dm integer,
  ADD COLUMN IF NOT EXISTS collar_easting numeric,
  ADD COLUMN IF NOT EXISTS collar_northing numeric,
  ADD COLUMN IF NOT EXISTS collar_elevation numeric,
  ADD COLUMN IF NOT EXISTS client_created_at timestamptz,
  ADD COLUMN IF NOT EXISTS client_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS applied_at timestamptz,
  ADD COLUMN IF NOT EXISTS actor_user_id uuid REFERENCES pilot_users(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS actor_device_id uuid REFERENCES pilot_devices(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS authoritative_state jsonb;

ALTER TABLE pilot_projects
  ADD CONSTRAINT pilot_projects_actor_membership_fk
    FOREIGN KEY (organisation_id, actor_user_id)
    REFERENCES pilot_memberships(organisation_id, user_id) ON DELETE RESTRICT,
  ADD CONSTRAINT pilot_projects_actor_device_fk
    FOREIGN KEY (organisation_id, actor_device_id)
    REFERENCES pilot_devices(organisation_id, id) ON DELETE RESTRICT;

ALTER TABLE pilot_rigs
  ADD CONSTRAINT pilot_rigs_actor_membership_fk
    FOREIGN KEY (organisation_id, actor_user_id)
    REFERENCES pilot_memberships(organisation_id, user_id) ON DELETE RESTRICT,
  ADD CONSTRAINT pilot_rigs_actor_device_fk
    FOREIGN KEY (organisation_id, actor_device_id)
    REFERENCES pilot_devices(organisation_id, id) ON DELETE RESTRICT;

ALTER TABLE pilot_holes
  ADD CONSTRAINT pilot_holes_actor_membership_fk
    FOREIGN KEY (organisation_id, actor_user_id)
    REFERENCES pilot_memberships(organisation_id, user_id) ON DELETE RESTRICT,
  ADD CONSTRAINT pilot_holes_actor_device_fk
    FOREIGN KEY (organisation_id, actor_device_id)
    REFERENCES pilot_devices(organisation_id, id) ON DELETE RESTRICT;

CREATE UNIQUE INDEX IF NOT EXISTS pilot_projects_code_unique_idx
  ON pilot_projects (organisation_id, lower(code))
  WHERE code IS NOT NULL AND status <> 'archived';

CREATE UNIQUE INDEX IF NOT EXISTS pilot_rigs_serial_unique_idx
  ON pilot_rigs (organisation_id, lower(serial_number))
  WHERE serial_number IS NOT NULL AND status <> 'retired';

CREATE TABLE pilot_core_hole_configurations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES pilot_organisations(id) ON DELETE CASCADE,
  hole_id uuid NOT NULL,
  configuration_kind text NOT NULL CHECK (
    configuration_kind IN (
      'COORDINATE',
      'REFERENCE',
      'PLAN',
      'TARGET',
      'ACTUAL',
      'SURVEY_SELECTION'
    )
  ),
  local_id text NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  lifecycle_status text NOT NULL DEFAULT 'ACTIVE',
  client_created_at timestamptz,
  client_updated_at timestamptz NOT NULL,
  applied_at timestamptz NOT NULL,
  actor_user_id uuid NOT NULL,
  actor_device_id uuid NOT NULL,
  authoritative_state jsonb NOT NULL CHECK (jsonb_typeof(authoritative_state) = 'object'),
  FOREIGN KEY (organisation_id, hole_id)
    REFERENCES pilot_holes(organisation_id, id) ON DELETE CASCADE,
  FOREIGN KEY (organisation_id, actor_user_id)
    REFERENCES pilot_memberships(organisation_id, user_id) ON DELETE RESTRICT,
  FOREIGN KEY (organisation_id, actor_device_id)
    REFERENCES pilot_devices(organisation_id, id) ON DELETE RESTRICT,
  UNIQUE (organisation_id, hole_id, configuration_kind, local_id),
  UNIQUE (organisation_id, id)
);
CREATE INDEX pilot_core_hole_configurations_snapshot_idx
  ON pilot_core_hole_configurations (
    organisation_id,
    hole_id,
    configuration_kind,
    client_updated_at,
    id
  );

CREATE TABLE pilot_core_bha_setups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES pilot_organisations(id) ON DELETE CASCADE,
  hole_id uuid NOT NULL,
  local_id text NOT NULL,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  effective_at timestamptz NOT NULL,
  effective_depth_dm integer NOT NULL CHECK (effective_depth_dm >= 0),
  bottom_hole_assembly_length_dm integer NOT NULL CHECK (bottom_hole_assembly_length_dm > 0),
  constant_stick_up_dm integer NOT NULL CHECK (
    constant_stick_up_dm >= 0
    AND constant_stick_up_dm <= bottom_hole_assembly_length_dm
  ),
  base_rod_string_length_dm integer NOT NULL CHECK (base_rod_string_length_dm >= 0),
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
CREATE INDEX pilot_core_bha_setups_timeline_idx
  ON pilot_core_bha_setups (
    organisation_id,
    hole_id,
    effective_depth_dm,
    effective_at,
    id
  );

CREATE TABLE pilot_core_shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES pilot_organisations(id) ON DELETE CASCADE,
  hole_id uuid NOT NULL,
  rig_id uuid,
  local_id text NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  shift_type text NOT NULL CHECK (shift_type IN ('DAY', 'NIGHT')),
  shift_date date NOT NULL,
  lifecycle_status text NOT NULL CHECK (
    lifecycle_status IN ('OPEN', 'HANDOVER_PENDING', 'CLOSED')
  ),
  started_at timestamptz NOT NULL,
  closed_at timestamptz,
  starting_depth_dm integer NOT NULL CHECK (starting_depth_dm >= 0),
  ending_depth_dm integer CHECK (ending_depth_dm >= 0),
  primary_driller_id text NOT NULL,
  primary_driller_name_snapshot text NOT NULL,
  client_updated_at timestamptz NOT NULL,
  applied_at timestamptz NOT NULL,
  actor_user_id uuid NOT NULL,
  actor_device_id uuid NOT NULL,
  authoritative_state jsonb NOT NULL CHECK (jsonb_typeof(authoritative_state) = 'object'),
  FOREIGN KEY (organisation_id, hole_id)
    REFERENCES pilot_holes(organisation_id, id) ON DELETE CASCADE,
  FOREIGN KEY (organisation_id, rig_id)
    REFERENCES pilot_rigs(organisation_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (organisation_id, actor_user_id)
    REFERENCES pilot_memberships(organisation_id, user_id) ON DELETE RESTRICT,
  FOREIGN KEY (organisation_id, actor_device_id)
    REFERENCES pilot_devices(organisation_id, id) ON DELETE RESTRICT,
  UNIQUE (organisation_id, hole_id, local_id),
  UNIQUE (organisation_id, id)
);
CREATE UNIQUE INDEX pilot_core_shifts_slot_unique_idx
  ON pilot_core_shifts (organisation_id, hole_id, shift_date, shift_type)
  WHERE lifecycle_status <> 'CLOSED';
CREATE INDEX pilot_core_shifts_snapshot_idx
  ON pilot_core_shifts (organisation_id, hole_id, started_at, id);

CREATE TABLE pilot_core_handovers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES pilot_organisations(id) ON DELETE CASCADE,
  hole_id uuid NOT NULL,
  local_id text NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  outgoing_shift_id uuid NOT NULL,
  incoming_shift_id uuid,
  lifecycle_status text NOT NULL CHECK (
    lifecycle_status IN ('PENDING', 'ACCEPTED', 'FINAL_CLOSE')
  ),
  accepted_at timestamptz,
  client_updated_at timestamptz NOT NULL,
  applied_at timestamptz NOT NULL,
  actor_user_id uuid NOT NULL,
  actor_device_id uuid NOT NULL,
  authoritative_state jsonb NOT NULL CHECK (jsonb_typeof(authoritative_state) = 'object'),
  FOREIGN KEY (organisation_id, hole_id)
    REFERENCES pilot_holes(organisation_id, id) ON DELETE CASCADE,
  FOREIGN KEY (organisation_id, outgoing_shift_id)
    REFERENCES pilot_core_shifts(organisation_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (organisation_id, incoming_shift_id)
    REFERENCES pilot_core_shifts(organisation_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (organisation_id, actor_user_id)
    REFERENCES pilot_memberships(organisation_id, user_id) ON DELETE RESTRICT,
  FOREIGN KEY (organisation_id, actor_device_id)
    REFERENCES pilot_devices(organisation_id, id) ON DELETE RESTRICT,
  UNIQUE (organisation_id, hole_id, local_id),
  UNIQUE (organisation_id, id)
);
CREATE INDEX pilot_core_handovers_snapshot_idx
  ON pilot_core_handovers (organisation_id, hole_id, client_updated_at, id);

CREATE TABLE pilot_core_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES pilot_organisations(id) ON DELETE CASCADE,
  hole_id uuid NOT NULL,
  local_id text NOT NULL,
  started_shift_local_id text NOT NULL,
  completed_shift_local_id text,
  run_number integer NOT NULL CHECK (run_number > 0),
  version integer NOT NULL CHECK (version > 0),
  lifecycle_status text NOT NULL CHECK (
    lifecycle_status IN ('completed', 'corrected', 'void')
  ),
  started_at timestamptz NOT NULL,
  completed_at timestamptz NOT NULL,
  hole_depth_dm integer NOT NULL CHECK (hole_depth_dm >= 0),
  drilled_length_dm integer NOT NULL CHECK (drilled_length_dm >= 0),
  recovered_length_dm integer NOT NULL CHECK (recovered_length_dm >= 0),
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
CREATE UNIQUE INDEX pilot_core_runs_number_unique_idx
  ON pilot_core_runs (organisation_id, hole_id, run_number)
  WHERE lifecycle_status <> 'void';
CREATE INDEX pilot_core_runs_snapshot_idx
  ON pilot_core_runs (organisation_id, hole_id, run_number, id);

CREATE TABLE pilot_core_rod_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES pilot_organisations(id) ON DELETE CASCADE,
  hole_id uuid NOT NULL,
  run_id uuid NOT NULL,
  local_id text NOT NULL,
  sequence integer NOT NULL CHECK (sequence > 0),
  action text NOT NULL CHECK (action IN ('add', 'remove')),
  rod_length_dm integer NOT NULL CHECK (rod_length_dm IN (30, 60)),
  affected_rod_number integer NOT NULL CHECK (affected_rod_number > 0),
  rod_number_after_event integer NOT NULL CHECK (rod_number_after_event >= 0),
  occurred_at timestamptz NOT NULL,
  applied_at timestamptz NOT NULL,
  actor_user_id uuid NOT NULL,
  actor_device_id uuid NOT NULL,
  authoritative_state jsonb NOT NULL CHECK (jsonb_typeof(authoritative_state) = 'object'),
  FOREIGN KEY (organisation_id, hole_id)
    REFERENCES pilot_holes(organisation_id, id) ON DELETE CASCADE,
  FOREIGN KEY (organisation_id, run_id)
    REFERENCES pilot_core_runs(organisation_id, id) ON DELETE CASCADE,
  FOREIGN KEY (organisation_id, actor_user_id)
    REFERENCES pilot_memberships(organisation_id, user_id) ON DELETE RESTRICT,
  FOREIGN KEY (organisation_id, actor_device_id)
    REFERENCES pilot_devices(organisation_id, id) ON DELETE RESTRICT,
  UNIQUE (organisation_id, hole_id, local_id),
  UNIQUE (organisation_id, run_id, sequence),
  UNIQUE (organisation_id, id)
);
CREATE INDEX pilot_core_rod_events_snapshot_idx
  ON pilot_core_rod_events (organisation_id, hole_id, run_id, sequence);

CREATE TABLE pilot_core_run_corrections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES pilot_organisations(id) ON DELETE CASCADE,
  hole_id uuid NOT NULL,
  run_id uuid NOT NULL,
  local_id text NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  operation_id uuid NOT NULL,
  correction_type text NOT NULL,
  reason text NOT NULL,
  corrected_at timestamptz NOT NULL,
  client_updated_at timestamptz NOT NULL,
  applied_at timestamptz NOT NULL,
  actor_user_id uuid NOT NULL,
  actor_device_id uuid NOT NULL,
  actor_name_snapshot text NOT NULL,
  authoritative_state jsonb NOT NULL CHECK (jsonb_typeof(authoritative_state) = 'object'),
  FOREIGN KEY (organisation_id, hole_id)
    REFERENCES pilot_holes(organisation_id, id) ON DELETE CASCADE,
  FOREIGN KEY (organisation_id, run_id)
    REFERENCES pilot_core_runs(organisation_id, id) ON DELETE CASCADE,
  FOREIGN KEY (organisation_id, actor_user_id)
    REFERENCES pilot_memberships(organisation_id, user_id) ON DELETE RESTRICT,
  FOREIGN KEY (organisation_id, actor_device_id)
    REFERENCES pilot_devices(organisation_id, id) ON DELETE RESTRICT,
  UNIQUE (organisation_id, hole_id, local_id),
  UNIQUE (organisation_id, operation_id, local_id),
  UNIQUE (organisation_id, id)
);
CREATE INDEX pilot_core_run_corrections_snapshot_idx
  ON pilot_core_run_corrections (organisation_id, hole_id, corrected_at, id);

ALTER TABLE pilot_domain_operations
  ADD COLUMN IF NOT EXISTS materialization_status text NOT NULL DEFAULT 'JOURNAL_ONLY'
    CHECK (materialization_status IN ('JOURNAL_ONLY', 'MATERIALIZED', 'NOT_APPLIED')),
  ADD COLUMN IF NOT EXISTS aggregate_type text,
  ADD COLUMN IF NOT EXISTS aggregate_ref text,
  ADD COLUMN IF NOT EXISTS aggregate_version integer;

CREATE TABLE pilot_core_aggregate_heads (
  organisation_id uuid NOT NULL REFERENCES pilot_organisations(id) ON DELETE CASCADE,
  aggregate_type text NOT NULL CHECK (aggregate_type IN ('PROJECT_DIRECTORY', 'HOLE')),
  aggregate_ref text NOT NULL,
  current_version integer NOT NULL CHECK (current_version > 0),
  last_operation_id uuid NOT NULL,
  updated_at timestamptz NOT NULL,
  PRIMARY KEY (organisation_id, aggregate_type, aggregate_ref),
  FOREIGN KEY (organisation_id, last_operation_id)
    REFERENCES pilot_domain_operations(organisation_id, operation_id)
    DEFERRABLE INITIALLY DEFERRED
);

CREATE TABLE pilot_core_change_feed (
  cursor_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  organisation_id uuid NOT NULL REFERENCES pilot_organisations(id) ON DELETE CASCADE,
  operation_id uuid NOT NULL,
  aggregate_type text NOT NULL CHECK (aggregate_type IN ('PROJECT_DIRECTORY', 'HOLE')),
  aggregate_ref text NOT NULL,
  aggregate_version integer NOT NULL CHECK (aggregate_version > 0),
  hole_id uuid,
  operation_type text NOT NULL,
  entity_kinds text[] NOT NULL,
  server_received_at timestamptz NOT NULL,
  client_time timestamptz NOT NULL,
  actor_user_id uuid NOT NULL,
  actor_device_id uuid NOT NULL,
  FOREIGN KEY (organisation_id, operation_id)
    REFERENCES pilot_domain_operations(organisation_id, operation_id)
    DEFERRABLE INITIALLY DEFERRED,
  FOREIGN KEY (organisation_id, hole_id)
    REFERENCES pilot_holes(organisation_id, id) ON DELETE CASCADE,
  FOREIGN KEY (organisation_id, actor_user_id)
    REFERENCES pilot_memberships(organisation_id, user_id) ON DELETE RESTRICT,
  FOREIGN KEY (organisation_id, actor_device_id)
    REFERENCES pilot_devices(organisation_id, id) ON DELETE RESTRICT,
  UNIQUE (organisation_id, operation_id)
);
CREATE INDEX pilot_core_change_feed_org_cursor_idx
  ON pilot_core_change_feed (organisation_id, cursor_id);
CREATE INDEX pilot_core_change_feed_hole_cursor_idx
  ON pilot_core_change_feed (organisation_id, hole_id, cursor_id)
  WHERE hole_id IS NOT NULL;

COMMENT ON TABLE pilot_core_change_feed IS
  'Durable Stage 7C pull cursor for accepted, transactionally materialized core workflow operations.';
COMMENT ON COLUMN pilot_core_change_feed.server_received_at IS
  'Authoritative ordering timestamp. client_time is retained separately as field evidence and is not used as the server cursor.';
COMMENT ON TABLE pilot_domain_operations IS
  'Immutable validated operation journal. Stage 7C core operations marked MATERIALIZED are transactionally applied to authoritative normalized projections; other operations remain journal-only.';
COMMENT ON TABLE pilot_domain_revisions IS
  'Optimistic revision registry used for expected-version conflict checks. Stage 7C core revisions accompany normalized authoritative projections but are not an automatic merge mechanism.';
