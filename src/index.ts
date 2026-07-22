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

// Reverse-proxy shim (web only) for regions where googleapis.com is blocked.
// installFirebaseProxy() must run BEFORE Firebase is initialized.
export {
  installFirebaseProxy,
  isFirebaseReachable,
  rewriteFirebaseProxyUrl,
  getFirebaseProxyOrigin,
} from './config';

export type {
  FirebaseInitResult,
  FirebaseAuthNetworkClientOptions,
} from './config';

// Hooks
export {
  useFirebaseAuthNetworkClient,
  createFirebaseAuthNetworkClient,
} from './hooks';

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

// Account management
export { deleteAccount, type DeleteAccountOptions } from './account';

// Admin
export { parseAdminEmails, isAdminEmail, createAdminChecker } from './admin';
