import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';

import { onSessionChange } from '@/account';

import { loadPlan, loadPremiumUnit, type Plan, type PremiumUnitResult } from './index';

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
