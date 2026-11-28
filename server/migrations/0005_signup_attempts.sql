-- Sign-up attempts, for the rate limit (5 per 15 minutes per email and per
-- client address). Every attempt is recorded before its password is hashed,
-- whatever it answers; rows older than the window are deleted on write.
-- `kind` says what `value` is: a normalised email or the socket peer address.

CREATE TABLE IF NOT EXISTS signup_attempts (
  kind TEXT NOT NULL CHECK (kind IN ('email', 'address')),
  value TEXT NOT NULL,
  attempted_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS signup_attempts_value ON signup_attempts (kind, value, attempted_at);
CREATE INDEX IF NOT EXISTS signup_attempts_attempted_at ON signup_attempts (attempted_at);
