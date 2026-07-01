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
