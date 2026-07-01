/**
 * @fileoverview React context factory around a Firebase-auth hook. Lets each
 * app collapse its `AuthContext.{tsx,ios,android}` to a few lines: pick the
 * platform hook variant, pass config, get back `{ AuthProvider, useAuth }`.
 * Uses `createElement` (no JSX) so auth_lib needs no JSX build config.
 */

import {
  createContext,
  createElement,
  type ReactNode,
  useContext,
} from 'react';
import type { AuthContextValue, FirebaseAuthConfig } from './types';

export interface FirebaseAuthContext {
  AuthProvider: (props: { children: ReactNode }) => ReactNode;
  useAuth: () => AuthContextValue;
}

/**
 * Build an `{ AuthProvider, useAuth }` pair backed by the given hook variant
 * (`useFirebaseAuthJs` or `useFirebaseAuthNative`) and config. Each platform's
 * context file calls this once; Metro's `.ios`/`.android`/base resolution
 * ensures exactly one context is live per build.
 */
export function createFirebaseAuthContext(
  useAuthHook: (config: FirebaseAuthConfig) => AuthContextValue,
  config: FirebaseAuthConfig
): FirebaseAuthContext {
  const Context = createContext<AuthContextValue | null>(null);

  function AuthProvider({ children }: { children: ReactNode }): ReactNode {
    const value = useAuthHook(config);
    return createElement(Context.Provider, { value }, children);
  }

  function useAuth(): AuthContextValue {
    const ctx = useContext(Context);
    if (!ctx) {
      throw new Error('useAuth must be used within an AuthProvider');
    }
    return ctx;
  }

  return { AuthProvider, useAuth };
}
