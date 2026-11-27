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
});
