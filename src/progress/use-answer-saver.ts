import { useRef } from 'react';

import { type Answer, type createProgressStore } from './index';

type ProgressStore = ReturnType<typeof createProgressStore>;

/**
 * Saves each answer to the device copy `profileId` as it is given. An answer that fails to
 * save is kept and saved again by `flush()`, so "Thử lại" at the end loses nothing.
 */
export function useAnswerSaver(store: ProgressStore, profileId: string) {
  const writes = useRef<Promise<void>[]>([]);
  const unsaved = useRef<Answer[]>([]);

  function record(answer: Answer) {
    const write = store.recordAnswer(profileId, answer).then(
      () => undefined,
      () => {
        unsaved.current.push(answer);
      }
    );
    writes.current.push(write);
  }

  /** Waits for every answer to be saved; throws while one still cannot be. */
  async function flush() {
    await Promise.all(writes.current);
    writes.current = [];
    while (unsaved.current.length > 0) {
      await store.recordAnswer(profileId, unsaved.current[0]);
      unsaved.current.shift();
    }
  }

  return { record, flush };
}
