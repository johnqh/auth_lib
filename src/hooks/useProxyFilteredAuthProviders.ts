/**
 * @fileoverview React hook wrapping filterAuthProvidersForProxy with the
 * async proxy-detection lifecycle.
 */

import { useEffect, useMemo, useState } from 'react';
import {
  autoConfigureFirebaseProxy,
  getFirebaseProxyOrigin,
} from '../config/firebase-proxy';
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
  const [proxyActive, setProxyActive] = useState(
    () => getFirebaseProxyOrigin() !== null
  );

  useEffect(() => {
    let cancelled = false;
    void autoConfigureFirebaseProxy().then(() => {
      if (!cancelled) {
        setProxyActive(getFirebaseProxyOrigin() !== null);
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
