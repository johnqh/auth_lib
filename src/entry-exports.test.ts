import { describe, expect, it } from 'vitest';
import * as web from './index';
import * as rn from './index.rn';

// The helpers apps need to tell a closed sheet from a failure have to be
// reachable from the package's entries, not only from `utils/` — which the
// exports map does not publish.
describe('entry exports', () => {
  it.each([
    ['web', web],
    ['react-native', rn],
  ])('%s entry exports the sign-in-cancelled helpers', (_, entry) => {
    expect(typeof entry.isSignInCancelled).toBe('function');
    expect(typeof entry.signInCancelledError).toBe('function');
    expect(entry.SIGN_IN_CANCELLED_CODE).toBe('auth/user-cancelled');
  });
});
