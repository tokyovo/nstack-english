import { randomUUID } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';

/** Where an entitlement came from; store and card integrations will insert rows with their own source. */
export const ENTITLEMENT_SOURCES = ['manual', 'app_store', 'google_play', 'card'] as const;
export type EntitlementSource = (typeof ENTITLEMENT_SOURCES)[number];

/** What `GET /api/me` and `GET /api/plan` report; `until` is an ISO time. */
export type Plan = { kind: 'free'; until: null } | { kind: 'premium'; until: string };

export type GrantInput = { email: string; days: number; source: EntitlementSource; ref: string };
export type GrantResult =
  | { status: 'granted' | 'exists'; until: Date }
  | { status: 'unknown_email' }
  | { status: 'ref_taken' };

const DAY = 24 * 60 * 60 * 1000;

/** The user's plan at `at`: Premium until the latest current entitlement ends, else free. */
export function planOf(db: DatabaseSync, userId: string, at: Date): Plan {
  const row = db
    .prepare('SELECT max(expires_at) AS until FROM entitlements WHERE user_id = ? AND starts_at <= ? AND expires_at > ?')
    .get(userId, at.getTime(), at.getTime());
  if (row?.until == null) return { kind: 'free', until: null };
  return { kind: 'premium', until: new Date(Number(row.until)).toISOString() };
}

/**
 * Gives the account with `email` Premium for `days` from `at`. Idempotent: when this account
 * already has the entitlement with this source and reference, it is kept as it is (`exists`).
 * The same reference on another account is refused (`ref_taken`).
 */
export function grantPremium(db: DatabaseSync, input: GrantInput, at: Date): GrantResult {
  const user = db.prepare('SELECT id FROM users WHERE email = ?').get(input.email);
  if (!user) return { status: 'unknown_email' };
  const userId = String(user.id);
  // No await between the check and the insert, so the unique index decides any race.
  const existing = db
    .prepare('SELECT user_id, expires_at FROM entitlements WHERE source = ? AND external_ref = ?')
    .get(input.source, input.ref);
  if (existing) {
    if (existing.user_id !== userId) return { status: 'ref_taken' };
    return { status: 'exists', until: new Date(Number(existing.expires_at)) };
  }
  const until = new Date(at.getTime() + input.days * DAY);
  db.prepare(
    `INSERT INTO entitlements (id, user_id, source, starts_at, expires_at, external_ref, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(randomUUID(), userId, input.source, at.getTime(), until.getTime(), input.ref, at.getTime());
  return { status: 'granted', until };
}
