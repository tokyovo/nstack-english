import type { DatabaseSync } from 'node:sqlite';

import { Hono, type Context } from 'hono';
import { bodyLimit } from 'hono/body-limit';

import { mergeProgress } from '../src/progress/merge.ts';
import { emptyProgress, parseProgress, type Progress } from '../src/progress/schema.ts';
import { requireUserMiddleware, type AuthEnv, type SessionScope, type User } from './accounts.ts';

const MAX_DOCUMENT = 1024 * 1024;

const notFound = { error: 'not_found' };
const invalidProgress = { error: 'invalid_progress' };

/**
 * `GET` and `PUT /profiles/:id/progress`, mounted at `/api`, for the signed-in owner of the
 * profile, or a child's token for that child only; any other profile answers 404, so ids
 * reveal nothing. PUT merges the client's
 * copy into the stored one and returns the result.
 */
export function progressRoutes(db: DatabaseSync, now: () => Date) {
  const app = new Hono<AuthEnv>();
  app.use('/profiles/:id/progress', requireUserMiddleware(db, now));

  app.get('/profiles/:id/progress', (c) => {
    const profileId = c.req.param('id');
    if (!mayReach(db, c.get('user'), c.get('scope'), profileId)) return c.json(notFound, 404);
    return c.json(storedProgress(db, profileId));
  });

  app.put(
    '/profiles/:id/progress',
    bodyLimit({ maxSize: MAX_DOCUMENT, onError: (c) => c.json({ error: 'too_large' }, 413) }),
    async (c) => {
      const profileId = c.req.param('id');
      if (!mayReach(db, c.get('user'), c.get('scope'), profileId)) return c.json(notFound, 404);
      const incoming = parseProgress(await readJson(c), profileId);
      if (!incoming) return c.json(invalidProgress, 400);
      // No await between this read and the write, so concurrent PUTs cannot lose each other's answers.
      const merged = mergeProgress(storedProgress(db, profileId), incoming);
      db.prepare(
        `INSERT INTO progress (profile_id, document, updated_at) VALUES (?, ?, ?)
         ON CONFLICT (profile_id) DO UPDATE SET document = excluded.document, updated_at = excluded.updated_at`,
      ).run(profileId, JSON.stringify(merged), now().getTime());
      return c.json(merged);
    },
  );

  return app;
}

/** The parent's session reaches every profile of the account; a child's token only its own. */
function mayReach(db: DatabaseSync, user: User, scope: SessionScope, profileId: string): boolean {
  if (scope.kind === 'profile' && scope.profileId !== profileId) return false;
  return db.prepare('SELECT 1 FROM profiles WHERE id = ? AND user_id = ?').get(profileId, user.id) !== undefined;
}

/** Throws rather than answer empty progress when the stored copy is unreadable, so a PUT never overwrites it. */
function storedProgress(db: DatabaseSync, profileId: string): Progress {
  const row = db.prepare('SELECT document FROM progress WHERE profile_id = ?').get(profileId);
  if (!row) return emptyProgress(profileId);
  const progress = parseProgress(JSON.parse(String(row.document)), profileId);
  if (!progress) throw new Error(`Stored progress for profile ${profileId} is unreadable`);
  return progress;
}

async function readJson(c: Context): Promise<unknown> {
  try {
    return await c.req.json();
  } catch {
    return undefined;
  }
}
