/**
 * @fileoverview Pure OAuth 2.0 Authorization-Code-with-PKCE helpers.
 * @description No Firebase, no native, no React — just URL/param building and
 * parsing. Shared by the desktop system-browser sign-in flow and unit-testable
 * in isolation.
 */

/** Describes an OAuth 2.0 / OIDC provider for the public-client PKCE flow. */
export interface OAuthProviderDescriptor {
  /** Firebase provider id, e.g. `'google.com'`, `'github.com'`, `'microsoft.com'`. */
  id: string;
  /** Authorization endpoint (where the system browser is sent). */
  authorizeEndpoint: string;
  /** Token endpoint (where the code is exchanged). */
  tokenEndpoint: string;
  /** OAuth scopes, space-delimited. */
  scope: string;
  /** Static extra params appended to the authorize URL (e.g. `{ prompt: 'select_account' }`). */
  authParams?: Record<string, string>;
  /**
   * Whether the token endpoint returns an OIDC `id_token` (Google, Microsoft)
   * vs only an `access_token` (GitHub). Governs how the Firebase credential is
   * built downstream.
   */
  returnsIdToken: boolean;
}

/** Form-url-encode a flat params object. */
export function buildFormBody(params: Record<string, string>): string {
  return Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
}

/** Parse the query string of an OAuth callback URL into a params map. */
export function parseCallbackParams(
  callbackUrl: string
): Record<string, string> {
  const params: Record<string, string> = {};
  const qIndex = callbackUrl.indexOf('?');
  if (qIndex < 0) return params;
  const search = callbackUrl.slice(qIndex + 1);
  for (const pair of search.split('&')) {
    if (!pair) continue;
    const [key, ...rest] = pair.split('=');
    if (key) {
      params[decodeURIComponent(key)] = decodeURIComponent(rest.join('='));
    }
  }
  return params;
}

/** Build the provider's authorize URL for an S256 PKCE request. */
export function buildAuthorizeUrl(
  provider: OAuthProviderDescriptor,
  args: { clientId: string; redirectUri: string; codeChallenge: string }
): string {
  return `${provider.authorizeEndpoint}?${buildFormBody({
    client_id: args.clientId,
    redirect_uri: args.redirectUri,
    response_type: 'code',
    scope: provider.scope,
    code_challenge: args.codeChallenge,
    code_challenge_method: 'S256',
    ...provider.authParams,
  })}`;
}
