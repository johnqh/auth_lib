import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock React
vi.mock('react', () => ({
  useMemo: vi.fn((fn: () => unknown) => fn()),
}));

// Mock firebase/auth
vi.mock('firebase/auth', () => ({
  signOut: vi.fn(() => Promise.resolve()),
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
vi.mock('../config/firebase-init', () => ({
  getFirebaseAuth: vi.fn(() => ({
    currentUser: {
      getIdToken: vi.fn(() => Promise.resolve('test-token')),
    },
  })),
}));

// Import after mocking
import { useFirebaseAuthNetworkClient } from './useFirebaseAuthNetworkClient';

describe('useFirebaseAuthNetworkClient', () => {
  beforeEach(() => {
    mockRequest.mockClear();
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
      const onLogout = vi.fn(() => {});
      const onTokenRefreshFailed = vi.fn(() => {});

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
  });
});
