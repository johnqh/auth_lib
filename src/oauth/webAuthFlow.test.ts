import { describe, it, expect, vi, afterEach } from 'vitest';
import { signInWithOAuthPkce, type WebAuthBridge } from './webAuthFlow';
import { GOOGLE_OAUTH_PROVIDER } from './providers';

function makeBridge(callbackUrl: string | null): WebAuthBridge {
  return {
    authenticate: vi.fn(async () => callbackUrl),
    generateCodeVerifier: vi.fn(async () => 'VERIFIER'),
    sha256Base64Url: vi.fn(async () => 'CHALLENGE'),
  };
}

const CONFIG = { clientId: 'CLIENT', reversedClientId: 'com.example.app' };

describe('signInWithOAuthPkce', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('runs the happy path: builds the authorize URL, exchanges the code, returns tokens', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        id_token: 'ID',
        access_token: 'ACCESS',
        expires_in: 3600,
        token_type: 'Bearer',
      }),
    }));
    vi.stubGlobal('fetch', fetchMock);
    const bridge = makeBridge('com.example.app:/oauth2callback?code=AUTH_CODE');

    const tokens = await signInWithOAuthPkce(
      GOOGLE_OAUTH_PROVIDER,
      CONFIG,
      bridge
    );

    expect(tokens?.id_token).toBe('ID');

    // authorize URL carries the S256 challenge and the derived redirect scheme
    const [authUrl, scheme] = (bridge.authenticate as ReturnType<typeof vi.fn>)
      .mock.calls[0];
    expect(authUrl).toContain('code_challenge=CHALLENGE');
    expect(authUrl).toContain('code_challenge_method=S256');
    expect(scheme).toBe('com.example.app');

    // token exchange posts the verifier + code to the provider token endpoint
    const [tokenUrl, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(tokenUrl).toBe(GOOGLE_OAUTH_PROVIDER.tokenEndpoint);
    expect(String(init.body)).toContain('code_verifier=VERIFIER');
    expect(String(init.body)).toContain('code=AUTH_CODE');
    expect(String(init.body)).toContain(
      'redirect_uri=com.example.app%3A%2Foauth2callback'
    );
  });

  it('returns null (and never exchanges) when the user cancels', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const bridge = makeBridge(null);

    const tokens = await signInWithOAuthPkce(
      GOOGLE_OAUTH_PROVIDER,
      CONFIG,
      bridge
    );

    expect(tokens).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('throws when the callback carries an error param', async () => {
    vi.stubGlobal('fetch', vi.fn());
    const bridge = makeBridge(
      'com.example.app:/oauth2callback?error=access_denied&error_description=nope'
    );

    await expect(
      signInWithOAuthPkce(GOOGLE_OAUTH_PROVIDER, CONFIG, bridge)
    ).rejects.toThrow(/access_denied/);
  });

  it('throws when the callback has no authorization code', async () => {
    vi.stubGlobal('fetch', vi.fn());
    const bridge = makeBridge('com.example.app:/oauth2callback?state=xyz');

    await expect(
      signInWithOAuthPkce(GOOGLE_OAUTH_PROVIDER, CONFIG, bridge)
    ).rejects.toThrow(/No authorization code/);
  });

  it('throws when the client is not configured', async () => {
    const bridge = makeBridge('x');
    await expect(
      signInWithOAuthPkce(GOOGLE_OAUTH_PROVIDER, { clientId: '' }, bridge)
    ).rejects.toThrow(/not configured/);
  });

  it('throws with the status when the token endpoint fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 400,
        text: async () => 'invalid_grant',
      }))
    );
    const bridge = makeBridge('com.example.app:/oauth2callback?code=AUTH_CODE');

    await expect(
      signInWithOAuthPkce(GOOGLE_OAUTH_PROVIDER, CONFIG, bridge)
    ).rejects.toThrow(/Token exchange failed \(400\)/);
  });
});
