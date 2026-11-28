// Premium on this device: the learner's plan, and the bodies of premium units, which only the
// server has (server/units.ts). A unit fetched once is kept on the device so it opens offline.
import AsyncStorage from '@react-native-async-storage/async-storage';

import { syncSession } from '@/account';
import { callApi } from '@/api/client';
import { getUnit, tracks, unitsOf, type Unit, type UnitSummary } from '@/content';
import { parseUnit } from '@/content/schema';
import { isLessonCompleted, type Progress } from '@/progress';

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

/**
 * The units whose words the learner reviews, in teaching order: every bundled unit, and each
 * finished premium unit the learner may open now (`loadPremiumUnit`: the server decides, the device
 * copy serves only offline). A finished premium unit the server refuses, or with no copy while
 * offline, is left out.
 */
export async function reviewUnits(progress: Progress): Promise<Unit[]> {
  const units = await Promise.all(tracks.flatMap(unitsOf).map((summary) => reviewUnit(summary, progress)));
  return units.filter((unit) => unit !== undefined);
}

async function reviewUnit(summary: UnitSummary, progress: Progress): Promise<Unit | undefined> {
  if (summary.access === 'free') return getUnit(summary.id);
  if (!isLessonCompleted(progress, summary.id)) return undefined;
  const loaded = await loadPremiumUnit(summary.id);
  return loaded.status === 'ready' ? loaded.unit : undefined;
}

/** Removes every premium unit kept on this device, for the next person to sign in. */
export async function clearPremiumUnits(): Promise<void> {
  const keys = await AsyncStorage.getAllKeys();
  await AsyncStorage.multiRemove(keys.filter((key) => key.startsWith(KEY_PREFIX)));
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
