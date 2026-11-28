-- Plans: a user is Premium while any of their entitlements is current
-- (starts_at <= now < expires_at). Every way of paying only inserts rows here:
-- a manual grant (npm run grant) now, App Store, Google Play and card webhooks
-- later. (source, external_ref) is unique, so a rerun grant or a webhook
-- delivered twice stores one row. A child's plan is its parent's (user_id).
-- Times are milliseconds since the epoch (UTC).

CREATE TABLE entitlements (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  source TEXT NOT NULL CHECK (source IN ('manual', 'app_store', 'google_play', 'card')),
  starts_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL CHECK (expires_at > starts_at),
  external_ref TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX entitlements_source_ref ON entitlements (source, external_ref);
CREATE INDEX entitlements_user_id ON entitlements (user_id, expires_at);
