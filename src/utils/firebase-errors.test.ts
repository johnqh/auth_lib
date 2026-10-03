import { describe, expect, it } from 'vitest';
import {
  formatFirebaseError,
  getFirebaseErrorCode,
  getFirebaseErrorMessage,
  isFirebaseAuthError,
  isSignInCancelled,
  signInCancelledError,
  SIGN_IN_CANCELLED_CODE,
  withAppleCancel,
} from './firebase-errors';

describe('getFirebaseErrorMessage', () => {
  it('returns correct message for auth/user-not-found', () => {
    expect(getFirebaseErrorMessage('auth/user-not-found')).toBe(
      'No account found with this email'
    );
  });

  it('returns correct message for auth/wrong-password', () => {
    expect(getFirebaseErrorMessage('auth/wrong-password')).toBe(
      'Incorrect password'
    );
  });

  it('returns correct message for auth/invalid-email', () => {
    expect(getFirebaseErrorMessage('auth/invalid-email')).toBe(
      'Invalid email address'
    );
  });

  it('returns correct message for auth/invalid-credential', () => {
    expect(getFirebaseErrorMessage('auth/invalid-credential')).toBe(
      'Invalid email or password'
    );
  });

  it('returns correct message for auth/email-already-in-use', () => {
    expect(getFirebaseErrorMessage('auth/email-already-in-use')).toBe(
      'An account with this email already exists'
    );
  });

  it('returns correct message for auth/weak-password', () => {
    expect(getFirebaseErrorMessage('auth/weak-password')).toBe(
      'Password must be at least 6 characters'
    );
  });

  it('returns correct message for auth/too-many-requests', () => {
    expect(getFirebaseErrorMessage('auth/too-many-requests')).toBe(
      'Too many attempts. Please try again later.'
    );
  });

  it('returns correct message for auth/network-request-failed', () => {
    expect(getFirebaseErrorMessage('auth/network-request-failed')).toBe(
      'Network error. Please check your connection.'
    );
  });

  it('returns correct message for auth/popup-closed-by-user', () => {
    expect(getFirebaseErrorMessage('auth/popup-closed-by-user')).toBe(
      'Sign in cancelled'
    );
  });

  it('returns correct message for auth/popup-blocked', () => {
    expect(getFirebaseErrorMessage('auth/popup-blocked')).toBe(
      'Popup blocked. Please allow popups for this site.'
    );
  });

  it('returns correct message for auth/account-exists-with-different-credential', () => {
    expect(
      getFirebaseErrorMessage('auth/account-exists-with-different-credential')
    ).toBe(
      'An account already exists with this email using a different sign-in method.'
    );
  });

  it('returns correct message for auth/operation-not-allowed', () => {
    expect(getFirebaseErrorMessage('auth/operation-not-allowed')).toBe(
      'This sign-in method is not enabled.'
    );
  });

  it('returns default message for unknown error code', () => {
    expect(getFirebaseErrorMessage('auth/unknown-error')).toBe(
      'Something went wrong. Please try again.'
    );
  });

  it('returns default message for empty string', () => {
    expect(getFirebaseErrorMessage('')).toBe(
      'Something went wrong. Please try again.'
    );
  });
});

describe('getFirebaseErrorCode', () => {
  it('extracts code from error object with code property', () => {
    const error = { code: 'auth/user-not-found', message: 'User not found' };
    expect(getFirebaseErrorCode(error)).toBe('auth/user-not-found');
  });

  it('returns empty string for error without code property', () => {
    const error = { message: 'Some error' };
    expect(getFirebaseErrorCode(error)).toBe('');
  });

  it('returns empty string for null', () => {
    expect(getFirebaseErrorCode(null)).toBe('');
  });

  it('returns empty string for undefined', () => {
    expect(getFirebaseErrorCode(undefined)).toBe('');
  });

  it('returns empty string for string', () => {
    expect(getFirebaseErrorCode('some error')).toBe('');
  });

  it('returns empty string for number', () => {
    expect(getFirebaseErrorCode(123)).toBe('');
  });

  it('returns empty string for empty object', () => {
    expect(getFirebaseErrorCode({})).toBe('');
  });
});

describe('formatFirebaseError', () => {
  it('formats error with known code', () => {
    const error = { code: 'auth/user-not-found' };
    expect(formatFirebaseError(error)).toBe('No account found with this email');
  });

  it('formats error with unknown code', () => {
    const error = { code: 'auth/unknown' };
    expect(formatFirebaseError(error)).toBe(
      'Something went wrong. Please try again.'
    );
  });

  it('formats error without code', () => {
    const error = { message: 'Some error' };
    expect(formatFirebaseError(error)).toBe(
      'Something went wrong. Please try again.'
    );
  });

  it('formats null error', () => {
    expect(formatFirebaseError(null)).toBe(
      'Something went wrong. Please try again.'
    );
  });
});

describe('isFirebaseAuthError', () => {
  it('returns true for auth errors', () => {
    const error = { code: 'auth/user-not-found' };
    expect(isFirebaseAuthError(error)).toBe(true);
  });

  it('returns true for any auth/ prefixed code', () => {
    const error = { code: 'auth/custom-error' };
    expect(isFirebaseAuthError(error)).toBe(true);
  });

  it('returns false for non-auth errors', () => {
    const error = { code: 'storage/object-not-found' };
    expect(isFirebaseAuthError(error)).toBe(false);
  });

  it('returns false for errors without code', () => {
    const error = { message: 'Some error' };
    expect(isFirebaseAuthError(error)).toBe(false);
  });

  it('returns false for null', () => {
    expect(isFirebaseAuthError(null)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(isFirebaseAuthError(undefined)).toBe(false);
  });
});

describe('sign-in cancelled', () => {
  it('rejects with a code every sign-in form treats as backing out', () => {
    const error = signInCancelledError();
    expect(error.code).toBe(SIGN_IN_CANCELLED_CODE);
    expect(SIGN_IN_CANCELLED_CODE).toBe('auth/user-cancelled');
    expect(isSignInCancelled(error)).toBe(true);
    expect(formatFirebaseError(error)).toBe('Sign in cancelled');
  });

  it('counts the popup flow’s own cancels, and nothing else', () => {
    expect(isSignInCancelled({ code: 'auth/popup-closed-by-user' })).toBe(true);
    expect(isSignInCancelled({ code: 'auth/wrong-password' })).toBe(false);
    expect(isSignInCancelled(new Error('boom'))).toBe(false);
  });

  it('turns a closed Apple sheet into that rejection, on either platform', async () => {
    for (const code of ['1001', 'SIGNIN_CANCELLED']) {
      await expect(
        withAppleCancel(() => Promise.reject({ code }))
      ).rejects.toMatchObject({ code: SIGN_IN_CANCELLED_CODE });
    }
    // Some versions put the code in the message.
    await expect(
      withAppleCancel(() => Promise.reject(new Error('1001')))
    ).rejects.toMatchObject({ code: SIGN_IN_CANCELLED_CODE });
  });

  it('passes any other Apple failure, and any result, through', async () => {
    const failure = { code: '1000' };
    await expect(withAppleCancel(() => Promise.reject(failure))).rejects.toBe(
      failure
    );
    await expect(withAppleCancel(async () => 'token')).resolves.toBe('token');
  });
});
