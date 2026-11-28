import { randomUUID } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';

import { Hono, type Context } from 'hono';
import { bodyLimit } from 'hono/body-limit';

import { isProfilePicture } from '../src/profiles/pictures.ts';
import { profileOf, requireAccountMiddleware, startProfileSession, type AuthEnv, type Profile } from './accounts.ts';

export const MAX_CHILDREN = 4;
const MAX_NAME = 20;

type ErrorBody = { error: string; field?: 'name' | 'picture' };

const notFound: ErrorBody = { error: 'not_found' };
const invalidBody: ErrorBody = { error: 'invalid_body' };
const invalidName: ErrorBody = { error: 'invalid_name', field: 'name' };
const invalidPicture: ErrorBody = { error: 'invalid_picture', field: 'picture' };

/**
 * Child profiles, mounted at `/api`, for the parent's account session only (a child's
 * profile-scoped token answers 403). A child has a nickname and a picture, nothing else.
 * Another user's profile answers 404, so ids reveal nothing.
 */
export function profileRoutes(db: DatabaseSync, now: () => Date) {
  const app = new Hono<AuthEnv>();
  const requireAccount = requireAccountMiddleware(db, now);
  const limit = bodyLimit({ maxSize: 4 * 1024, onError: (c) => c.json(invalidBody, 413) });

  app.post('/profiles', requireAccount, limit, async (c) => {
    const body = await readObject(c);
    if (!body) return c.json(invalidBody, 400);
    const name = readNickname(body.name);
    if (name === undefined) return c.json(invalidName, 400);
    if (!isProfilePicture(body.picture)) return c.json(invalidPicture, 400);
    const userId = c.get('user').id;
    // No await between the count and the insert, so two requests cannot both add a fifth child.
    const children = db.prepare("SELECT count(*) AS n FROM profiles WHERE user_id = ? AND kind = 'child'").get(userId);
    if (Number(children?.n) >= MAX_CHILDREN) return c.json({ error: 'too_many_children' } satisfies ErrorBody, 409);
    const profile: Profile = { id: randomUUID(), kind: 'child', name, picture: body.picture };
    db.prepare("INSERT INTO profiles (id, user_id, kind, name, picture, created_at) VALUES (?, ?, 'child', ?, ?, ?)").run(
      profile.id,
      userId,
      profile.name,
      profile.picture,
      now().getTime(),
    );
    return c.json({ profile }, 201);
  });

  app.patch('/profiles/:id', requireAccount, limit, async (c) => {
    const current = profileOf(db, c.get('user').id, c.req.param('id'));
    if (!current) return c.json(notFound, 404);
    const body = await readObject(c);
    if (!body || (body.name === undefined && body.picture === undefined)) return c.json(invalidBody, 400);
    const name = body.name === undefined ? current.name : readNickname(body.name);
    if (name === undefined) return c.json(invalidName, 400);
    if (body.picture !== undefined && !isProfilePicture(body.picture)) return c.json(invalidPicture, 400);
    const profile: Profile = { ...current, name, picture: body.picture ?? current.picture };
    db.prepare('UPDATE profiles SET name = ?, picture = ? WHERE id = ?').run(profile.name, profile.picture, profile.id);
    return c.json({ profile });
  });

  app.delete('/profiles/:id', requireAccount, (c) => {
    const profile = profileOf(db, c.get('user').id, c.req.param('id'));
    if (!profile) return c.json(notFound, 404);
    if (profile.kind === 'owner') return c.json({ error: 'owner_profile' } satisfies ErrorBody, 400);
    // The schema's ON DELETE CASCADE removes the child's progress and sessions with it.
    db.prepare('DELETE FROM profiles WHERE id = ?').run(profile.id);
    return c.body(null, 204);
  });

  /** Hands the phone to a child: a token that reaches only this child's progress. */
  app.post('/profiles/:id/session', requireAccount, (c) => {
    const user = c.get('user');
    const profile = profileOf(db, user.id, c.req.param('id'));
    if (!profile) return c.json(notFound, 404);
    if (profile.kind === 'owner') return c.json({ error: 'owner_profile' } satisfies ErrorBody, 400);
    return c.json({ token: startProfileSession(db, user, profile.id, now()), profile }, 201);
  });

  return app;
}

/** A nickname of 1 to 20 characters, trimmed; undefined when it is not one. */
function readNickname(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const nickname = value.normalize('NFC').trim();
  const length = [...nickname].length;
  return length >= 1 && length <= MAX_NAME ? nickname : undefined;
}

/** The JSON object in the request body; undefined when it is not one. */
async function readObject(c: Context): Promise<Record<string, unknown> | undefined> {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return undefined;
  }
  return typeof body === 'object' && body !== null && !Array.isArray(body) ? (body as Record<string, unknown>) : undefined;
}
