import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { loadAccount, type AccountState } from './index';

/**
 * The account on this device, read again each time the screen comes into view.
 * `setAccount` lets a screen show the result of signing in or out straight away.
 */
export function useAccount() {
  const [account, setAccount] = useState<AccountState>({ status: 'loading' });

  useFocusEffect(
    useCallback(() => {
      let current = true;
      loadAccount().then(
        (state) => current && setAccount(state),
        () => current && setAccount({ status: 'signedOut' })
      );
      return () => {
        current = false;
      };
    }, [])
  );

  return [account, setAccount] as const;
}
