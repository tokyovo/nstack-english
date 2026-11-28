import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DatabaseSync } from 'node:sqlite';

import { Hono, type Context } from 'hono';
import { bodyLimit } from 'hono/body-limit';

import { parseUnit } from '../src/content/schema.ts';
import { mergeProgress } from '../src/progress/merge.ts';
import { emptyProgress, parseProgress, type Progress } from '../src/progress/schema.ts';
import { requireUserMiddleware, type AuthEnv } from './accounts.ts';

const MAX_DOCUMENT = 1024 * 1024;
const CONTENT_DIR = join(import.meta.dirname, '..', 'content');

const notFound = { error: 'not_found' };
const invalidProgress = { error: 'invalid_progress' };

/**
 * `GET` and `PUT /profiles/:id/progress`, mounted at `/api`, for the signed-in owner of the
 * profile only; any other profile answers 404, so ids reveal nothing. PUT merges the client's
 * copy into the stored one and returns the result. Units and items that are not in the content
 * are dropped, and the merge keeps a few answers per item, so a stored document stays small.
 */
export function progressRoutes(db: DatabaseSync, now: () => Date) {
  const app = new Hono<AuthEnv>();
  const known = contentIds(CONTENT_DIR);
  app.use('/profiles/:id/progress', requireUserMiddleware(db, now));

  app.get('/profiles/:id/progress', (c) => {
    const profileId = c.req.param('id');
    if (!ownsProfile(db, c.get('user').id, profileId)) return c.json(notFound, 404);
    return c.json(storedProgress(db, profileId));
  });

  app.put(
    '/profiles/:id/progress',
    bodyLimit({ maxSize: MAX_DOCUMENT, onError: (c) => c.json({ error: 'too_large' }, 413) }),
    async (c) => {
      const profileId = c.req.param('id');
      if (!ownsProfile(db, c.get('user').id, profileId)) return c.json(notFound, 404);
      const incoming = parseProgress(await readJson(c), profileId);
      if (!incoming) return c.json(invalidProgress, 400);
      // No await between this read and the write, so concurrent PUTs cannot lose each other's answers.
      const merged = mergeProgress(storedProgress(db, profileId), onlyKnown(incoming, known));
      db.prepare(
        `INSERT INTO progress (profile_id, document, updated_at) VALUES (?, ?, ?)
         ON CONFLICT (profile_id) DO UPDATE SET document = excluded.document, updated_at = excluded.updated_at`,
      ).run(profileId, JSON.stringify(merged), now().getTime());
      return c.json(merged);
    },
  );

  return app;
}

type ContentIds = { units: Set<string>; items: Set<string> };

/** Unit ids, and the word and exercise ids answers are saved under, of every unit in `dir`. */
function contentIds(dir: string): ContentIds {
  const ids: ContentIds = { units: new Set(), items: new Set() };
  for (const file of readdirSync(dir, { recursive: true, encoding: 'utf8' })) {
    if (!file.endsWith('.json')) continue;
    const result = parseUnit(JSON.parse(readFileSync(join(dir, file), 'utf8')));
    if (!result.ok) throw new Error(`Invalid content unit ${file}:\n${result.errors.join('\n')}`);
    ids.units.add(result.unit.id);
    for (const { id } of [...result.unit.words, ...result.unit.exercises]) ids.items.add(id);
  }
  return ids;
}

function onlyKnown(progress: Progress, known: ContentIds): Progress {
  return {
    ...progress,
    lessons: Object.fromEntries(Object.entries(progress.lessons).filter(([id]) => known.units.has(id))),
    answers: Object.fromEntries(Object.entries(progress.answers).filter(([id]) => known.items.has(id))),
  };
}

function ownsProfile(db: DatabaseSync, userId: string, profileId: string): boolean {
  return db.prepare('SELECT 1 FROM profiles WHERE id = ? AND user_id = ?').get(profileId, userId) !== undefined;
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
