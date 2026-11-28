// Grants Premium to an account: npm run grant -- --db <path> <email> <days> [--source manual] [--ref <ref>]
// A command, not an HTTP endpoint, so there is nothing to attack. The database is never
// defaulted: the path must be given and must already exist (the server creates and migrates it).
import { existsSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { parseArgs } from 'node:util';

import { ENTITLEMENT_SOURCES, grantPremium, type EntitlementSource, type GrantInput } from './entitlements.ts';

const USAGE = 'Usage: npm run grant -- --db <path> <email> <days> [--source manual] [--ref <reference>]';
const MAX_DAYS = 3650;

class UsageError extends Error {}

function readInput(argv: string[]): { dbPath: string; input: GrantInput } {
  let parsed;
  try {
    parsed = parseArgs({
      args: argv,
      allowPositionals: true,
      options: { db: { type: 'string' }, source: { type: 'string', default: 'manual' }, ref: { type: 'string' } },
    });
  } catch (error) {
    throw new UsageError(`${(error as Error).message}\n${USAGE}`);
  }
  const { values, positionals } = parsed;
  if (!values.db) throw new UsageError(`--db <path> is required; there is no default database.\n${USAGE}`);
  if (!existsSync(values.db)) throw new UsageError(`Database ${values.db} does not exist; start the server on it first.`);
  if (positionals.length !== 2) throw new UsageError(USAGE);
  const email = positionals[0].trim().toLowerCase();
  const daysText = positionals[1];
  const days = Number(daysText);
  if (!/^\d+$/.test(daysText) || days < 1 || days > MAX_DAYS) {
    throw new UsageError(`days must be a whole number from 1 to ${MAX_DAYS}, got ${JSON.stringify(daysText)}`);
  }
  const source = ENTITLEMENT_SOURCES.find((known) => known === values.source);
  if (!source) throw new UsageError(`source must be one of ${ENTITLEMENT_SOURCES.join(', ')}`);
  return { dbPath: values.db, input: { email, days, source, ref: values.ref ?? defaultRef(source, email) } };
}

/** Without --ref, rerunning the same grant on the same day stores it once. */
function defaultRef(source: EntitlementSource, email: string): string {
  return `${source}:${email}:${new Date().toISOString().slice(0, 10)}`;
}

function main(argv: string[]): number {
  let dbPath: string;
  let input: GrantInput;
  try {
    ({ dbPath, input } = readInput(argv));
  } catch (error) {
    if (!(error instanceof UsageError)) throw error;
    console.error(error.message);
    return 2;
  }
  const db = new DatabaseSync(dbPath);
  try {
    db.exec('PRAGMA foreign_keys = ON');
    const result = grantPremium(db, input, new Date());
    switch (result.status) {
      case 'unknown_email':
        console.error(`No account with email ${input.email}`);
        return 1;
      case 'ref_taken':
        console.error(`Reference ${input.ref} (${input.source}) already belongs to another account`);
        return 1;
      case 'exists':
        console.log(`Premium already granted to ${input.email} with reference ${input.ref}, until ${result.until.toISOString()}`);
        return 0;
      case 'granted':
        console.log(`Granted Premium to ${input.email} until ${result.until.toISOString()} (reference ${input.ref})`);
        return 0;
    }
  } finally {
    db.close();
  }
}

process.exitCode = main(process.argv.slice(2));
