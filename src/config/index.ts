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
  setFirebaseProxy,
  getFirebaseProxyOrigin,
  isFirebaseProxyActive,
  firebaseProxyReady,
  disableFirebaseProxy,
  rewriteFirebaseProxyUrl,
} from '@sudobility/di';

export { filterAuthProvidersForProxy } from './firebase-proxy-providers';

export type {
  FirebaseInitResult,
  FirebaseAuthNetworkClientOptions,
} from './types';
