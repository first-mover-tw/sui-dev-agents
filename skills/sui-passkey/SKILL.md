---
name: sui-passkey
description: Use when implementing passwordless authentication, integrating WebAuthn passkeys, or enabling biometric login on SUI. Triggers on authentication implementation, passkey integration, or device biometric requirements.
---

# SUI Passkey Integration

**Passwordless authentication using WebAuthn and device biometrics.**

## Overview

Passkey provides:
- Biometric authentication (Face ID, Touch ID, Windows Hello)
- No passwords or seed phrases
- Hardware-backed security
- Cross-device sync (via iCloud, Google)

## Use Cases

- Consumer apps requiring easy login
- Mobile-first applications
- Security-critical applications
- Enterprise SUI apps

## Quick Start

### Register Passkey

```typescript
import { PasskeyProvider } from '@mysten/wallet-standard';

async function registerPasskey(username: string) {
  const provider = new PasskeyProvider();

  // Create passkey credential
  const credential = await navigator.credentials.create({
    publicKey: {
      challenge: new Uint8Array(32), // Random challenge
      rp: {
        name: 'My SUI App',
        id: window.location.hostname
      },
      user: {
        id: new Uint8Array(16),
        name: username,
        displayName: username
      },
      pubKeyCredParams: [{ alg: -7, type: 'public-key' }],
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        userVerification: 'required'
      }
    }
  });

  // Derive SUI address from passkey
  const address = provider.getAddress(credential);

  return { credential, address };
}
```

### Authenticate with Passkey

```typescript
async function authenticatePasskey() {
  const credential = await navigator.credentials.get({
    publicKey: {
      challenge: new Uint8Array(32),
      rpId: window.location.hostname,
      userVerification: 'required'
    }
  });

  return credential;
}
```

### Sign Transaction

```typescript
async function signWithPasskey(txb: TransactionBlock) {
  const provider = new PasskeyProvider();

  // Get passkey credential
  const credential = await authenticatePasskey();

  // Sign transaction
  const signature = await provider.signTransaction(txb, credential);

  return signature;
}
```

## React Hook

```typescript
function usePasskey() {
  const [address, setAddress] = useState<string | null>(null);
  const [isRegistered, setIsRegistered] = useState(false);

  const register = async (username: string) => {
    const { credential, address } = await registerPasskey(username);

    // Store credential ID
    localStorage.setItem('passkey_credential_id', credential.id);
    localStorage.setItem('passkey_address', address);

    setAddress(address);
    setIsRegistered(true);
  };

  const authenticate = async () => {
    const credential = await authenticatePasskey();

    if (credential) {
      const storedAddress = localStorage.getItem('passkey_address');
      setAddress(storedAddress);
    }
  };

  const signTransaction = async (txb: TransactionBlock) => {
    return await signWithPasskey(txb);
  };

  return { address, isRegistered, register, authenticate, signTransaction };
}
```

## Move Contract

```move
// Passkey addresses are regular SUI addresses
// No special Move code needed!

public fun create_profile(
    name: String,
    ctx: &mut TxContext
) {
    let user = tx_context::sender(ctx);  // Works with passkey!
    // ...
}
```

## Best Practices

- Check WebAuthn browser support
- Fallback to traditional wallet
- Handle credential loss scenarios
- Test on multiple devices
- Provide backup authentication

## Browser Compatibility

- ✅ Chrome/Edge (Windows, macOS, Android)
- ✅ Safari (macOS, iOS)
- ✅ Firefox (Windows, macOS)
- ⚠️ Check mobile browser support

## Common Mistakes

❌ **Not checking WebAuthn browser support**
- **Problem:** App crashes on unsupported browsers
- **Fix:** Check `window.PublicKeyCredential` before registering passkey

❌ **No fallback authentication method**
- **Problem:** Users locked out if passkey device is lost
- **Fix:** Offer traditional wallet connection as fallback

❌ **Storing credential ID without encryption**
- **Problem:** XSS attacks can steal credential reference
- **Fix:** Encrypt credential ID before localStorage, or use sessionStorage

❌ **Not handling "user cancelled" flow**
- **Problem:** App stuck in loading state
- **Fix:** Catch AbortError, show "Authentication cancelled" message

❌ **Using wrong authenticator attachment**
- **Problem:** Requires USB key instead of platform biometrics
- **Fix:** Set `authenticatorAttachment: 'platform'` for Face ID/Touch ID

❌ **Not testing on multiple devices**
- **Problem:** Works on desktop, fails on mobile
- **Fix:** Test registration and authentication on iOS, Android, desktop

❌ **Missing user verification requirement**
- **Problem:** Security risk, no biometric check
- **Fix:** Set `userVerification: 'required'` for all operations

❌ **Not providing credential recovery flow**
- **Problem:** Users lose access if they reset device
- **Fix:** Implement account recovery via email or backup passkey

Query Passkey docs:
```typescript
const passkeyInfo = await sui_docs_query({
  type: "github",
  target: "sui-core",
  query: "passkey WebAuthn implementation examples"
});
```

---

**Secure, user-friendly authentication with no passwords!**
