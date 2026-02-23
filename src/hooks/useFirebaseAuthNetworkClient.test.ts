import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock React
vi.mock('react', () => ({
  useMemo: vi.fn((fn: () => unknown) => fn()),
}));

// Mock firebase/auth
const mockSignOut = vi.fn(() => Promise.resolve());
vi.mock('firebase/auth', () => ({
  signOut: (...args: unknown[]) => mockSignOut(...args),
}));

// Mock @sudobility/di
const mockRequest = vi.fn(() =>
  Promise.resolve({
    ok: true,
    status: 200,
    statusText: 'OK',
    headers: new Headers({ 'content-type': 'application/json' }),
    json: () => Promise.resolve({ data: 'test' }),
  })
);

vi.mock('@sudobility/di', () => ({
  getNetworkService: vi.fn(() => ({
    request: mockRequest,
  })),
}));

// Mock firebase-init
const mockGetIdToken = vi.fn(() => Promise.resolve('test-token'));
const mockGetFirebaseAuth = vi.fn(() => ({
  currentUser: {
    getIdToken: mockGetIdToken,
  },
}));

vi.mock('../config/firebase-init', () => ({
  getFirebaseAuth: (...args: unknown[]) => mockGetFirebaseAuth(...args),
}));

// Import after mocking
import {
  createFirebaseAuthNetworkClient,
  invalidateTokenCache,
  useFirebaseAuthNetworkClient,
} from './useFirebaseAuthNetworkClient';

/**
 * Helper to create a mock Response with the given status and body.
 */
function createMockResponse(
  status: number,
  body: unknown = { data: 'test' },
  ok?: boolean
): Response {
  const isOk = ok ?? (status >= 200 && status < 300);
  return {
    ok: isOk,
    status,
    statusText: status === 200 ? 'OK' : `Status ${status}`,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

describe('useFirebaseAuthNetworkClient', () => {
  beforeEach(() => {
    mockRequest.mockClear();
    mockGetIdToken.mockClear();
    mockSignOut.mockClear();
    mockGetFirebaseAuth.mockReset();
    mockGetFirebaseAuth.mockReturnValue({
      currentUser: {
        getIdToken: mockGetIdToken,
      },
    });
    mockGetIdToken.mockResolvedValue('test-token');
    mockRequest.mockResolvedValue(createMockResponse(200));
    // Always invalidate cache between tests
    invalidateTokenCache();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('hook initialization', () => {
    it('returns a NetworkClient object', () => {
      const client = useFirebaseAuthNetworkClient();

      expect(client).toHaveProperty('request');
      expect(client).toHaveProperty('get');
      expect(client).toHaveProperty('post');
      expect(client).toHaveProperty('put');
      expect(client).toHaveProperty('delete');
    });

    it('accepts options parameter', () => {
      const onLogout = vi.fn();
      const onTokenRefreshFailed = vi.fn();

      const client = useFirebaseAuthNetworkClient({
        onLogout,
        onTokenRefreshFailed,
      });

      expect(client).toHaveProperty('request');
    });
  });

  describe('request method', () => {
    it('makes a request with default GET method', async () => {
      const client = useFirebaseAuthNetworkClient();
      const response = await client.request('https://api.example.com/data');

      expect(response).toHaveProperty('ok');
      expect(response).toHaveProperty('status');
      expect(response).toHaveProperty('success');
      expect(response).toHaveProperty('timestamp');
    });

    it('makes a request with custom method', async () => {
      const client = useFirebaseAuthNetworkClient();
      const response = await client.request('https://api.example.com/data', {
        method: 'POST',
      });

      expect(response).toHaveProperty('ok');
    });
  });

  describe('get method', () => {
    it('makes a GET request', async () => {
      const client = useFirebaseAuthNetworkClient();
      const response = await client.get('https://api.example.com/data');

      expect(response).toHaveProperty('ok');
      expect(response).toHaveProperty('status');
    });

    it('accepts headers option', async () => {
      const client = useFirebaseAuthNetworkClient();
      const response = await client.get('https://api.example.com/data', {
        headers: { Authorization: 'Bearer token' },
      });

      expect(response).toHaveProperty('ok');
    });
  });

  describe('post method', () => {
    it('makes a POST request', async () => {
      const client = useFirebaseAuthNetworkClient();
      const response = await client.post('https://api.example.com/data', {
        name: 'test',
      });

      expect(response).toHaveProperty('ok');
    });

    it('makes a POST request without body', async () => {
      const client = useFirebaseAuthNetworkClient();
      const response = await client.post('https://api.example.com/data');

      expect(response).toHaveProperty('ok');
    });
  });

  describe('put method', () => {
    it('makes a PUT request', async () => {
      const client = useFirebaseAuthNetworkClient();
      const response = await client.put('https://api.example.com/data', {
        name: 'updated',
      });

      expect(response).toHaveProperty('ok');
    });

    it('makes a PUT request without body', async () => {
      const client = useFirebaseAuthNetworkClient();
      const response = await client.put('https://api.example.com/data');

      expect(response).toHaveProperty('ok');
    });
  });

  describe('delete method', () => {
    it('makes a DELETE request', async () => {
      const client = useFirebaseAuthNetworkClient();
      const response = await client.delete('https://api.example.com/data/1');

      expect(response).toHaveProperty('ok');
    });
  });

  describe('response parsing', () => {
    it('parses JSON response', async () => {
      const client = useFirebaseAuthNetworkClient();
      const response = await client.get('https://api.example.com/data');

      expect(response).toHaveProperty('data');
      expect(response).toHaveProperty('headers');
    });

    it('includes timestamp in response', async () => {
      const client = useFirebaseAuthNetworkClient();
      const response = await client.get('https://api.example.com/data');

      expect(response.timestamp).toBeDefined();
      expect(typeof response.timestamp).toBe('string');
    });

    it('handles non-JSON response', async () => {
      mockRequest.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'content-type': 'text/plain' }),
        json: () => Promise.reject(new Error('not json')),
      });

      const client = useFirebaseAuthNetworkClient();
      const response = await client.get('https://api.example.com/data');

      expect(response.ok).toBe(true);
      expect(response.data).toBeUndefined();
    });
  });
});

