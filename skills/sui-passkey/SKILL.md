---
name: sui-passkey
description: Use when implementing WebAuthn passkeys or biometric authentication (Face ID, fingerprint, hardware keys) on SUI. Triggers on "passkey", "WebAuthn", "biometric login", "Face ID", "fingerprint auth", "FIDO2", or passwordless auth that uses device authenticators instead of seed phrases. Different from zkLogin (which uses OAuth providers).
---

# SUI Passkey Integration

**Passwordless wallets via WebAuthn / SIP-9.**

## SDK Versions

Targets: `@mysten/sui` 2.17.0 (^2.0). Tested: 2026-05-21.

**Compatibility notes:** The passkey API lives at the `@mysten/sui/keypairs/passkey` sub-export — there is no separate `@mysten/passkey` package. Do **NOT** import passkey symbols from `@mysten/wallet-standard` (it exports zero passkey APIs).

## Real exports

```typescript
import {
  BrowserPasskeyProvider,         // class implementing PasskeyProvider
  PasskeyKeypair,                  // extends Signer
  findCommonPublicKey,
  type PasskeyProvider,            // interface, NOT a class
  type BrowserPasswordProviderOptions,
  PasskeyPublicKey,
} from '@mysten/sui/keypairs/passkey';
```

## Use Cases

- Consumer apps wanting Face ID / Touch ID login
- Mobile-first dApps
- No seed-phrase onboarding flow

## First-time registration

Use `PasskeyKeypair.getPasskeyInstance(provider)` — this invokes the browser passkey UI, creates a fresh credential, and returns a signer.

```typescript
// @check:skip
import {
  BrowserPasskeyProvider,
  PasskeyKeypair,
  type BrowserPasswordProviderOptions,
} from '@mysten/sui/keypairs/passkey';

async function registerPasskey() {
  const provider = new BrowserPasskeyProvider('My SUI App', {
    rp: { name: 'My SUI App', id: window.location.hostname },
    authenticatorSelection: {
      authenticatorAttachment: 'platform',   // Face ID / Touch ID / Windows Hello
      userVerification: 'required',
      residentKey: 'required',
    },
  } satisfies BrowserPasswordProviderOptions);

  // Triggers the OS passkey prompt and returns a Signer.
  const signer = await PasskeyKeypair.getPasskeyInstance(provider);

  const address = signer.toSuiAddress();
  const publicKey = signer.getPublicKey().toRawBytes();
  const credentialId = signer.getCredentialId();         // Uint8Array | undefined

  // Persist the public key + credentialId so you can rebuild the signer later
  // WITHOUT a fresh registration prompt.
  localStorage.setItem('pk_address', address);
  localStorage.setItem('pk_pubkey', Buffer.from(publicKey).toString('base64'));
  if (credentialId) {
    localStorage.setItem(
      'pk_credId',
      Buffer.from(credentialId).toString('base64'),
    );
  }

  return { signer, address };
}
```

## Returning user — rebuild signer without re-registering

```typescript
// @check:skip
function restorePasskeySigner(): PasskeyKeypair {
  const provider = new BrowserPasskeyProvider('My SUI App', {
    rp: { name: 'My SUI App', id: window.location.hostname },
  });

  const publicKey = Buffer.from(localStorage.getItem('pk_pubkey')!, 'base64');
  const credIdB64 = localStorage.getItem('pk_credId');
  const credentialId = credIdB64
    ? new Uint8Array(Buffer.from(credIdB64, 'base64'))
    : undefined;

  return new PasskeyKeypair(new Uint8Array(publicKey), provider, credentialId);
}
```

## Recover wallet when you only have the credential (lost the public key)

Sign two distinct messages, then intersect candidate public keys.

```typescript
// @check:skip
import { BrowserPasskeyProvider, PasskeyKeypair, findCommonPublicKey } from '@mysten/sui/keypairs/passkey';

const provider = new BrowserPasskeyProvider('My SUI App', {
  rp: { name: 'My SUI App', id: window.location.hostname },
});

const msg1 = new TextEncoder().encode('recover-1');
const msg2 = new TextEncoder().encode('recover-2');

const candidates1 = await PasskeyKeypair.signAndRecover(provider, msg1);
const candidates2 = await PasskeyKeypair.signAndRecover(provider, msg2);
const realPubKey = findCommonPublicKey(candidates1, candidates2);

const signer = new PasskeyKeypair(realPubKey.toRawBytes(), provider);
```

## Sign + execute a transaction

```typescript
// @check:skip
import { Transaction } from '@mysten/sui/transactions';
import { SuiGrpcClient } from '@mysten/sui/grpc';

const suiClient = new SuiGrpcClient({
  network: 'testnet',
  baseUrl: 'https://fullnode.testnet.sui.io:443',
});
const signer = restorePasskeySigner();

const tx = new Transaction();
tx.setSender(signer.toSuiAddress());
tx.transferObjects([tx.gas], '0xRECIPIENT');

// Passkey signing invokes the OS biometric prompt:
const { bytes, signature } = await tx.sign({ client: suiClient, signer });

await suiClient.core.executeTransaction({ transaction: bytes, signature });
```

## React hook

```typescript
// @check:skip
function usePasskey() {
  const [signer, setSigner] = useState<PasskeyKeypair | null>(null);

  const register = useCallback(async () => {
    const { signer } = await registerPasskey();
    setSigner(signer);
  }, []);

  const restore = useCallback(() => {
    setSigner(restorePasskeySigner());
  }, []);

  return { signer, address: signer?.toSuiAddress(), register, restore };
}
```

## Move contract

Passkey addresses are regular SUI addresses; nothing special on-chain.

```move
public fun create_profile(name: String, ctx: &mut TxContext) {
    let user = tx_context::sender(ctx);  // works with passkey
}
```

## Browser compatibility

- Chrome / Edge (Windows, macOS, Android)
- Safari (macOS, iOS 16+)
- Firefox (Win/macOS)
- Check `window.PublicKeyCredential` before invoking.

## Common Mistakes

**`import { PasskeyProvider } from '@mysten/wallet-standard'` — wrong package, and `PasskeyProvider` is an interface, not a class.**
- Import `BrowserPasskeyProvider` (the class) from `@mysten/sui/keypairs/passkey`.

**Calling `new PasskeyKeypair()` with no arguments.**
- The constructor requires `(publicKey, provider, credentialId?)`. For first-time creation use `await PasskeyKeypair.getPasskeyInstance(provider)`.

**Re-prompting registration on every login.**
- Persist `getPublicKey().toRawBytes()` + `getCredentialId()` and rebuild via `new PasskeyKeypair(pk, provider, credId)`. If you lost the pubkey, use `signAndRecover` + `findCommonPublicKey`.

**Missing `authenticatorAttachment: 'platform'`.**
- Without it, the browser may demand a USB security key instead of Face ID / Touch ID.

**Forgetting `tx.setSender(signer.toSuiAddress())`.**
- The signature won't verify against an unset / mismatched sender.

## Resources

- [SIP-9: Passkey signature scheme](https://github.com/sui-foundation/sips/blob/main/sips/sip-9.md)
- API source: `@mysten/sui/keypairs/passkey`
