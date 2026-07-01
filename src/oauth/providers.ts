/**
 * @fileoverview Built-in OAuth provider descriptors for the public-client PKCE
 * desktop flow. Add new providers here; each app supplies only its client id.
 *
 * Note: "Sign in with Apple" is intentionally NOT a PKCE-web descriptor. Apple's
 * token exchange requires a signed-JWT `client_secret` that cannot be minted
 * safely on the client, so it needs a backend. On native platforms Apple is
 * handled via the platform SDK (see the native auth hook), which returns an
 * identity token directly with no token exchange.
 */

import type { OAuthProviderDescriptor } from './pkce';

/** Google — OIDC, returns `id_token`. Redirect scheme = the reversed client id. */
export const GOOGLE_OAUTH_PROVIDER: OAuthProviderDescriptor = {
  id: 'google.com',
  authorizeEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
  scope: 'openid email profile',
  authParams: { prompt: 'select_account' },
  returnsIdToken: true,
};

/** GitHub — not OIDC; the Firebase credential is built from the `access_token`. */
export const GITHUB_OAUTH_PROVIDER: OAuthProviderDescriptor = {
  id: 'github.com',
  authorizeEndpoint: 'https://github.com/login/oauth/authorize',
  tokenEndpoint: 'https://github.com/login/oauth/access_token',
  scope: 'read:user user:email',
  returnsIdToken: false,
};

/** Microsoft (common tenant) — OIDC, returns `id_token`. */
export const MICROSOFT_OAUTH_PROVIDER: OAuthProviderDescriptor = {
  id: 'microsoft.com',
  authorizeEndpoint:
    'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
  tokenEndpoint: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
  scope: 'openid email profile',
  returnsIdToken: true,
};
