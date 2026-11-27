import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DatabaseSync } from 'node:sqlite';

/**
 * Applies every not-yet-applied `*.sql` file in `dir`, in name order, each in
 * its own transaction. Returns the names applied by this call. Throws if an
 * applied migration's file has changed since it ran.
 */
export function migrate(db: DatabaseSync, dir: string): string[] {
  db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    name TEXT PRIMARY KEY,
    checksum TEXT NOT NULL,
    applied_at TEXT NOT NULL
  )`);

  const names = readdirSync(dir)
    .filter((name) => name.endsWith('.sql'))
    .sort();

  const applied: string[] = [];
  for (const name of names) {
    const sql = readFileSync(join(dir, name), 'utf8');
    if (applyOne(db, name, sql)) applied.push(name);
  }
  return applied;
}

function applyOne(db: DatabaseSync, name: string, sql: string): boolean {
  const checksum = createHash('sha256').update(sql).digest('hex');
  // IMMEDIATE takes the write lock before the check, so two processes
  // migrating the same file cannot both apply a migration.
  db.exec('BEGIN IMMEDIATE');
  try {
    const row = db.prepare('SELECT checksum FROM schema_migrations WHERE name = ?').get(name);
    if (row) {
      if (row.checksum !== checksum) {
        throw new Error(`Migration ${name} was changed after it was applied; add a new migration instead`);
      }
      db.exec('ROLLBACK');
      return false;
    }
    db.exec(sql);
    db.prepare('INSERT INTO schema_migrations (name, checksum, applied_at) VALUES (?, ?, ?)').run(
      name,
      checksum,
      new Date().toISOString(),
    );
    db.exec('COMMIT');
    return true;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}
