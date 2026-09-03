-- Persist redacted tenant ownership repair summaries without adding another
-- public/control-plane profile data path.
CREATE SCHEMA IF NOT EXISTS payfix_internal;
REVOKE ALL ON SCHEMA payfix_internal FROM PUBLIC;

CREATE TABLE IF NOT EXISTS payfix_internal.tenant_ownership_backfill_audit (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id uuid NOT NULL,
    tenant_id uuid NOT NULL,
    tenant_schema varchar(63),
    started_at timestamptz NOT NULL,
    completed_at timestamptz NOT NULL,
    mode text NOT NULL CHECK (mode IN ('apply')),
    status text NOT NULL CHECK (status IN ('verified', 'partial', 'failed')),
    total_profiles integer NOT NULL DEFAULT 0 CHECK (total_profiles >= 0),
    matching_profiles integer NOT NULL DEFAULT 0 CHECK (matching_profiles >= 0),
    missing_tenant_id integer NOT NULL DEFAULT 0 CHECK (missing_tenant_id >= 0),
    conflicting_profiles integer NOT NULL DEFAULT 0 CHECK (conflicting_profiles >= 0),
    updated_profiles integer NOT NULL DEFAULT 0 CHECK (updated_profiles >= 0),
    unresolved_conflict_count integer NOT NULL DEFAULT 0 CHECK (unresolved_conflict_count >= 0),
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tenant_ownership_backfill_audit_run_idx
    ON payfix_internal.tenant_ownership_backfill_audit (run_id);

CREATE INDEX IF NOT EXISTS tenant_ownership_backfill_audit_tenant_idx
    ON payfix_internal.tenant_ownership_backfill_audit (tenant_id, tenant_schema, started_at DESC);

REVOKE ALL ON TABLE payfix_internal.tenant_ownership_backfill_audit FROM PUBLIC;