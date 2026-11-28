import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, test } from 'node:test';

import { migrate } from './migrate.ts';

let dir: string;
let migrationsDir: string;
let db: DatabaseSync;

function writeMigration(name: string, sql: string) {
  writeFileSync(join(migrationsDir, name), sql);
}

function schema(database: DatabaseSync) {
  return database
    .prepare("SELECT type, name, sql FROM sqlite_schema WHERE name NOT LIKE 'sqlite_%' ORDER BY name")
    .all();
}

function appliedNames(database: DatabaseSync) {
  return database
    .prepare('SELECT name FROM schema_migrations ORDER BY name')
    .all()
    .map((row) => row.name);
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'migrate-test-'));
  migrationsDir = join(dir, 'migrations');
  mkdirSync(migrationsDir);
  db = new DatabaseSync(join(dir, 'test.sqlite'));
});

afterEach(() => {
  db.close();
  rmSync(dir, { recursive: true, force: true });
});

describe('migrate', () => {
  test('applies .sql files in name order and records each one', () => {
    writeMigration('0002_add_note.sql', 'ALTER TABLE word ADD COLUMN note TEXT;');
    writeMigration('0001_word.sql', 'CREATE TABLE word (id INTEGER PRIMARY KEY, text TEXT NOT NULL);');
    writeMigration('README.md', 'not a migration');

    const applied = migrate(db, migrationsDir);

    assert.deepEqual(applied, ['0001_word.sql', '0002_add_note.sql']);
    assert.deepEqual(appliedNames(db), ['0001_word.sql', '0002_add_note.sql']);
    const columns = db.prepare('PRAGMA table_info(word)').all().map((c) => c.name);
    assert.deepEqual(columns, ['id', 'text', 'note']);
  });

  test('a second run applies nothing and leaves schema and rows unchanged', () => {
    writeMigration('0001_word.sql', 'CREATE TABLE word (id INTEGER PRIMARY KEY, text TEXT NOT NULL);');
    migrate(db, migrationsDir);
    const insert = db.prepare('INSERT INTO word (text) VALUES (?)');
    for (const text of ['xin chào', '', 'a'.repeat(5000)]) insert.run(text);
    const schemaBefore = schema(db);
    const migrationsBefore = db.prepare('SELECT * FROM schema_migrations').all();

    const applied = migrate(db, migrationsDir);

    assert.deepEqual(applied, []);
    assert.deepEqual(schema(db), schemaBefore);
    assert.deepEqual(db.prepare('SELECT * FROM schema_migrations').all(), migrationsBefore);
    assert.equal(db.prepare('SELECT count(*) AS n FROM word').get()?.n, 3);
  });

  test('applies only migrations added since the last run', () => {
    writeMigration('0001_word.sql', 'CREATE TABLE word (id INTEGER PRIMARY KEY);');
    migrate(db, migrationsDir);
    writeMigration('0002_lesson.sql', 'CREATE TABLE lesson (id INTEGER PRIMARY KEY);');

    assert.deepEqual(migrate(db, migrationsDir), ['0002_lesson.sql']);
  });

  test('refuses an applied migration whose file was edited', () => {
    writeMigration('0001_word.sql', 'CREATE TABLE word (id INTEGER PRIMARY KEY);');
    migrate(db, migrationsDir);
    writeMigration('0001_word.sql', 'CREATE TABLE word (id INTEGER PRIMARY KEY, text TEXT);');
    writeMigration('0002_lesson.sql', 'CREATE TABLE lesson (id INTEGER PRIMARY KEY);');

    assert.throws(() => migrate(db, migrationsDir), /0001_word\.sql was changed/);
    assert.deepEqual(appliedNames(db), ['0001_word.sql']);
  });

  test('a failing migration leaves no partial change and stops later ones', () => {
    writeMigration('0001_word.sql', 'CREATE TABLE word (id INTEGER PRIMARY KEY);');
    writeMigration('0002_broken.sql', 'CREATE TABLE lesson (id INTEGER PRIMARY KEY); INSERT INTO nope VALUES (1);');
    writeMigration('0003_later.sql', 'CREATE TABLE later (id INTEGER PRIMARY KEY);');

    assert.throws(() => migrate(db, migrationsDir), /no such table: nope/);

    assert.deepEqual(appliedNames(db), ['0001_word.sql']);
    const tables = schema(db).map((entry) => entry.name);
    assert.deepEqual(tables, ['schema_migrations', 'word']);
  });

  test('the repository migrations apply to a new database and rerun cleanly', () => {
    const repoMigrations = join(import.meta.dirname, 'migrations');
    migrate(db, repoMigrations);
    const schemaAfterFirst = schema(db);

    assert.deepEqual(migrate(db, repoMigrations), []);
    assert.deepEqual(schema(db), schemaAfterFirst);
  });

  test('rerunning the repository migrations keeps account rows as they were', () => {
    const repoMigrations = join(import.meta.dirname, 'migrations');
    migrate(db, repoMigrations);
    const addUser = db.prepare('INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)');
    const addProfile = db.prepare('INSERT INTO profiles (id, user_id, kind, name, created_at) VALUES (?, ?, ?, ?, ?)');
    for (let i = 0; i < 200; i += 1) {
      addUser.run(`u${i}`, `user${i}@example.com`, 'scrypt$16384$8$1$salt$key', i);
      addProfile.run(`p${i}`, `u${i}`, 'owner', i % 2 ? '' : 'Tên rất dài '.repeat(100), i);
    }
    addProfile.run('child', 'u0', 'child', 'Bé Na', 1);
    db.prepare('INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)').run('h', 'u1', 1, 2);
    db.prepare('INSERT INTO signin_failures (email, failed_at) VALUES (?, ?)').run('user1@example.com', 1);
    const tables = ['users', 'profiles', 'sessions', 'signin_failures'];
    const before = tables.map((table) => db.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all());

    assert.deepEqual(migrate(db, repoMigrations), []);

    assert.deepEqual(
      tables.map((table) => db.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all()),
      before,
    );
    assert.equal(db.prepare('SELECT count(*) AS n FROM profiles').get()?.n, 201);
  });

  test('rerunning the repository migrations keeps progress documents as they were', () => {
    const repoMigrations = join(import.meta.dirname, 'migrations');
    migrate(db, repoMigrations);
    db.prepare("INSERT INTO users (id, email, password_hash, created_at) VALUES ('u', 'a@b.co', 'x', 0)").run();
    const addProfile = db.prepare("INSERT INTO profiles (id, user_id, kind, created_at) VALUES (?, 'u', 'child', 0)");
    const addProgress = db.prepare('INSERT INTO progress (profile_id, document, updated_at) VALUES (?, ?, ?)');
    const answers = Array.from({ length: 2000 }, (_, i) => ({ at: new Date(i * 1000).toISOString(), correct: i % 3 > 0 }));
    for (let i = 0; i < 100; i += 1) {
      addProfile.run(`p${i}`);
      const lessons = i % 2 ? {} : { 'everyday-a0-u1': { bestCorrect: i } };
      addProgress.run(`p${i}`, JSON.stringify({ schemaVersion: 1, profileId: `p${i}`, lessons, answers: { item: answers } }), i);
    }
    const before = db.prepare('SELECT * FROM progress ORDER BY rowid').all();

    assert.deepEqual(migrate(db, repoMigrations), []);

    assert.deepEqual(db.prepare('SELECT * FROM progress ORDER BY rowid').all(), before);
    assert.equal(before.length, 100);
  });

  test('a profile\'s progress is deleted with the profile, and needs an existing profile', () => {
    migrate(db, join(import.meta.dirname, 'migrations'));
    db.exec('PRAGMA foreign_keys = ON');
    db.prepare("INSERT INTO users (id, email, password_hash, created_at) VALUES ('u', 'a@b.co', 'x', 0)").run();
    db.prepare("INSERT INTO profiles (id, user_id, kind, created_at) VALUES ('p', 'u', 'owner', 0)").run();
    const addProgress = db.prepare("INSERT INTO progress (profile_id, document, updated_at) VALUES (?, '{}', 0)");
    addProgress.run('p');

    assert.throws(() => addProgress.run('missing'), /FOREIGN KEY constraint failed/);
    db.prepare("DELETE FROM users WHERE id = 'u'").run();
    assert.equal(db.prepare('SELECT count(*) AS n FROM progress').get()?.n, 0);
  });

  test('the accounts schema allows one owner profile per user', () => {
    migrate(db, join(import.meta.dirname, 'migrations'));
    db.prepare("INSERT INTO users (id, email, password_hash, created_at) VALUES ('u', 'a@b.co', 'x', 0)").run();
    const addProfile = db.prepare("INSERT INTO profiles (id, user_id, kind, created_at) VALUES (?, 'u', ?, 0)");
    addProfile.run('owner', 'owner');
    addProfile.run('child', 'child');

    assert.throws(() => addProfile.run('second-owner', 'owner'), /UNIQUE constraint failed/);
    assert.throws(() => addProfile.run('admin', 'admin'), /CHECK constraint failed/);
  });
});
