/**
 * @fileoverview @sudobility/auth_lib - Firebase authentication utilities (React Native)
 *
 * This is the React Native entry point that uses @react-native-firebase.
 */

// Reverse-proxy shim for regions where googleapis.com is blocked.
export {
  setFirebaseProxy,
  getFirebaseProxyOrigin,
  isFirebaseProxyActive,
  firebaseProxyReady,
  forceFirebaseProxy,
  disableFirebaseProxy,
  installFirebaseProxy,
  rewriteFirebaseProxyUrl,
  isFirebaseReachable,
  isLikelyChinaRegion,
} from '@sudobility/di';

export { filterAuthProvidersForProxy } from './config/firebase-proxy-providers.js';

// Config (RN version)
export {
  initializeFirebaseAuth,
  getFirebaseApp,
  getFirebaseAuth,
  isFirebaseConfigured,
} from './config/firebase-init.native.js';

export type {
  FirebaseInitResult,
  FirebaseAuthNetworkClientOptions,
} from './config/types.js';

// Hooks - these are React hooks that work on both platforms.
export { useProxyFilteredAuthProviders } from './hooks/index.js';

export {
  useSiteAdmin,
  siteAdminQueryKey,
  type UseSiteAdminOptions,
  type UseSiteAdminResult,
  type UserInfoResponse,
} from './hooks/index.js';

// Utils - these are platform-agnostic
export {
  getFirebaseErrorMessage,
  getFirebaseErrorCode,
  formatFirebaseError,
  isFirebaseAuthError,
} from './utils/index.js';

// Network (RN version)
export {
  FirebaseAuthNetworkService,
  type FirebaseAuthNetworkServiceOptions,
} from './network/FirebaseAuthNetworkService.rn.js';

// Account management
export { deleteAccount, type DeleteAccountOptions } from './account/index.js';

// Admin - platform-agnostic
export {
  parseAdminEmails,
  isAdminEmail,
  createAdminChecker,
} from './admin/index.js';
