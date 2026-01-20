/**
 * @fileoverview Config exports
 */

export {
  initializeFirebaseAuth,
  getFirebaseApp,
  getFirebaseAuth,
  isFirebaseConfigured,
} from './firebase-init';

export type {
  FirebaseInitResult,
  FirebaseAuthNetworkClientOptions,
} from './types';
