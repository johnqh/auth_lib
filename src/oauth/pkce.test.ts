import { describe, it, expect } from 'vitest';
import {
  buildFormBody,
  parseCallbackParams,
  buildAuthorizeUrl,
  type OAuthProviderDescriptor,
} from './pkce';

const PROVIDER: OAuthProviderDescriptor = {
  id: 'google.com',
  authorizeEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
  scope: 'openid email profile',
  authParams: { prompt: 'select_account' },
  returnsIdToken: true,
};

describe('buildFormBody', () => {
  it('url-encodes keys and values', () => {
    expect(buildFormBody({ a: '1', b: 'c d', 'x/y': 'z&w' })).toBe(
      'a=1&b=c%20d&x%2Fy=z%26w'
    );
  });
  it('returns empty string for no params', () => {
    expect(buildFormBody({})).toBe('');
  });
});

describe('parseCallbackParams', () => {
  it('parses query params from a callback url', () => {
    expect(
      parseCallbackParams('myscheme:/oauth2callback?code=abc&state=xyz')
    ).toEqual({
      code: 'abc',
      state: 'xyz',
    });
  });
  it('decodes percent-encoded values', () => {
    expect(
      parseCallbackParams(
        'x://cb?error=access_denied&error_description=User%20said%20no'
      )
    ).toEqual({
      error: 'access_denied',
      error_description: 'User said no',
    });
  });
  it('keeps "=" inside values', () => {
    expect(parseCallbackParams('x://cb?code=a=b=c')).toEqual({ code: 'a=b=c' });
  });
  it('returns empty object when there is no query string', () => {
    expect(parseCallbackParams('x://cb')).toEqual({});
  });
});

describe('buildAuthorizeUrl', () => {
  it('includes PKCE S256 params, scope, and static auth params', () => {
    const url = buildAuthorizeUrl(PROVIDER, {
      clientId: 'CLIENT',
      redirectUri: 'com.example:/oauth2callback',
      codeChallenge: 'CHALLENGE',
    });
    expect(
      url.startsWith('https://accounts.google.com/o/oauth2/v2/auth?')
    ).toBe(true);
    expect(url).toContain('client_id=CLIENT');
    expect(url).toContain('redirect_uri=com.example%3A%2Foauth2callback');
    expect(url).toContain('response_type=code');
    expect(url).toContain('scope=openid%20email%20profile');
    expect(url).toContain('code_challenge=CHALLENGE');
    expect(url).toContain('code_challenge_method=S256');
    expect(url).toContain('prompt=select_account');
  });
});
