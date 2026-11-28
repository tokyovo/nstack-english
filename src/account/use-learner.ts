import { useEffect, useState } from 'react';

import { activeChild, deviceProfileIdOf, onSessionChange, type Profile } from './index';

/**
 * Who is learning on this device: a child handed the device by the parent, or the parent (or a
 * signed-out learner) when `child` is null. `progressId` is the device copy of progress to use.
 */
export type LearnerState = { status: 'loading' } | { status: 'ready'; child: Profile | null; progressId: string };

/** The learner on this device, read again after each sign-in, sign-out and switch of profile. */
export function useLearner(): LearnerState {
  const [learner, setLearner] = useState<LearnerState>({ status: 'loading' });

  useEffect(() => {
    let current = true;
    const show = (child: Profile | undefined) => {
      if (current) setLearner({ status: 'ready', child: child ?? null, progressId: deviceProfileIdOf(child) });
    };
    const read = () => activeChild().then(show, () => show(undefined));
    read();
    const stop = onSessionChange(read);
    return () => {
      current = false;
      stop();
    };
  }, []);

  return learner;
}
