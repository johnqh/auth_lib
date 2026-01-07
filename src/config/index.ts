/**
 * @fileoverview Config exports
 */

export {
  initializeFirebaseAuth,
  getFirebaseApp,
  getFirebaseAuth,
  getFirebaseConfig,
  isFirebaseConfigured,
} from './firebase-init';

export type {
  FirebaseConfig,
  FirebaseInitOptions,
  FirebaseInitResult,
  FirebaseAuthNetworkClientOptions,
} from './types';
