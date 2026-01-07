/**
 * @fileoverview Firebase authentication error utilities
 */

/** Map of Firebase auth error codes to user-friendly messages */
const FIREBASE_ERROR_MESSAGES: Record<string, string> = {
  'auth/user-not-found': 'No account found with this email',
  'auth/wrong-password': 'Incorrect password',
  'auth/invalid-email': 'Invalid email address',
  'auth/invalid-credential': 'Invalid email or password',
  'auth/email-already-in-use': 'An account with this email already exists',
  'auth/weak-password': 'Password must be at least 6 characters',
  'auth/too-many-requests': 'Too many attempts. Please try again later.',
  'auth/network-request-failed': 'Network error. Please check your connection.',
  'auth/popup-closed-by-user': 'Sign in cancelled',
  'auth/popup-blocked': 'Popup blocked. Please allow popups for this site.',
  'auth/account-exists-with-different-credential':
    'An account already exists with this email using a different sign-in method.',
  'auth/operation-not-allowed': 'This sign-in method is not enabled.',
};

/**
 * Get user-friendly error message from Firebase error code
 *
 * @param code - Firebase error code (e.g., 'auth/user-not-found')
 * @returns User-friendly error message
 */
export function getFirebaseErrorMessage(code: string): string {
  return (
    FIREBASE_ERROR_MESSAGES[code] ?? 'Something went wrong. Please try again.'
  );
}

/**
 * Extract error code from Firebase error
 *
 * @param error - Error object from Firebase
 * @returns Error code string or empty string if not found
 */
export function getFirebaseErrorCode(error: unknown): string {
  if (error && typeof error === 'object' && 'code' in error) {
    return (error as { code: string }).code;
  }
  return '';
}

/**
 * Get user-friendly message from Firebase error object
 *
 * @param error - Error object from Firebase
 * @returns User-friendly error message
 */
export function formatFirebaseError(error: unknown): string {
  const code = getFirebaseErrorCode(error);
  return getFirebaseErrorMessage(code);
}

/**
 * Check if an error is a Firebase auth error
 *
 * @param error - Error object to check
 * @returns True if the error is a Firebase auth error
 */
export function isFirebaseAuthError(error: unknown): boolean {
  const code = getFirebaseErrorCode(error);
  return code.startsWith('auth/');
}