describe('createFirebaseAuthNetworkClient', () => {
  beforeEach(() => {
    mockRequest.mockClear();
    mockGetIdToken.mockClear();
    mockSignOut.mockClear();
    mockGetFirebaseAuth.mockReset();
    mockGetFirebaseAuth.mockReturnValue({
      currentUser: {
        getIdToken: mockGetIdToken,
      },
    });
    mockGetIdToken.mockResolvedValue('test-token');
    mockRequest.mockResolvedValue(createMockResponse(200));
    invalidateTokenCache();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('factory function', () => {
    it('returns a NetworkClient with all required methods', () => {
      const client = createFirebaseAuthNetworkClient();

      expect(typeof client.request).toBe('function');
      expect(typeof client.get).toBe('function');
      expect(typeof client.post).toBe('function');
      expect(typeof client.put).toBe('function');
      expect(typeof client.delete).toBe('function');
    });

    it('uses provided platformNetwork instead of default', async () => {
      const customRequest = vi.fn(() =>
        Promise.resolve(createMockResponse(200, { custom: true }))
      );
      const client = createFirebaseAuthNetworkClient({
        request: customRequest,
      });

      await client.get('https://api.example.com/data');

      expect(customRequest).toHaveBeenCalledTimes(1);
      expect(mockRequest).not.toHaveBeenCalled();
    });

    it('injects Authorization header when token is available', async () => {
      const customRequest = vi.fn(() =>
        Promise.resolve(createMockResponse(200))
      );
      const client = createFirebaseAuthNetworkClient({
        request: customRequest,
      });

      await client.get('https://api.example.com/data');

      expect(customRequest).toHaveBeenCalledWith(
        'https://api.example.com/data',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-token',
          }),
        })
      );
    });

    it('does not override existing Authorization header', async () => {
      const customRequest = vi.fn(() =>
        Promise.resolve(createMockResponse(200))
      );
      const client = createFirebaseAuthNetworkClient({
        request: customRequest,
      });

      await client.get('https://api.example.com/data', {
        headers: { Authorization: 'Bearer custom-token' },
      });

      expect(customRequest).toHaveBeenCalledWith(
        'https://api.example.com/data',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer custom-token',
          }),
        })
      );
    });

    it('works when no user is authenticated (no token)', async () => {
      mockGetFirebaseAuth.mockReturnValue({
        currentUser: null,
      });

      const customRequest = vi.fn(() =>
        Promise.resolve(createMockResponse(200))
      );
      const client = createFirebaseAuthNetworkClient({
        request: customRequest,
      });

      await client.get('https://api.example.com/data');

      // Should still make the request, just without Authorization header
      expect(customRequest).toHaveBeenCalledTimes(1);
      const callArgs = customRequest.mock.calls[0];
      const headers = (callArgs?.[1] as RequestInit)?.headers as Record<
        string,
        string
      >;
      expect(headers?.['Authorization']).toBeUndefined();
    });
  });

  describe('401 retry with token refresh', () => {
    it('retries request with fresh token on 401', async () => {
      const customRequest = vi
        .fn()
        .mockResolvedValueOnce(createMockResponse(401))
        .mockResolvedValueOnce(
          createMockResponse(200, { retried: true })
        );

      mockGetIdToken
        .mockResolvedValueOnce('stale-token')
        .mockResolvedValueOnce('fresh-token');

      const client = createFirebaseAuthNetworkClient({
        request: customRequest,
      });

      const response = await client.get('https://api.example.com/data');

      // First call with stale token, second with fresh token
      expect(customRequest).toHaveBeenCalledTimes(2);
      expect(response.ok).toBe(true);
      expect(response.data).toEqual({ retried: true });
    });

    it('calls onTokenRefreshFailed when token refresh fails', async () => {
      const customRequest = vi
        .fn()
        .mockResolvedValueOnce(createMockResponse(401));

      // First call returns a token (for initial request), but then no user for refresh
      mockGetIdToken
        .mockResolvedValueOnce('stale-token')
        .mockRejectedValueOnce(new Error('refresh failed'));

      const onTokenRefreshFailed = vi.fn();
      const client = createFirebaseAuthNetworkClient(
        { request: customRequest },
        { onTokenRefreshFailed }
      );

      const response = await client.get('https://api.example.com/data');

      expect(onTokenRefreshFailed).toHaveBeenCalledWith(
        expect.any(Error)
      );
      // Returns the original 401 response
      expect(response.status).toBe(401);
    });

    it('returns 401 response when no user for token refresh', async () => {
      const customRequest = vi
        .fn()
        .mockResolvedValueOnce(createMockResponse(401));

      // First call gets a token, but on 401 retry there's no user
      mockGetIdToken.mockResolvedValueOnce('stale-token');
      // After invalidateTokenCache + forceRefresh, getFirebaseAuth returns no user
      mockGetFirebaseAuth
        .mockReturnValueOnce({
          currentUser: { getIdToken: mockGetIdToken },
        })
        .mockReturnValueOnce({ currentUser: null });

      const onTokenRefreshFailed = vi.fn();
      const client = createFirebaseAuthNetworkClient(
        { request: customRequest },
        { onTokenRefreshFailed }
      );

      const response = await client.get('https://api.example.com/data');

      expect(response.status).toBe(401);
      expect(onTokenRefreshFailed).toHaveBeenCalledWith(
        expect.any(Error)
      );
    });

    it('invalidates token cache on 401', async () => {
      const customRequest = vi
        .fn()
        .mockResolvedValueOnce(createMockResponse(200))
        .mockResolvedValueOnce(createMockResponse(401))
        .mockResolvedValueOnce(
          createMockResponse(200, { retried: true })
        );

      mockGetIdToken
        .mockResolvedValueOnce('cached-token')
        .mockResolvedValueOnce('fresh-token-after-401');

      const client = createFirebaseAuthNetworkClient({
        request: customRequest,
      });

      // First request - gets token and caches it
      await client.get('https://api.example.com/data');
      // getIdToken called once for initial token
      expect(mockGetIdToken).toHaveBeenCalledTimes(1);

      // Second request - returns 401, cache should be invalidated, force refresh
      const response = await client.get('https://api.example.com/data');

      // getIdToken called again for the force refresh
      expect(mockGetIdToken).toHaveBeenCalledTimes(2);
      expect(response.ok).toBe(true);
    });
  });

  describe('403 logout flow', () => {
    it('calls signOut and onLogout on 403 response', async () => {
      const customRequest = vi
        .fn()
        .mockResolvedValueOnce(createMockResponse(403));

      const onLogout = vi.fn();
      const client = createFirebaseAuthNetworkClient(
        { request: customRequest },
        { onLogout }
      );

      const response = await client.get('https://api.example.com/data');

      expect(mockSignOut).toHaveBeenCalled();
      expect(onLogout).toHaveBeenCalled();
      // Returns the 403 response so UI can handle it
      expect(response.status).toBe(403);
      expect(response.ok).toBe(false);
    });

    it('handles signOut failure gracefully', async () => {
      const customRequest = vi
        .fn()
        .mockResolvedValueOnce(createMockResponse(403));

      mockSignOut.mockRejectedValueOnce(new Error('sign out failed'));

      const onLogout = vi.fn();
      const client = createFirebaseAuthNetworkClient(
        { request: customRequest },
        { onLogout }
      );

      // Should not throw
      const response = await client.get('https://api.example.com/data');
      expect(response.status).toBe(403);
      // onLogout should NOT be called since signOut threw
      expect(onLogout).not.toHaveBeenCalled();
    });

    it('does not retry on 403', async () => {
      const customRequest = vi
        .fn()
        .mockResolvedValueOnce(createMockResponse(403));

      const client = createFirebaseAuthNetworkClient({
        request: customRequest,
      });

      await client.get('https://api.example.com/data');

      // Only one request, no retry
      expect(customRequest).toHaveBeenCalledTimes(1);
    });

    it('handles 403 when no auth instance', async () => {
      mockGetFirebaseAuth.mockReturnValue(null);

      const customRequest = vi
        .fn()
        .mockResolvedValueOnce(createMockResponse(403));

      const onLogout = vi.fn();
      const client = createFirebaseAuthNetworkClient(
        { request: customRequest },
        { onLogout }
      );

      // Should not throw
      const response = await client.get('https://api.example.com/data');
      expect(response.status).toBe(403);
      // signOut should not be called since auth is null
      expect(mockSignOut).not.toHaveBeenCalled();
    });
  });

  describe('token caching', () => {
    it('caches token and reuses it for subsequent requests', async () => {
      const customRequest = vi.fn(() =>
        Promise.resolve(createMockResponse(200))
      );

      const client = createFirebaseAuthNetworkClient({
        request: customRequest,
      });

      // First request - should call getIdToken
      await client.get('https://api.example.com/data');
      expect(mockGetIdToken).toHaveBeenCalledTimes(1);

      // Second request - should use cached token, not call getIdToken again
      await client.get('https://api.example.com/data');
      expect(mockGetIdToken).toHaveBeenCalledTimes(1);
    });

    it('refreshes token after cache TTL expires', async () => {
      const customRequest = vi.fn(() =>
        Promise.resolve(createMockResponse(200))
      );

      mockGetIdToken
        .mockResolvedValueOnce('token-1')
        .mockResolvedValueOnce('token-2');

      const client = createFirebaseAuthNetworkClient({
        request: customRequest,
      });

      // First request
      await client.get('https://api.example.com/data');
      expect(mockGetIdToken).toHaveBeenCalledTimes(1);

      // Advance time past TTL (5 minutes)
      vi.useFakeTimers();
      vi.advanceTimersByTime(5 * 60 * 1000 + 1);

      // Invalidate so the expired check works with the new Date.now()
      // Note: cacheExpiry was set with the old Date.now(), now Date.now()
      // returns old + 5min+1ms, which is past cacheExpiry
      await client.get('https://api.example.com/data');
      expect(mockGetIdToken).toHaveBeenCalledTimes(2);

      vi.useRealTimers();
    });

    it('invalidateTokenCache forces fresh token on next request', async () => {
      const customRequest = vi.fn(() =>
        Promise.resolve(createMockResponse(200))
      );

      mockGetIdToken
        .mockResolvedValueOnce('token-1')
        .mockResolvedValueOnce('token-2');

      const client = createFirebaseAuthNetworkClient({
        request: customRequest,
      });

      // First request - caches token
      await client.get('https://api.example.com/data');
      expect(mockGetIdToken).toHaveBeenCalledTimes(1);

      // Invalidate the cache manually
      invalidateTokenCache();

      // Next request should fetch a new token
      await client.get('https://api.example.com/data');
      expect(mockGetIdToken).toHaveBeenCalledTimes(2);
    });

    it('does not cache token when getIdToken fails', async () => {
      mockGetIdToken.mockRejectedValueOnce(
        new Error('token error')
      );

      const customRequest = vi.fn(() =>
        Promise.resolve(createMockResponse(200))
      );

      const client = createFirebaseAuthNetworkClient({
        request: customRequest,
      });

      // First request - getIdToken fails, no token cached
      await client.get('https://api.example.com/data');

      // Reset mock to succeed
      mockGetIdToken.mockResolvedValueOnce('recovered-token');

      // Second request - should try getIdToken again since nothing was cached
      await client.get('https://api.example.com/data');
      expect(mockGetIdToken).toHaveBeenCalledTimes(2);
    });

    it('uses cached token within TTL window', async () => {
      vi.useFakeTimers();
      const customRequest = vi.fn(() =>
        Promise.resolve(createMockResponse(200))
      );

      mockGetIdToken.mockResolvedValue('cached-token');

      const client = createFirebaseAuthNetworkClient({
        request: customRequest,
      });

      // First request at t=0
      await client.get('https://api.example.com/data');
      expect(mockGetIdToken).toHaveBeenCalledTimes(1);

      // Advance 2 minutes (well within 5-minute TTL)
      vi.advanceTimersByTime(2 * 60 * 1000);

      await client.get('https://api.example.com/data');
      // Still using cached token
      expect(mockGetIdToken).toHaveBeenCalledTimes(1);

      // Advance another 2 minutes (total 4 minutes, still within TTL)
      vi.advanceTimersByTime(2 * 60 * 1000);

      await client.get('https://api.example.com/data');
      expect(mockGetIdToken).toHaveBeenCalledTimes(1);

      vi.useRealTimers();
    });
  });
});
