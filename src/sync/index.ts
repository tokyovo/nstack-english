// Local-first progress sync. The device learns as LOCAL_PROFILE_ID, or in the child's own copy while
// a child is learning (src/account syncSession); while signed in, that copy is sent to its profile, the server merges it with what it has (server/progress.ts)
// and the merged copy comes back and is merged into the device's. One PUT both pushes and pulls,
// and the merge is a union, so retries and several devices converge.
import { endChildSession, onSessionChange, syncSession } from '@/account';
import { callApi } from '@/api/client';
import { createProgressStore, onProgressChange } from '@/progress';
import { parseProgress } from '@/progress/schema';

/** `idle` until the first sync has run; `failed` is any answer other than offline or the merged copy. */
export type SyncState = 'idle' | 'signedOut' | 'synced' | 'offline' | 'failed';

const store = createProgressStore();
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
  if (!session) return 'signedOut';
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

function setState(next: SyncState) {
  if (next === state) return;
  state = next;
  for (const listener of listeners) listener();
}
