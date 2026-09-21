/**
 * @fileoverview Tests for the web FirebaseAuthNetworkService token cache.
 *
 * The module caches the Firebase ID token so that bursts of requests do not
 * each hit the SDK. That cache is scoped to the uid it was minted for: after a
 * sign-out and a sign-in as somebody else, the next request must carry the new
 * user's token, otherwise the backend answers with the previous user's data.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockSuperRequest = vi.fn();

/** The signed-in user the mocked Firebase auth reports; null when signed out. */
let currentUser: { uid: string; getIdToken: ReturnType<typeof vi.fn> } | null =
  null;

vi.mock('@sudobility/di', () => ({
  WebNetworkClient: class {
    constructor(_timeout?: number) {}
    async request(url: string, options?: unknown): Promise<unknown> {
      return mockSuperRequest(url, options);
    }
  },
}));

vi.mock('../config/firebase-init', () => ({
  getFirebaseAuth: () => ({
    get currentUser() {
      return currentUser;
    },
  }),
}));

import { FirebaseAuthNetworkService } from './FirebaseAuthNetworkService';

/** A signed-in user whose getIdToken always mints a token naming them. */
function signIn(uid: string) {
  currentUser = {
    uid,
    getIdToken: vi.fn(() => Promise.resolve(`${uid}-token`)),
  };
}

/** The Authorization header of the nth call to the underlying client. */
function authHeaderOf(callIndex: number): string | undefined {
  const [, options] = mockSuperRequest.mock.calls[callIndex] as [
    string,
    { headers: Record<string, string> },
  ];
  return options.headers['Authorization'];
}

describe('FirebaseAuthNetworkService (web) token cache', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSuperRequest.mockResolvedValue({ ok: true, status: 200 });
  });

  it('sends the new user token right after an account switch', async () => {
    const service = new FirebaseAuthNetworkService();

    signIn('user1');
    await service.request('https://api.example.com/entities');
    expect(authHeaderOf(0)).toBe('Bearer user1-token');

    // Sign out and straight back in as somebody else, well inside the 30s
    // window in which a cached token is still considered fresh.
    currentUser = null;
    signIn('user2');
    await service.request('https://api.example.com/entities');

    expect(authHeaderOf(1)).toBe('Bearer user2-token');
  });

  it('reuses the cached token for the same user', async () => {
    const service = new FirebaseAuthNetworkService();

    signIn('user1');
    await service.request('https://api.example.com/entities');
    const getIdToken = currentUser!.getIdToken;
    await service.request('https://api.example.com/entities');

    expect(authHeaderOf(1)).toBe('Bearer user1-token');
    expect(getIdToken).toHaveBeenCalledTimes(1);
  });

  it('sends no Authorization header when signed out', async () => {
    const service = new FirebaseAuthNetworkService();

    signIn('user1');
    await service.request('https://api.example.com/entities');

    currentUser = null;
    await service.request('https://api.example.com/entities');

    expect(authHeaderOf(1)).toBeUndefined();
  });
});
