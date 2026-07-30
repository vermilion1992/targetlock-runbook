ALTER TABLE pilot_domain_operations
  ADD COLUMN IF NOT EXISTS revision_ref text;

CREATE TABLE pilot_domain_revisions (
  organisation_id uuid NOT NULL REFERENCES pilot_organisations(id) ON DELETE CASCADE,
  revision_ref text NOT NULL,
  current_version integer NOT NULL,
  last_operation_id uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organisation_id, revision_ref),
  CONSTRAINT pilot_domain_revisions_version_nonnegative
    CHECK (current_version >= 0),
  CONSTRAINT pilot_domain_revisions_ref_bounded
    CHECK (char_length(revision_ref) BETWEEN 3 AND 260),
  FOREIGN KEY (organisation_id, last_operation_id)
    REFERENCES pilot_domain_operations(organisation_id, operation_id)
    DEFERRABLE INITIALLY DEFERRED
);

CREATE INDEX pilot_domain_operations_revision_idx
  ON pilot_domain_operations (
    organisation_id,
    revision_ref,
    server_received_at,
    operation_id
  )
  WHERE revision_ref IS NOT NULL;

COMMENT ON TABLE pilot_domain_revisions IS
  'Journal-only optimistic revision registry. It detects stale domain operation envelopes but does not materialize or replay operational domain state.';
