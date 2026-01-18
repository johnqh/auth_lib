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
  getFirebaseConfig,
  isFirebaseConfigured,
} from './config';

export type {
  FirebaseConfig,
  FirebaseInitOptions,
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

// Admin
export { parseAdminEmails, isAdminEmail, createAdminChecker } from './admin';
