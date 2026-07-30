ALTER TABLE pilot_users
  ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false;

ALTER TABLE pilot_devices
  ADD COLUMN IF NOT EXISTS removed_by_user_id uuid REFERENCES pilot_users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS removal_reason text;

CREATE TABLE pilot_domain_operations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES pilot_organisations(id) ON DELETE CASCADE,
  operation_id uuid NOT NULL,
  schema_version integer NOT NULL,
  device_id uuid NOT NULL,
  operator_user_id uuid NOT NULL,
  operation_type text NOT NULL,
  project_id uuid,
  rig_id uuid,
  hole_id uuid,
  project_ref text,
  rig_ref text,
  hole_ref text,
  shift_ref text,
  expected_version integer,
  client_time timestamptz NOT NULL,
  server_received_at timestamptz NOT NULL DEFAULT now(),
  envelope_hash text NOT NULL,
  payload_hash text NOT NULL,
  payload_size_bytes integer NOT NULL,
  payload jsonb NOT NULL,
  lease_evidence jsonb,
  status pilot_receipt_status NOT NULL,
  reason_code text,
  CONSTRAINT pilot_domain_operations_schema_version_positive
    CHECK (schema_version > 0),
  CONSTRAINT pilot_domain_operations_payload_size_bounded
    CHECK (payload_size_bytes BETWEEN 2 AND 65536),
  CONSTRAINT pilot_domain_operations_payload_object
    CHECK (jsonb_typeof(payload) = 'object'),
  CONSTRAINT pilot_domain_operations_lease_evidence_object
    CHECK (lease_evidence IS NULL OR jsonb_typeof(lease_evidence) = 'object'),
  FOREIGN KEY (organisation_id, device_id)
    REFERENCES pilot_devices(organisation_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (organisation_id, operator_user_id)
    REFERENCES pilot_memberships(organisation_id, user_id) ON DELETE RESTRICT,
  FOREIGN KEY (organisation_id, project_id)
    REFERENCES pilot_projects(organisation_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (organisation_id, rig_id)
    REFERENCES pilot_rigs(organisation_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (organisation_id, hole_id)
    REFERENCES pilot_holes(organisation_id, id) ON DELETE RESTRICT,
  UNIQUE (organisation_id, operation_id)
);

CREATE INDEX pilot_domain_operations_device_cursor_idx
  ON pilot_domain_operations (
    organisation_id,
    device_id,
    server_received_at,
    operation_id
  );
CREATE INDEX pilot_domain_operations_hole_cursor_idx
  ON pilot_domain_operations (
    organisation_id,
    hole_ref,
    server_received_at,
    operation_id
  )
  WHERE hole_ref IS NOT NULL;
CREATE INDEX pilot_domain_operations_status_idx
  ON pilot_domain_operations (organisation_id, status, server_received_at DESC);

COMMENT ON TABLE pilot_domain_operations IS
  'Immutable Stage 7B shadow-pilot audit/backup journal. Operations are validated and stored but are not replayed into materialized operational domain tables.';
