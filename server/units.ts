import type { DatabaseSync } from 'node:sqlite';

import { Hono } from 'hono';

import { catalogOf } from '../src/content/access.ts';
import type { Unit } from '../src/content/schema.ts';
import { requireUserMiddleware, type AuthEnv } from './accounts.ts';
import { planOf } from './entitlements.ts';

type UnitEnv = AuthEnv & { Variables: { unit: Unit } };

/**
 * `GET /units/:id`, mounted at `/api`: a unit's words and exercises. Free units answer anyone;
 * a premium unit needs a session (401) whose account is Premium (403). A child's session
 * belongs to its parent's account, so a child has its parent's plan.
 */
export function unitRoutes(db: DatabaseSync, now: () => Date, units: readonly Unit[]) {
  const app = new Hono<UnitEnv>();
  const bodies = new Map(units.map((unit) => [unit.id, unit]));
  const premium = new Set(catalogOf(units).flatMap((unit) => (unit.access === 'premium' ? [unit.id] : [])));

  app.get(
    '/units/:id',
    async (c, next) => {
      const unit = bodies.get(c.req.param('id'));
      if (!unit) return c.json({ error: 'not_found' }, 404);
      if (!premium.has(unit.id)) return c.json({ unit });
      c.set('unit', unit);
      await next();
    },
    requireUserMiddleware(db, now),
    (c) => {
      if (planOf(db, c.get('user').id, now()).kind !== 'premium') return c.json({ error: 'premium_required' }, 403);
      // The app keeps its own offline copy; shared caches must not keep a paid unit.
      c.header('cache-control', 'private, no-store');
      return c.json({ unit: c.get('unit') });
    },
  );

  return app;
}
