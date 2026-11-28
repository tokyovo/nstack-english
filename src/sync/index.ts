// Local-first progress sync. The device always learns as LOCAL_PROFILE_ID; while signed in, that
// copy is sent to the account's profile, the server merges it with what it has (server/progress.ts)
// and the merged copy comes back and is merged into the device's. One PUT both pushes and pulls,
// and the merge is a union, so retries and several devices converge.
import AsyncStorage from '@react-native-async-storage/async-storage';

import { onSessionChange, signOut, syncSession } from '@/account';
import { callApi } from '@/api/client';
import { createProgressStore, LOCAL_PROFILE_ID, onProgressChange } from '@/progress';
import { parseProgress } from '@/progress/schema';

/** `idle` until the first sync has run; `failed` is any answer other than offline or the merged copy. */
export type SyncState = 'idle' | 'signedOut' | 'synced' | 'offline' | 'failed';

const store = createProgressStore();

/**
 * The account profile the device copy belongs to, set when it is first synced to one. A session
 * that ends without signing out (expired, revoked) leaves the copy and this mark behind, so the
 * same account signing back in gets its unsynced answers, and any other account starts clean.
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
  const stopProgress = onProgressChange(({ profileId, source }) => {
    if (profileId === LOCAL_PROFILE_ID && source === 'device') sync();
  });
  return () => {
    stopSession();
    stopProgress();
  };
}

async function syncOnce(): Promise<SyncState> {
  const session = await syncSession();
  if (!session) return 'signedOut';
  await claimDeviceCopy(session.profileId);
  const device = await store.load(LOCAL_PROFILE_ID);
  const reply = await callApi(`/api/profiles/${encodeURIComponent(session.profileId)}/progress`, {
    method: 'PUT',
    body: { ...device, profileId: session.profileId },
    token: session.token,
  });
  if (reply.status === 'offline') return 'offline';
  const merged = reply.status === 200 ? parseProgress(reply.body, session.profileId) : null;
  if (!merged) return 'failed';
  await store.mergeIn(LOCAL_PROFILE_ID, { ...merged, profileId: LOCAL_PROFILE_ID });
  return 'synced';
}

/** Clears a device copy left by another account, then marks it as this profile's. */
async function claimDeviceCopy(profileId: string) {
  const owner = await AsyncStorage.getItem(DEVICE_ACCOUNT_KEY);
  if (owner === profileId) return;
  if (owner !== null) await store.clear(LOCAL_PROFILE_ID);
  await AsyncStorage.setItem(DEVICE_ACCOUNT_KEY, profileId);
}

/** `signedOut` when the device's progress is gone with the session; otherwise why it could not be sent. */
export type SignOutResult = 'signedOut' | 'offline' | 'failed';

/**
 * Signs out so the next person on this device finds none of this learner's progress: the device
 * copy is sent to the account first, then cleared. When it cannot be sent the learner stays signed
 * in with nothing lost, unless they chose `discardUnsynced`.
 */
export async function signOutOfDevice({ discardUnsynced = false } = {}): Promise<SignOutResult> {
  const synced = await syncProgress();
  if (synced !== 'synced' && synced !== 'signedOut' && !discardUnsynced) {
    return synced === 'offline' ? 'offline' : 'failed';
  }
  // The session goes first, and any sync still running is waited for, so none refills the device.
  await signOut();
  await syncProgress();
  await store.clear(LOCAL_PROFILE_ID);
  await AsyncStorage.removeItem(DEVICE_ACCOUNT_KEY);
  return 'signedOut';
}

function setState(next: SyncState) {
  if (next === state) return;
  state = next;
  for (const listener of listeners) listener();
}
