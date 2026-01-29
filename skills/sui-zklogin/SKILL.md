---
name: sui-zklogin
description: Use when implementing OAuth login with zero-knowledge proofs, integrating Google/Facebook/Twitch authentication, or enabling privacy-preserving login on SUI. Triggers on zkLogin integration, OAuth authentication, or privacy-focused auth requirements.
---

# SUI zkLogin Integration

**OAuth-based wallet authentication with zero-knowledge proofs.**

## Overview

zkLogin allows users to:
- Login with Google, Facebook, Twitch, etc.
- No seed phrases or private keys to manage
- Wallet address derived from OAuth sub (user ID)
- Zero-knowledge proofs for privacy

## Use Cases

- User onboarding (no wallet required)
- Social login for dApps
- Gaming platforms
- Mobile apps
- Mainstream user applications

## Quick Start

### Frontend Setup

```typescript
import { ZkLoginProvider } from '@mysten/zklogin';

const zkLogin = new ZkLoginProvider({
  network: 'testnet',
  provider: 'google' // or 'facebook', 'twitch'
});

// 1. Initiate login
async function login() {
  const { url, nonce } = await zkLogin.getLoginUrl();

  // Store nonce for later
  sessionStorage.setItem('zklogin_nonce', nonce);

  // Redirect to OAuth provider
  window.location.href = url;
}

// 2. Handle callback
async function handleCallback() {
  const params = new URLSearchParams(window.location.search);
  const jwt = params.get('id_token');
  const nonce = sessionStorage.getItem('zklogin_nonce');

  // Generate ZK proof
  const proof = await zkLogin.getProof(jwt, nonce);

  // Get SUI address
  const address = await zkLogin.getAddress(proof);

  return { proof, address };
}

// 3. Sign transactions
async function signTransaction(txb: TransactionBlock) {
  const signedTx = await zkLogin.signTransaction(txb);
  return signedTx;
}
```

### Move Contract Support

```move
// No special Move code needed!
// zkLogin addresses are regular SUI addresses
// Use tx_context::sender(ctx) as normal

public fun create_profile(
    name: String,
    ctx: &mut TxContext
) {
    let user = tx_context::sender(ctx);  // Works with zkLogin!

    // Create user profile
    // ...
}
```

## Full OAuth Flow

```typescript
// Complete zkLogin implementation

import { ZkLoginProvider, generateNonce } from '@mysten/zklogin';
import { SuiClient } from '@mysten/sui.js/client';

class ZkLoginAuth {
  private provider: ZkLoginProvider;
  private client: SuiClient;

  constructor() {
    this.provider = new ZkLoginProvider({
      network: 'testnet',
      provider: 'google'
    });
    this.client = new SuiClient({ url: getFullnodeUrl('testnet') });
  }

  async login() {
    // Generate nonce
    const nonce = generateNonce();
    localStorage.setItem('zklogin_nonce', nonce);

    // Get OAuth URL
    const authUrl = this.provider.getAuthUrl({
      nonce,
      redirectUrl: 'http://localhost:3000/callback'
    });

    // Redirect
    window.location.href = authUrl;
  }

  async handleCallback() {
    const params = new URLSearchParams(window.location.search);
    const jwt = params.get('id_token');
    const nonce = localStorage.getItem('zklogin_nonce');

    if (!jwt || !nonce) {
      throw new Error('Missing JWT or nonce');
    }

    // Generate ZK proof
    const proof = await this.provider.getProof(jwt, nonce);

    // Derive address
    const address = this.provider.getAddress(proof);

    // Store session
    localStorage.setItem('zklogin_proof', JSON.stringify(proof));
    localStorage.setItem('zklogin_address', address);

    return { address, proof };
  }

  async signAndExecuteTransaction(txb: TransactionBlock) {
    const proof = JSON.parse(localStorage.getItem('zklogin_proof')!);

    const signed = await this.provider.signTransaction(txb, proof);

    const result = await this.client.executeTransactionBlock({
      transactionBlock: signed,
      signature: proof.signature
    });

    return result;
  }
}
```

## React Hook

```typescript
function useZkLogin() {
  const [address, setAddress] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const login = async (provider: 'google' | 'facebook') => {
    setIsLoading(true);
    const zkLogin = new ZkLoginProvider({ network: 'testnet', provider });

    const { url, nonce } = await zkLogin.getLoginUrl();
    sessionStorage.setItem('nonce', nonce);

    window.location.href = url;
  };

  const handleCallback = async () => {
    const auth = new ZkLoginAuth();
    const { address } = await auth.handleCallback();
    setAddress(address);
    setIsLoading(false);
  };

  return { address, login, handleCallback, isLoading };
}
```

## Security Considerations

- **NEVER** expose OAuth client secrets in frontend
- Always validate JWT signatures
- Use secure nonce generation
- Implement session timeout
- Store proofs securely (encrypted storage)

## Best Practices

- Support multiple OAuth providers
- Fallback to traditional wallet connection
- Clear session on logout
- Handle token expiration
- Provide visual feedback during auth

## Common Mistakes

❌ **Exposing OAuth client secret in frontend**
- **Problem:** Security breach, anyone can impersonate your app
- **Fix:** Keep client secret server-side, use PKCE flow for frontend

❌ **Not validating JWT signature**
- **Problem:** Forged tokens, authentication bypass
- **Fix:** Always verify JWT with provider's public key

❌ **Reusing nonce across sessions**
- **Problem:** Replay attacks possible
- **Fix:** Generate fresh nonce for each login attempt

❌ **Storing ZK proof in localStorage unencrypted**
- **Problem:** XSS attacks can steal proof, drain wallet
- **Fix:** Encrypt proof before storage or use sessionStorage

❌ **No fallback when OAuth provider is down**
- **Problem:** Users locked out of app
- **Fix:** Offer traditional wallet connection as fallback

❌ **Not handling token expiration**
- **Problem:** Silent failures, broken transactions
- **Fix:** Implement token refresh or prompt re-authentication

Query latest zkLogin updates:
```typescript
const zkLoginInfo = await sui_docs_query({
  type: "github",
  target: "zklogin",
  query: "OAuth integration examples and best practices"
});
```

---

**Seamless user onboarding with familiar OAuth login!**
