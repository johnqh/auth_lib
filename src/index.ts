/**
 * @fileoverview @sudobility/auth_lib - Firebase authentication utilities
 *
 * This library provides:
 * - Configurable Firebase Auth initialization
 * - Network client with automatic 401 token refresh and 403 logout handling
 * - Firebase error message utilities
 */

// Config
export {
  initializeFirebaseAuth,
  getFirebaseApp,
  getFirebaseAuth,
  isFirebaseConfigured,
} from './config';

export type {
  FirebaseInitResult,
  FirebaseAuthNetworkClientOptions,
} from './config';

// Hooks
export { useFirebaseAuthNetworkClient } from './hooks';

export {
  useSiteAdmin,
  siteAdminQueryKey,
  type UseSiteAdminOptions,
  type UseSiteAdminResult,
  type UserInfoResponse,
} from './hooks';

// Utils
export {
  getFirebaseErrorMessage,
  getFirebaseErrorCode,
  formatFirebaseError,
  isFirebaseAuthError,
} from './utils';

// Network
export {
  FirebaseAuthNetworkService,
  type FirebaseAuthNetworkServiceOptions,
} from './network';

// Admin
export { parseAdminEmails, isAdminEmail, createAdminChecker } from './admin';
