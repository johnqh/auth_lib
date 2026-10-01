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
