-- Accounts: users sign in with email and password; each session is an opaque
-- token stored only as its SHA-256; each user owns profiles (one 'owner'
-- profile at sign-up; 'child' profiles come with the family slice).
-- Times are milliseconds since the epoch (UTC).

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX sessions_user_id ON sessions (user_id);

CREATE TABLE profiles (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('owner', 'child')),
  name TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);
CREATE INDEX profiles_user_id ON profiles (user_id);
CREATE UNIQUE INDEX profiles_one_owner ON profiles (user_id) WHERE kind = 'owner';

-- Failed sign-ins per email, for the rate limit (10 per 15 minutes).
CREATE TABLE signin_failures (
  email TEXT NOT NULL,
  failed_at INTEGER NOT NULL
);
CREATE INDEX signin_failures_email ON signin_failures (email, failed_at);
