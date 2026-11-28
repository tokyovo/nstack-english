import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { createProgressStore, LOCAL_PROFILE_ID, type Progress } from './index';

export type ProgressState =
  | { status: 'loading' }
  | { status: 'ready'; progress: Progress }
  | { status: 'error' };

/** The profile's saved progress, read again each time the screen comes into view. */
export function useProgress(profileId: string = LOCAL_PROFILE_ID): ProgressState {
  const [state, setState] = useState<ProgressState>({ status: 'loading' });

  useFocusEffect(
    useCallback(() => {
      let current = true;
      createProgressStore()
        .load(profileId)
        .then(
          (progress) => current && setState({ status: 'ready', progress }),
          () => current && setState({ status: 'error' })
        );
      return () => {
        current = false;
      };
    }, [profileId])
  );

  return state;
}
