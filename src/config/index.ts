/**
 * @fileoverview Config exports
 */

export {
  initializeFirebaseAuth,
  getFirebaseApp,
  getFirebaseAuth,
  isFirebaseConfigured,
} from './firebase-init';

export {
  installFirebaseProxy,
  forceFirebaseProxy,
  disableFirebaseProxy,
  autoConfigureFirebaseProxy,
  isFirebaseReachable,
  isLikelyChinaRegion,
  rewriteFirebaseProxyUrl,
  getFirebaseProxyOrigin,
  DEFAULT_FIREBASE_PROXY_ORIGIN,
  type AutoConfigureFirebaseProxyOptions,
} from './firebase-proxy';

export type {
  FirebaseInitResult,
  FirebaseAuthNetworkClientOptions,
} from './types';
