/**
 * @fileoverview High-level desktop Google sign-in: PKCE system-browser flow →
 * Firebase JS-SDK credential. Drop-in replacement for each app's copied
 * `services/googleAuth.ts` `signInWithGoogleOAuth`.
 */

import type { OAuthCredential } from 'firebase/auth';
import { GOOGLE_OAUTH_PROVIDER } from './providers';
import { buildGoogleCredential } from './credentials';
import {
  type OAuthClientConfig,
  signInWithOAuthPkce,
  type WebAuthBridge,
} from './webAuthFlow';

const GOOGLE_CLIENT_ID_SUFFIX = '.apps.googleusercontent.com';
const GOOGLE_REVERSED_CLIENT_ID_PREFIX = 'com.googleusercontent.apps.';

/**
 * A Google OAuth client id's reversed form — the URL scheme Google redirects
 * back to, what Google Cloud Console shows as the "iOS URL scheme":
 * `<id>.apps.googleusercontent.com` becomes `com.googleusercontent.apps.<id>`.
 * Derived rather than configured: it is the same id spelled backwards, and a
 * second value for it in every app's `.env` was one more thing to copy and
 * get out of step. Empty for an empty id, and for one that is not a Google
 * client id at all, so an unconfigured or mistyped client still means "not
 * offered" rather than a scheme nothing answers.
 */
export function reversedGoogleClientId(clientId: string): string {
  if (!clientId.endsWith(GOOGLE_CLIENT_ID_SUFFIX)) return '';
  const id = clientId.slice(0, -GOOGLE_CLIENT_ID_SUFFIX.length);
  return id === '' ? '' : GOOGLE_REVERSED_CLIENT_ID_PREFIX + id;
}

/**
 * Desktop Google sign-in via the system browser (macOS/Windows). Returns a
 * Firebase credential to pass to `signInWithCredential`, or `null` if the user
 * cancelled.
 */
export async function signInWithGoogleOAuthDesktop(
  config: OAuthClientConfig,
  webAuth: WebAuthBridge
): Promise<OAuthCredential | null> {
  const tokens = await signInWithOAuthPkce(
    GOOGLE_OAUTH_PROVIDER,
    config,
    webAuth
  );
  if (!tokens) return null; // cancelled
  if (!tokens.id_token) throw new Error('No id_token in Google token response');
  return buildGoogleCredential(tokens.id_token);
}
