/**
 * @fileoverview Import-time side effect (web entry): automatically detect
 * whether the Firebase reverse proxy is needed and configure it. Runs only
 * in a real browser context; escape hatch:
 * globalThis.__SUDOBILITY_FIREBASE_PROXY_DISABLED = true (set before the
 * library is imported).
 */

import { autoConfigureFirebaseProxy } from './firebase-proxy';

declare global {
  var __SUDOBILITY_FIREBASE_PROXY_DISABLED: boolean | undefined;
}

if (
  typeof window !== 'undefined' &&
  typeof document !== 'undefined' &&
  globalThis.__SUDOBILITY_FIREBASE_PROXY_DISABLED !== true
) {
  void autoConfigureFirebaseProxy();
}
