/**
 * @fileoverview Barrel for the sign-in module: Google and Apple sign-in on
 * Firebase's JS SDK in a React Native app, on every platform it ships to.
 * Exposed via the `@sudobility/auth_lib/signin` subpath, beside `/oauth`.
 * Platform-neutral — the platform and the native modules are passed in — so
 * it resolves the same everywhere and a web bundle never sees native code.
 */

export * from './config';
export * from './credentials';
export * from './firebase-js-auth';
export * from './firebase-config';
// Telling a closed sheet from a failure, for an app's own sign-in wrapper.
// Here as well as on the main entry because this subpath is Firebase-native
// free: the React Native main entry re-exports code that `require`s
// `@react-native-firebase/auth`, which Metro resolves at bundle time and
// fails on in an app that does not install it.
export {
  isSignInCancelled,
  signInCancelledError,
  SIGN_IN_CANCELLED_CODE,
} from '../utils/firebase-errors';
