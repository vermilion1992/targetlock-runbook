CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE pilot_role AS ENUM ('COMPANY_ADMIN', 'SUPERVISOR', 'DRILLER');
CREATE TYPE pilot_account_status AS ENUM ('ACTIVE', 'DISABLED', 'REVOKED');
CREATE TYPE pilot_organisation_status AS ENUM ('ACTIVE', 'SUSPENDED');
CREATE TYPE pilot_device_status AS ENUM ('ACTIVE', 'DISABLED', 'REVOKED');
CREATE TYPE pilot_lease_status AS ENUM ('ACTIVE', 'RELEASED', 'EXPIRED', 'TAKEN_OVER');
CREATE TYPE pilot_receipt_status AS ENUM ('ACCEPTED', 'CONFLICT', 'REJECTED');

CREATE TABLE pilot_organisations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL,
  name text NOT NULL,
  status pilot_organisation_status NOT NULL DEFAULT 'ACTIVE',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pilot_organisations_slug_normalized CHECK (slug = lower(slug)),
  CONSTRAINT pilot_organisations_slug_unique UNIQUE (slug)
);

CREATE TABLE pilot_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  display_name text NOT NULL,
  password_hash text NOT NULL,
  status pilot_account_status NOT NULL DEFAULT 'ACTIVE',
  session_version integer NOT NULL DEFAULT 1,
  last_login_at timestamptz,
  password_changed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pilot_users_email_normalized CHECK (email = lower(email)),
  CONSTRAINT pilot_users_email_unique UNIQUE (email),
  CONSTRAINT pilot_users_session_version_positive CHECK (session_version > 0)
);

CREATE TABLE pilot_memberships (
  organisation_id uuid NOT NULL REFERENCES pilot_organisations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES pilot_users(id) ON DELETE CASCADE,
  role pilot_role NOT NULL,
  status pilot_account_status NOT NULL DEFAULT 'ACTIVE',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organisation_id, user_id)
);
CREATE INDEX pilot_memberships_user_idx ON pilot_memberships(user_id, status);

CREATE TABLE pilot_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL,
  user_id uuid NOT NULL,
  token_hash text NOT NULL UNIQUE,
  session_version_at_issue integer NOT NULL,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  ip_hash text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (organisation_id, user_id)
    REFERENCES pilot_memberships(organisation_id, user_id) ON DELETE CASCADE
);
CREATE INDEX pilot_sessions_lookup_idx
  ON pilot_sessions(token_hash, expires_at) WHERE revoked_at IS NULL;
CREATE INDEX pilot_sessions_user_idx
  ON pilot_sessions(organisation_id, user_id, expires_at DESC);

CREATE TABLE pilot_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES pilot_organisations(id) ON DELETE CASCADE,
  external_ref text NOT NULL,
  display_name text NOT NULL,
  version integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'ACTIVE',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organisation_id, external_ref),
  UNIQUE (organisation_id, id)
);

CREATE TABLE pilot_rigs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES pilot_organisations(id) ON DELETE CASCADE,
  project_id uuid,
  external_ref text NOT NULL,
  display_name text NOT NULL,
  status text NOT NULL DEFAULT 'ACTIVE',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (organisation_id, project_id)
    REFERENCES pilot_projects(organisation_id, id) ON DELETE RESTRICT,
  UNIQUE (organisation_id, external_ref),
  UNIQUE (organisation_id, id)
);

CREATE TABLE pilot_holes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES pilot_organisations(id) ON DELETE CASCADE,
  project_id uuid,
  rig_id uuid,
  external_ref text NOT NULL,
  display_name text NOT NULL,
  version integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'ACTIVE',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (organisation_id, project_id)
    REFERENCES pilot_projects(organisation_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (organisation_id, rig_id)
    REFERENCES pilot_rigs(organisation_id, id) ON DELETE RESTRICT,
  UNIQUE (organisation_id, external_ref),
  UNIQUE (organisation_id, id)
);

