/**
 * @fileoverview React hook wrapping filterAuthProvidersForProxy with the
 * async proxy-detection lifecycle.
 */

import { useEffect, useMemo, useState } from 'react';
import { firebaseProxyReady, isFirebaseProxyActive } from '@sudobility/di';
import { filterAuthProvidersForProxy } from '../config/firebase-proxy-providers';

/**
 * The client app's configured auth providers, narrowed for the current proxy
 * state (see filterAuthProvidersForProxy). Renders with the instant verdict
 * (cache / timezone heuristic / force) and re-renders once the reachability
 * probe finalizes the routing decision.
 *
 * @param providers - Provider ids as configured by the client app
 * @returns The filtered provider list
 */
export function useProxyFilteredAuthProviders<T extends string>(
  providers: readonly T[]
): T[] {
  const [proxyActive, setProxyActive] = useState(() => isFirebaseProxyActive());

  useEffect(() => {
    let cancelled = false;
    void firebaseProxyReady().then(() => {
      if (!cancelled) {
        setProxyActive(isFirebaseProxyActive());
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return useMemo(
    () => filterAuthProvidersForProxy(providers, proxyActive),
    [providers, proxyActive]
  );
}
