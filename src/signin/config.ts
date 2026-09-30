/**
 * @fileoverview What a React Native app needs, per platform, to offer Google
 * and Apple sign-in on Firebase's JS SDK — and whether it has it.
 *
 * The rules are pure functions of the platform and the configuration, so an
 * app maps its own environment names onto `SignInConfig` (the family's are
 * `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_WEB_CLIENT_ID`, `APPLE_SERVICE_ID`,
 * `APPLE_REDIRECT_URI`) and asks. A button for a way that cannot work is
 * worse than no button: it is offered, pressed, and fails. So each is offered
 * only where the platform can do it *and* the build was given what it needs.
 */

import { reversedGoogleClientId } from '../oauth/google';

/** `Platform.OS`, narrowed to what this module distinguishes. */
export type SignInPlatform = 'ios' | 'android' | 'macos' | 'windows' | 'web';

export interface SignInConfig {
  /**
   * The Firebase project's **iOS-type** OAuth client. Read on iOS (Google's
   * SDK) and on macOS and Windows (the system-browser PKCE flow, whose
   * redirect scheme is the client's reversed form, derived). On iOS its
   * reversed form must also be a URL scheme in `Info.plist`.
   */
  googleIosClientId: string;
  /**
   * The project's **web-type** OAuth client. Read on Android only: Google's
   * Android SDK mints an ID token for a web client, never for the Android
   * client, which Play Services resolves from the package name and signing
   * key on its own.
   */
  googleWebClientId: string;
  /**
   * Sign in with Apple on Android is Apple's web flow, and needs the
   * Services ID and the redirect registered for it. iOS needs neither — it
   * needs the capability on the App ID. The desktops are offered no Apple.
   */
  appleServiceId: string;
  appleRedirectUri: string;
}

export function isDesktopPlatform(platform: SignInPlatform): boolean {
  return platform === 'macos' || platform === 'windows';
}

/** Whether Google sign-in can be offered on this platform with this config. */
export function googleSignInAvailable(
  platform: SignInPlatform,
  config: SignInConfig
): boolean {
  if (isDesktopPlatform(platform) || platform === 'ios') {
    // Not merely non-empty: a client whose reversed form cannot be derived
    // has no redirect scheme, and the flow would open Google and never
    // come back.
    return reversedGoogleClientId(config.googleIosClientId) !== '';
  }
  if (platform === 'android') return config.googleWebClientId !== '';
  return false;
}

/** Whether Sign in with Apple can be offered on this platform with this config. */
export function appleSignInAvailable(
  platform: SignInPlatform,
  config: SignInConfig
): boolean {
  if (platform === 'ios') return true;
  if (platform === 'android') {
    return config.appleServiceId !== '' && config.appleRedirectUri !== '';
  }
  return false;
}