CREATE TABLE pilot_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES pilot_organisations(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  token_hash text NOT NULL UNIQUE,
  status pilot_device_status NOT NULL DEFAULT 'ACTIVE',
  site_name text,
  project_ref text,
  rig_ref text,
  is_primary boolean NOT NULL DEFAULT true,
  last_seen_at timestamptz,
  registered_by_user_id uuid NOT NULL REFERENCES pilot_users(id) ON DELETE RESTRICT,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organisation_id, id)
);
CREATE UNIQUE INDEX pilot_devices_primary_rig_idx
  ON pilot_devices(organisation_id, rig_ref)
  WHERE status = 'ACTIVE' AND is_primary AND rig_ref IS NOT NULL;
CREATE INDEX pilot_devices_org_status_idx
  ON pilot_devices(organisation_id, status, last_seen_at DESC);

CREATE TABLE pilot_work_leases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES pilot_organisations(id) ON DELETE CASCADE,
  resource_type text NOT NULL CHECK (resource_type IN ('HOLE', 'SHIFT')),
  resource_ref text NOT NULL,
  project_ref text,
  hole_ref text,
  shift_ref text,
  primary_device_id uuid NOT NULL,
  operator_user_id uuid NOT NULL,
  status pilot_lease_status NOT NULL DEFAULT 'ACTIVE',
  acquired_at timestamptz NOT NULL DEFAULT now(),
  heartbeat_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  released_at timestamptz,
  takeover_reason text,
  supersedes_lease_id uuid REFERENCES pilot_work_leases(id) ON DELETE SET NULL,
  version integer NOT NULL DEFAULT 1,
  FOREIGN KEY (organisation_id, primary_device_id)
    REFERENCES pilot_devices(organisation_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (organisation_id, operator_user_id)
    REFERENCES pilot_memberships(organisation_id, user_id) ON DELETE RESTRICT,
  UNIQUE (organisation_id, id)
);
CREATE UNIQUE INDEX pilot_work_leases_active_resource_idx
  ON pilot_work_leases(organisation_id, resource_type, resource_ref)
  WHERE status = 'ACTIVE';
CREATE INDEX pilot_work_leases_expiry_idx
  ON pilot_work_leases(organisation_id, expires_at) WHERE status = 'ACTIVE';
CREATE INDEX pilot_work_leases_device_idx
  ON pilot_work_leases(organisation_id, primary_device_id, status);

CREATE TABLE pilot_operation_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES pilot_organisations(id) ON DELETE CASCADE,
  operation_id uuid NOT NULL,
  device_id uuid NOT NULL,
  operator_user_id uuid NOT NULL,
  operation_type text NOT NULL,
  project_ref text,
  hole_ref text,
  shift_ref text,
  expected_version integer,
  client_time timestamptz NOT NULL,
  server_receipt_time timestamptz NOT NULL DEFAULT now(),
  envelope_hash text NOT NULL,
  payload_hash text NOT NULL,
  status pilot_receipt_status NOT NULL,
  reason_code text,
  FOREIGN KEY (organisation_id, device_id)
    REFERENCES pilot_devices(organisation_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (organisation_id, operator_user_id)
    REFERENCES pilot_memberships(organisation_id, user_id) ON DELETE RESTRICT,
  UNIQUE (organisation_id, operation_id)
);
CREATE INDEX pilot_operation_receipts_device_cursor_idx
  ON pilot_operation_receipts(organisation_id, device_id, server_receipt_time, operation_id);
CREATE INDEX pilot_operation_receipts_hole_idx
  ON pilot_operation_receipts(organisation_id, hole_ref, server_receipt_time)
  WHERE hole_ref IS NOT NULL;

CREATE TABLE pilot_sync_cursors (
  organisation_id uuid NOT NULL REFERENCES pilot_organisations(id) ON DELETE CASCADE,
  device_id uuid NOT NULL,
  cursor_value text NOT NULL,
  acknowledged_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organisation_id, device_id),
  FOREIGN KEY (organisation_id, device_id)
    REFERENCES pilot_devices(organisation_id, id) ON DELETE CASCADE
);

CREATE TABLE pilot_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES pilot_organisations(id) ON DELETE CASCADE,
  actor_user_id uuid REFERENCES pilot_users(id) ON DELETE SET NULL,
  actor_device_id uuid REFERENCES pilot_devices(id) ON DELETE SET NULL,
  action text NOT NULL,
  target_type text NOT NULL,
  target_id text,
  reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX pilot_audit_events_org_time_idx
  ON pilot_audit_events(organisation_id, occurred_at DESC);

