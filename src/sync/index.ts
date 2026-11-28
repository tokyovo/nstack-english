// Local-first progress sync. The device learns as LOCAL_PROFILE_ID, or in the child's own copy while
// a child is learning (src/account syncSession); while signed in, that copy is sent to its profile,
// the server merges it with what it has (server/progress.ts) and the merged copy comes back and is merged into the device's. One PUT both pushes and pulls,
// and the merge is a union, so retries and several devices converge.
import AsyncStorage from '@react-native-async-storage/async-storage';

import { endChildSession, familySyncSessions, onSessionChange, signOut, syncSession, type SyncSession } from '@/account';
import { callApi } from '@/api/client';
import { createProgressStore, LOCAL_PROFILE_ID, onProgressChange } from '@/progress';
import { parseProgress } from '@/progress/schema';

/** `idle` until the first sync has run; `failed` is any answer other than offline or the merged copy. */
export type SyncState = 'idle' | 'signedOut' | 'synced' | 'offline' | 'failed';

const store = createProgressStore();

/**
 * The account (its owner profile) every device copy belongs to, children's included, set when one
 * is first synced. A session that ends without signing out (expired, revoked) leaves the copies and
 * this mark behind, so the same account signing back in gets its unsynced answers, and any other
 * account starts with none of them.
 * No mark: guest progress, which the first sign-in adds to its account.
 */
const DEVICE_ACCOUNT_KEY = 'hocenglish.sync.deviceAccount';
const listeners = new Set<() => void>();
let state: SyncState = 'idle';
let running: Promise<SyncState> | undefined;
let again = false;

export function syncState(): SyncState {
  return state;
}

/** Calls `listener` whenever the sync state changes; returns the unsubscribe. */
export function subscribeSync(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Syncs the device's progress with the signed-in account. Calls while one is running are folded
 * into a single further run, so a change saved during a sync is still sent.
 */
export function syncProgress(): Promise<SyncState> {
  if (running) {
    again = true;
    return running;
  }
  const run = (async () => {
    let result: SyncState;
    do {
      again = false;
      result = await syncOnce().catch((): SyncState => 'failed');
      setState(result);
    } while (again);
    return result;
  })();
  running = run.finally(() => {
    running = undefined;
  });
  return running;
}

/**
 * Syncs after each sign-in or sign-out (the first sign-in adds this device's progress to the
 * account) and after each answer or lesson saved on this device. Returns the stop function.
 */
export function startSync(): () => void {
  const sync = () => void syncProgress();
  const stopSession = onSessionChange(sync);
  // Only the active learner's copy is synced; a change to any copy on the device starts a run.
  const stopProgress = onProgressChange(({ source }) => {
    if (source === 'device') sync();
  });
  return () => {
    stopSession();
    stopProgress();
  };
}

async function syncOnce(): Promise<SyncState> {
  const session = await syncSession();
  return session ? syncCopy(session) : 'signedOut';
}

/** Sends one device copy to its profile and merges the account's copy back into it. */
async function syncCopy(session: SyncSession): Promise<Exclude<SyncState, 'idle' | 'signedOut'>> {
  await claimDeviceCopies(session.ownerProfileId);
  const device = await store.load(session.deviceProfileId);
  const reply = await callApi(`/api/profiles/${encodeURIComponent(session.profileId)}/progress`, {
    method: 'PUT',
    body: { ...device, profileId: session.profileId },
    token: session.token,
  });
  if (reply.status === 'offline') return 'offline';
  const merged = reply.status === 200 ? parseProgress(reply.body, session.profileId) : null;
  if (!merged) return 'failed';
  await store.mergeIn(session.deviceProfileId, { ...merged, profileId: session.deviceProfileId });
  return 'synced';
}

/**
 * The parent takes the device back from a child: the child's progress is sent first, then the
 * child's token is ended. Unsent progress stays in the child's device copy and goes with the
 * child's next session.
 */
export async function leaveChildProfile(): Promise<void> {
  await syncProgress();
  await endChildSession();
}

/**
 * Clears every device copy (the parent's and any child's) left by another account, then marks the
 * device's copies as this account's. A child's copy belongs to its parent's account.
 */
async function claimDeviceCopies(ownerProfileId: string) {
  const owner = await AsyncStorage.getItem(DEVICE_ACCOUNT_KEY);
  if (owner === ownerProfileId) return;
  if (owner !== null) await store.clearAll();
  await AsyncStorage.setItem(DEVICE_ACCOUNT_KEY, ownerProfileId);
}

/** `signedOut` when the device's progress is gone with the session; otherwise why it could not be sent. */
export type SignOutResult = 'signedOut' | 'offline' | 'failed';

/**
 * Signs out so the next person on this device finds none of the family's progress: every learner's
 * device copy (the parent's and each child's) is sent to the account first, then all are cleared and
 * an active child's session ends with the parent's. When a copy cannot be sent the parent stays
 * signed in with nothing lost, unless they chose `discardUnsynced`.
 */
export async function signOutOfDevice({ discardUnsynced = false } = {}): Promise<SignOutResult> {
  const family = await familySyncSessions();
  const saved = await saveFamily(family ?? []);
  if (saved !== 'synced' && !discardUnsynced) return saved;
  // The session goes first, and any sync still running is waited for, so none refills the device.
  await signOut();
  await syncProgress();
  const copies = family?.map((session) => session.deviceProfileId) ?? [LOCAL_PROFILE_ID];
  await Promise.all(copies.map((copy) => store.clear(copy)));
  await AsyncStorage.removeItem(DEVICE_ACCOUNT_KEY);
  return 'signedOut';
}

/** The active learner's copy through the usual sync, then every other learner's; the first problem wins. */
async function saveFamily(family: SyncSession[]): Promise<'synced' | 'offline' | 'failed'> {
  const active = await syncSession();
  const others = family.filter((session) => session.deviceProfileId !== active?.deviceProfileId);
  const results = [
    await syncProgress(),
    ...(await Promise.all(others.map((session) => syncCopy(session).catch(() => 'failed' as const)))),
  ];
  return results.find((result) => result === 'offline' || result === 'failed') ?? 'synced';
}

function setState(next: SyncState) {
  if (next === state) return;
  state = next;
  for (const listener of listeners) listener();
}
