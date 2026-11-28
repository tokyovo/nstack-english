// Premium on this device: the learner's plan, and the bodies of premium units, which only the
// server has (server/units.ts). A unit fetched once is kept on the device so it opens offline.
import AsyncStorage from '@react-native-async-storage/async-storage';

import { syncSession } from '@/account';
import { callApi } from '@/api/client';
import type { Unit } from '@/content';
import { parseUnit } from '@/content/schema';

/** The learner's plan; `unknown` while the server cannot say (loading, offline). A child has its parent's. */
export type Plan = { kind: 'free' } | { kind: 'premium'; until: Date } | { kind: 'unknown' };

export type PremiumUnitResult =
  | { status: 'ready'; unit: Unit }
  | { status: 'locked' }
  | { status: 'offline' }
  | { status: 'error' };

const KEY_PREFIX = 'hocenglish.premiumUnit.';

/** The plan of whoever learns on this device; signed out is free. */
export async function loadPlan(): Promise<Plan> {
  const session = await syncSession();
  if (!session) return { kind: 'free' };
  const reply = await callApi('/api/plan', { token: session.token });
  if (reply.status === 401) return { kind: 'free' };
  return (reply.status === 200 && parsePlan(reply.body)) || { kind: 'unknown' };
}

/**
 * A premium unit's words and exercises. The server decides: it answers a Premium account's
 * learners (a child too), and refuses everyone else, whose device copy is then removed. Only
 * when the server cannot answer is the copy kept from an earlier open used.
 */
export async function loadPremiumUnit(id: string): Promise<PremiumUnitResult> {
  const session = await syncSession();
  if (!session) return { status: 'locked' };
  const reply = await callApi(`/api/units/${encodeURIComponent(id)}`, { token: session.token });
  if (reply.status === 401 || reply.status === 403) {
    await AsyncStorage.removeItem(KEY_PREFIX + id).catch(() => undefined);
    return { status: 'locked' };
  }
  const fetched = reply.status === 200 && isRecord(reply.body) ? unitOf(reply.body.unit, id) : undefined;
  if (fetched) {
    await AsyncStorage.setItem(KEY_PREFIX + id, JSON.stringify(fetched)).catch(() => undefined);
    return { status: 'ready', unit: fetched };
  }
  const kept = await keptUnit(id);
  if (kept) return { status: 'ready', unit: kept };
  return { status: reply.status === 'offline' ? 'offline' : 'error' };
}

async function keptUnit(id: string): Promise<Unit | undefined> {
  try {
    const saved = await AsyncStorage.getItem(KEY_PREFIX + id);
    return saved === null ? undefined : unitOf(JSON.parse(saved), id);
  } catch {
    return undefined;
  }
}

function unitOf(value: unknown, id: string): Unit | undefined {
  const result = parseUnit(value);
  return result.ok && result.unit.id === id ? result.unit : undefined;
}

function parsePlan(body: unknown): Plan | undefined {
  const plan = isRecord(body) ? body.plan : undefined;
  if (!isRecord(plan)) return undefined;
  if (plan.kind === 'free') return { kind: 'free' };
  const until = typeof plan.until === 'string' ? new Date(plan.until) : undefined;
  if (plan.kind === 'premium' && until && !Number.isNaN(until.getTime())) return { kind: 'premium', until };
  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
