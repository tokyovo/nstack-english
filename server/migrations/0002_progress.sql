-- Progress: one merged document per profile (the JSON shape of src/progress/schema.ts).
-- Clients PUT their copy; the server stores the merge (src/progress/merge.ts).
-- Times are milliseconds since the epoch (UTC).

CREATE TABLE progress (
  profile_id TEXT PRIMARY KEY REFERENCES profiles (id) ON DELETE CASCADE,
  document TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
