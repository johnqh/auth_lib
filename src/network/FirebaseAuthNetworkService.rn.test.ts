/**
 * @fileoverview Tests for the React Native FirebaseAuthNetworkService.
 *
 * Covers the session policy: a 401 is recoverable once via token refresh and
 * ends the session when it is not; a 403 never touches the session.
 *
 * RNNetworkClient throws a NetworkError for non-OK responses, so failures are
 * modelled as rejections carrying a `status`.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockSuperRequest = vi.fn();
const mockSignOut = vi.fn(() => Promise.resolve());
const mockGetIdToken = vi.fn(() => Promise.resolve('fresh-token'));

vi.mock('@sudobility/di/rn', () => ({
  RNNetworkClient: class {
    constructor(_timeout?: number) {}
    async request(url: string, options?: unknown): Promise<unknown> {
      return mockSuperRequest(url, options);
    }
  },
}));

vi.mock('../config/firebase-init.native.js', () => ({
  getFirebaseAuth: () => ({
    currentUser: { getIdToken: mockGetIdToken },
    signOut: mockSignOut,
  }),
}));

import { FirebaseAuthNetworkService } from './FirebaseAuthNetworkService.rn';

/** A NetworkError-shaped rejection, as RNNetworkClient produces. */
function httpError(status: number) {
  return Object.assign(new Error(`HTTP ${status}`), { status });
}

describe('FirebaseAuthNetworkService (RN)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetIdToken.mockResolvedValue('fresh-token');
  });

  it('returns a successful response and attaches the token', async () => {
    mockSuperRequest.mockResolvedValueOnce({ ok: true, status: 200 });
    const service = new FirebaseAuthNetworkService();

    const response = await service.request('https://api.example.com/data');

    expect(response).toEqual({ ok: true, status: 200 });
    const [, options] = mockSuperRequest.mock.calls[0] as [
      string,
      { headers: Record<string, string> },
    ];
    expect(options.headers['Authorization']).toBe('Bearer fresh-token');
    expect(mockSignOut).not.toHaveBeenCalled();
  });

  it('refreshes the token and retries once on 401', async () => {
    mockSuperRequest
      .mockRejectedValueOnce(httpError(401))
      .mockResolvedValueOnce({ ok: true, status: 200 });
    const service = new FirebaseAuthNetworkService();

    const response = await service.request('https://api.example.com/data');

    expect(mockGetIdToken).toHaveBeenCalledWith(true);
    expect(mockSuperRequest).toHaveBeenCalledTimes(2);
    expect(response).toEqual({ ok: true, status: 200 });
    expect(mockSignOut).not.toHaveBeenCalled();
  });

  it('logs the user out when the retry is still rejected with 401', async () => {
    mockSuperRequest
      .mockRejectedValueOnce(httpError(401))
      .mockRejectedValueOnce(httpError(401));
    const onLogout = vi.fn();
    const service = new FirebaseAuthNetworkService({ onLogout });

    await expect(
      service.request('https://api.example.com/data')
    ).rejects.toThrow('HTTP 401');

    expect(mockSignOut).toHaveBeenCalledTimes(1);
    expect(onLogout).toHaveBeenCalledTimes(1);
  });

  it('logs the user out when the refresh yields no token', async () => {
    mockSuperRequest.mockRejectedValueOnce(httpError(401));
    mockGetIdToken.mockResolvedValueOnce('token').mockResolvedValueOnce('');
    const onLogout = vi.fn();
    const onTokenRefreshFailed = vi.fn();
    const service = new FirebaseAuthNetworkService({
      onLogout,
      onTokenRefreshFailed,
    });

    await expect(
      service.request('https://api.example.com/data')
    ).rejects.toThrow('HTTP 401');

    expect(onTokenRefreshFailed).toHaveBeenCalledTimes(1);
    expect(mockSignOut).toHaveBeenCalledTimes(1);
    expect(onLogout).toHaveBeenCalledTimes(1);
  });

  it('leaves the session alone on 403', async () => {
    // A permission denial must not sign the user out -- these APIs return 403
    // for role checks, not for dead sessions.
    mockSuperRequest.mockRejectedValueOnce(httpError(403));
    const onLogout = vi.fn();
    const service = new FirebaseAuthNetworkService({ onLogout });

    await expect(
      service.request('https://api.example.com/data')
    ).rejects.toThrow('HTTP 403');

    expect(mockSignOut).not.toHaveBeenCalled();
    expect(onLogout).not.toHaveBeenCalled();
    expect(mockGetIdToken).toHaveBeenCalledTimes(1); // initial token only, no refresh
  });
});
