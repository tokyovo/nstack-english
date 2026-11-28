import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';

import { onSessionChange } from '@/account';
import type { Unit } from '@/content';
import type { Progress } from '@/progress';

import { loadPlan, loadPremiumUnit, reviewUnits, type Plan, type PremiumUnitResult } from './index';

/** The learner's plan, read again each time the screen comes into view and after a switch of learner. */
export function usePlan(): Plan {
  const [plan, setPlan] = useState<Plan>({ kind: 'unknown' });

  useFocusEffect(
    useCallback(() => {
      let current = true;
      const read = () => loadPlan().then((next) => current && setPlan(next), () => current && setPlan({ kind: 'unknown' }));
      read();
      const stop = onSessionChange(read);
      return () => {
        current = false;
        stop();
      };
    }, [])
  );

  return plan;
}

export type PremiumUnitState = { status: 'loading' } | PremiumUnitResult;

/**
 * A premium unit's body for the lesson screen; `retry` asks the server again. Render it with
 * `key={id}`, so another unit starts from loading.
 */
export function usePremiumUnit(id: string) {
  const [state, setState] = useState<PremiumUnitState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let current = true;
    loadPremiumUnit(id).then(
      (result) => current && setState(result),
      () => current && setState({ status: 'error' })
    );
    return () => {
      current = false;
    };
  }, [id, attempt]);

  const retry = () => {
    setState({ status: 'loading' });
    setAttempt((n) => n + 1);
  };

  return [state, retry] as const;
}

/**
 * The units `progress` is reviewed in (`reviewUnits`); undefined until they are first known. The
 * last known stay while new progress is worked out, so a count shown does not blink.
 */
export function useReviewUnits(progress: Progress | undefined): readonly Unit[] | undefined {
  const [units, setUnits] = useState<readonly Unit[]>();

  useEffect(() => {
    if (!progress) return;
    let current = true;
    reviewUnits(progress).then(
      (next) => current && setUnits(next),
      () => undefined
    );
    return () => {
      current = false;
    };
  }, [progress]);

  return units;
}
