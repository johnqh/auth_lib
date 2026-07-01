/**
 * @fileoverview Firebase JS-SDK credential builders (desktop/web/macOS/Windows).
 * The RN-native counterpart lives in `credentials.rn.ts`; both are reached only
 * through the `@sudobility/auth_lib/oauth` subpath so macOS gets this JS build.
 */

import {
  GoogleAuthProvider,
  type OAuthCredential,
  OAuthProvider,
} from 'firebase/auth';

/** Build a Firebase Google credential from an OIDC id token. */
export function buildGoogleCredential(idToken: string): OAuthCredential {
  return GoogleAuthProvider.credential(idToken);
}

/** Build a Firebase Apple credential from an identity token (+ raw nonce). */
export function buildAppleCredential(args: {
  idToken: string;
  rawNonce?: string;
}): OAuthCredential {
  const provider = new OAuthProvider('apple.com');
  const params: { idToken: string; rawNonce?: string } = {
    idToken: args.idToken,
  };
  if (args.rawNonce !== undefined) params.rawNonce = args.rawNonce;
  return provider.credential(params);
}

/**
 * Build a generic Firebase OAuth credential for an arbitrary provider id from
 * whatever tokens the flow yielded (id token for OIDC providers, access token
 * for the rest).
 */
export function buildOAuthCredential(
  providerId: string,
  tokens: { idToken?: string; accessToken?: string; rawNonce?: string }
): OAuthCredential {
  const provider = new OAuthProvider(providerId);
  const params: { idToken?: string; accessToken?: string; rawNonce?: string } =
    {};
  if (tokens.idToken !== undefined) params.idToken = tokens.idToken;
  if (tokens.accessToken !== undefined) params.accessToken = tokens.accessToken;
  if (tokens.rawNonce !== undefined) params.rawNonce = tokens.rawNonce;
  return provider.credential(params);
}
