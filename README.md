# @sudobility/auth_lib

Firebase authentication library with configurable auth initialization, resilient network clients with automatic token refresh and logout handling, admin utilities, and React hooks for auth state management. Supports both web and React Native platforms.

## Installation

```bash
bun add @sudobility/auth_lib
```

### Peer Dependencies

```bash
bun add react firebase @sudobility/di @sudobility/types @tanstack/react-query
# For React Native, also:
bun add @react-native-firebase/app @react-native-firebase/auth
```

## Usage

```typescript
import {
  initializeFirebaseAuth,
  useFirebaseAuthNetworkClient,
  useSiteAdmin,
  getFirebaseErrorMessage,
} from '@sudobility/auth_lib';

// Initialize Firebase Auth (after Firebase app is initialized)
const { app, auth } = initializeFirebaseAuth();

// In a React component: get an auth-aware network client
const networkClient = useFirebaseAuthNetworkClient({
  onLogout: () => navigate('/login'),
});

// Check if user is a site admin
const { isSiteAdmin, isLoading } = useSiteAdmin({
  networkClient,
  baseUrl: 'https://api.example.com',
  userId: user.uid,
  token: idToken,
});
```

## API

### Firebase Initialization (`config/`)

| Export | Description |
|---|---|
| `initializeFirebaseAuth()` | Initialize Firebase Auth (singleton) |
| `getFirebaseApp()` | Get cached FirebaseApp instance |
| `getFirebaseAuth()` | Get cached Auth instance |
| `isFirebaseConfigured()` | Check if Firebase is initialized |

### Hooks (`hooks/`)

| Export | Description |
|---|---|
| `useFirebaseAuthNetworkClient(options?)` | Auth-aware NetworkClient with 401 retry and 403 logout |
| `createFirebaseAuthNetworkClient(platformNetwork?, options?)` | Non-hook factory version |
| `useSiteAdmin(options)` | Check site admin status via TanStack Query |

### Network (`network/`)

| Export | Description |
|---|---|
| `FirebaseAuthNetworkService` | Auth-aware network service (web and RN variants) |

### Utils (`utils/`)

| Export | Description |
|---|---|
| `getFirebaseErrorMessage(code)` | Map Firebase error code to user-friendly message |
| `formatFirebaseError(error)` | Extract and map error code in one call |
| `isFirebaseAuthError(error)` | Check if error is a Firebase auth error |

### Admin (`admin/`)

| Export | Description |
|---|---|
| `parseAdminEmails(csv)` | Parse comma-separated admin email string |
| `isAdminEmail(email, adminSet)` | Check if email is in admin set |
| `createAdminChecker(csv)` | Returns admin check function (deprecated) |

## Dual Entry Points

- **Web**: `import` resolves to `dist/index.js` (Firebase JS SDK)
- **React Native**: `react-native` condition resolves to `dist/index.rn.js` (@react-native-firebase)

## Development

```bash
bun run build          # Compile TypeScript to dist/
bun run dev            # Watch mode build
bun test               # Run tests with Vitest
bun run typecheck      # Type-check without emitting
bun run lint           # Lint with ESLint
bun run format         # Format with Prettier
```

## License

BUSL-1.1
