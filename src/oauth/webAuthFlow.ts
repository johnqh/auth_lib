/**
 * @fileoverview Desktop OAuth sign-in orchestration over an injected
 * system-browser bridge (macOS/Windows). Firebase-free; returns raw tokens.
 * The native `WebAuth` module (ASWebAuthenticationSession + PKCE crypto) is
 * injected — auth_lib contains no native code.
 */

import type { OAuthProviderDescriptor } from './pkce';
import { buildAuthorizeUrl, buildFormBody, parseCallbackParams } from './pkce';

/**
 * The app-provided native bridge (from `@sudobility/building_blocks_rn`). A
 * narrow structural interface so auth_lib never imports native code.
 */
export interface WebAuthBridge {
  authenticate(url: string, callbackURLScheme: string): Promise<string | null>;
  generateCodeVerifier(): Promise<string>;
  sha256Base64Url(input: string): Promise<string>;
}

export interface OAuthClientConfig {
  clientId: string;
  /**
   * Reversed client id, used as the custom URL scheme and, by default, the
   * redirect base (`${reversedClientId}:/oauth2callback`). Required unless an
   * explicit `redirectUri` + `callbackScheme` are given.
   */
  reversedClientId?: string;
  /** Explicit redirect URI (overrides the derived one). */
  redirectUri?: string;
  /** Explicit callback URL scheme (overrides `reversedClientId`). */
  callbackScheme?: string;
}

export interface OAuthTokenResponse {
  id_token?: string;
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
}

async function exchangeCodeForTokens(
  provider: OAuthProviderDescriptor,
  args: {
    clientId: string;
    code: string;
    codeVerifier: string;
    redirectUri: string;
  }
): Promise<OAuthTokenResponse> {
  const response = await fetch(provider.tokenEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: buildFormBody({
      client_id: args.clientId,
      code: args.code,
      code_verifier: args.codeVerifier,
      grant_type: 'authorization_code',
      redirect_uri: args.redirectUri,
    }),
  });
  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Token exchange failed (${response.status}): ${errorBody}`);
  }
  return response.json() as Promise<OAuthTokenResponse>;
}

/**
 * Run the full authorization-code-with-PKCE flow via the system browser and
 * return the token response, or `null` if the user cancelled.
 */
export async function signInWithOAuthPkce(
  provider: OAuthProviderDescriptor,
  config: OAuthClientConfig,
  webAuth: WebAuthBridge
): Promise<OAuthTokenResponse | null> {
  const scheme = config.callbackScheme ?? config.reversedClientId;
  const redirectUri =
    config.redirectUri ??
    (config.reversedClientId
      ? `${config.reversedClientId}:/oauth2callback`
      : undefined);
  if (!config.clientId || !redirectUri || !scheme) {
    throw new Error(
      'OAuth client not configured (clientId + reversedClientId or redirectUri/callbackScheme required)'
    );
  }

  const codeVerifier = await webAuth.generateCodeVerifier();
  const codeChallenge = await webAuth.sha256Base64Url(codeVerifier);
  const authUrl = buildAuthorizeUrl(provider, {
    clientId: config.clientId,
    redirectUri,
    codeChallenge,
  });

  const callbackUrl = await webAuth.authenticate(authUrl, scheme);
  if (!callbackUrl) return null; // user cancelled

  const params = parseCallbackParams(callbackUrl);
  if (params.error) {
    throw new Error(
      `OAuth error: ${params.error} - ${params.error_description ?? ''}`
    );
  }
  const code = params.code;
  if (!code) throw new Error('No authorization code in callback URL');

  return exchangeCodeForTokens(provider, {
    clientId: config.clientId,
    code,
    codeVerifier,
    redirectUri,
  });
}
