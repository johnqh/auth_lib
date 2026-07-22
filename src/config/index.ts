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
  isFirebaseReachable,
  rewriteFirebaseProxyUrl,
  getFirebaseProxyOrigin,
} from './firebase-proxy';

export type {
  FirebaseInitResult,
  FirebaseAuthNetworkClientOptions,
} from './types';
