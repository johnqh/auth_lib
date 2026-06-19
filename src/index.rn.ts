/**
 * @fileoverview @sudobility/auth_lib - Firebase authentication utilities (React Native)
 *
 * This is the React Native entry point that uses @react-native-firebase.
 */

// Config (RN version)
export {
  initializeFirebaseAuth,
  getFirebaseApp,
  getFirebaseAuth,
  isFirebaseConfigured,
} from './config/firebase-init.rn.js';

export type {
  FirebaseInitResult,
  FirebaseAuthNetworkClientOptions,
} from './config/types.js';

// Hooks - these are React hooks that work on both platforms.
// useFirebaseAuthNetworkClient is platform-agnostic: it resolves the Firebase
// auth/sign-out via firebase-init (.rn here) and the transport via
// @sudobility/di (RN build), so it works with @react-native-firebase.
export {
  useFirebaseAuthNetworkClient,
  createFirebaseAuthNetworkClient,
} from './hooks/index.js';

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
