/**
 * @fileoverview Auth-provider filtering for proxied (blocked-region) sessions.
 *
 * When the Firebase reverse proxy is active, the device is (or is simulating)
 * a network where Google is unreachable. Non-Apple OAuth flows cannot work
 * there: the proxy covers Firebase's REST endpoints, but OAuth popups/redirects
 * go to the vendor's own domain (accounts.google.com etc.), which is blocked.
 * Sign in with Apple and email/password keep working, so the client app's
 * configured provider list is narrowed to those.
 */

import { getFirebaseProxyOrigin } from './firebase-proxy';

/** OAuth vendors whose interactive flows are blocked alongside Google. */
const BLOCKED_OAUTH_PROVIDERS: ReadonlySet<string> = new Set([
  'google',
  'facebook',
  'github',
  'twitter',
  'microsoft',
  'yahoo',
]);

/**
 * Narrow a client-configured auth-provider list for the current proxy state:
 * while the proxy is active every OAuth provider except Apple is removed
 * (non-OAuth entries such as 'email' or 'anonymous' always pass through).
 * With the proxy off the list is returned unchanged.
 *
 * @param providers - Provider ids as configured by the client app
 * @param proxyActive - Override for the current proxy state (defaults to
 *   whether a proxy origin is active right now)
 * @returns The filtered list (a new array)
 */
export function filterAuthProvidersForProxy<T extends string>(
  providers: readonly T[],
  proxyActive: boolean = getFirebaseProxyOrigin() !== null
): T[] {
  if (!proxyActive) {
    return [...providers];
  }
  return providers.filter(p => !BLOCKED_OAUTH_PROVIDERS.has(p));
}
