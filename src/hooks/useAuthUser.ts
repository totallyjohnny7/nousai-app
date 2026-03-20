/**
 * useAuthUser — lightweight Firebase auth state hook.
 * Returns the current authenticated user (uid, email) without
 * duplicating auth logic scattered across SettingsPage etc.
 */

import { useState, useEffect } from 'react';
import { onAuthChange } from '../utils/auth';
import type { AuthUser } from '../utils/auth';

export interface AuthUserState {
  uid: string | null;
  user: AuthUser | null;
  loading: boolean;
}

export function useAuthUser(): AuthUserState {
  const [state, setState] = useState<AuthUserState>({ uid: null, user: null, loading: true });

  useEffect(() => {
    let cleanup: (() => void) | null = null;

    onAuthChange((user) => {
      setState({ uid: user?.uid ?? null, user, loading: false });
    }).then((unsub) => {
      cleanup = unsub;
    });

    return () => {
      cleanup?.();
    };
  }, []);

  return state;
}
