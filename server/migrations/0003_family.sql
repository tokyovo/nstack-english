-- Family: child profiles have a picture (one of a fixed set of animal emoji,
-- checked by the server; NULL for the owner). A session may be scoped to one
-- profile: a child's token can reach only that profile. NULL means the whole
-- account (the parent's sign-in). Deleting a profile ends its sessions.

ALTER TABLE profiles ADD COLUMN picture TEXT;

ALTER TABLE sessions ADD COLUMN profile_id TEXT REFERENCES profiles (id) ON DELETE CASCADE;
CREATE INDEX sessions_profile_id ON sessions (profile_id);
