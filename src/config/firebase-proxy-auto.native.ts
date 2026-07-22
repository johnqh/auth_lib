/**
 * @fileoverview Import-time side effect (React Native entry): automatically
 * detect whether the Firebase reverse proxy is needed and configure the
 * fetch-level shim.
 *
 * NOTE: on React Native this covers JS fetch-based Firebase traffic only.
 * Native @react-native-firebase SDK traffic cannot be redirected from JS.
 * Escape hatch: globalThis.__SUDOBILITY_FIREBASE_PROXY_DISABLED = true
 * (set before the library is imported).
 */

import { autoConfigureFirebaseProxy } from './firebase-proxy';

declare global {
  var __SUDOBILITY_FIREBASE_PROXY_DISABLED: boolean | undefined;
}

const isReactNative =
  typeof navigator !== 'undefined' &&
  (navigator as { product?: string }).product === 'ReactNative';

if (isReactNative && globalThis.__SUDOBILITY_FIREBASE_PROXY_DISABLED !== true) {
  void autoConfigureFirebaseProxy();
}
