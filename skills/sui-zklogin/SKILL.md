---
name: sui-zklogin
description: Use when implementing zkLogin on SUI — OAuth login (Google, Facebook, Apple, Twitch) with zero-knowledge proofs for privacy-preserving authentication. Triggers on "zkLogin", "social login on SUI", "Google login", "OAuth", "ephemeral keypair", "JWT proof", or any authentication flow that derives a SUI address from an OAuth provider. Also use when the user mentions "login without wallet extension".
---

# SUI zkLogin Integration

**OAuth-based wallet authentication with zero-knowledge proofs.**

## SDK Versions

Targets: `@mysten/sui` 2.27.1 (^2.0). Tested: 2026-08-29.

**Compatibility notes:** The zklogin API lives at `@mysten/sui/zklogin`. The old `@mysten/zklogin` package is **deprecated and merged into `@mysten/sui`** — if you see `Cannot find module '@mysten/zklogin'`, install only `@mysten/sui@^2`. There is no `ZkLoginProvider` class; the API is functional.

## Overview

zkLogin lets users:
- Log in with Google / Facebook / Twitch / Apple
- No seed phrases — wallet derived from `(iss, aud, sub, salt)`
- ZK proof hides which OAuth user owns which SUI address

> **Self-hosted vs. hosted.** This skill covers running the zkLogin flow yourself (your own salt service + Mysten's prover over HTTP). If you'd rather not manage proving, salt, or the OAuth plumbing, use [sui-enoki](../sui-enoki/SKILL.md) — Mysten's hosted zkLogin-as-a-service (also bundles sponsored/gasless transactions).

## Real API surface (from `@mysten/sui/zklogin`)

```typescript
import {
  generateRandomness,
  generateNonce,
  getExtendedEphemeralPublicKey,
  jwtToAddress,
  computeZkLoginAddress,
  genAddressSeed,
  getZkLoginSignature,
  decodeJwt,
  ZkLoginSigner,        // sui ≥2.20 — official signer wrapper
} from '@mysten/sui/zklogin';
```

There is **no** `ZkLoginProvider`, no `.getLoginUrl()`, no `.getProof()`. You drive the OAuth redirect yourself and call Mysten's prover service over HTTP.

## End-to-end flow

```
1. ephemeral keypair (Ed25519) + maxEpoch + randomness  →  nonce
2. redirect to OAuth provider with nonce in `nonce` param
3. receive JWT (id_token)
4. jwt + user salt  →  zkLogin address
5. POST {jwt, extendedEphemeralPublicKey, maxEpoch, jwtRandomness, salt, keyClaimName} → prover → ZK proof
6. sign tx digest with ephemeral keypair
7. getZkLoginSignature({inputs: {...proof, addressSeed}, maxEpoch, userSignature}) → serialized signature
8. submit tx with that signature
```

### Step 1 — nonce + ephemeral keypair

```typescript
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { SuiGrpcClient } from '@mysten/sui/grpc';
import {
  generateNonce,
  generateRandomness,
  getExtendedEphemeralPublicKey,
} from '@mysten/sui/zklogin';

const suiClient = new SuiGrpcClient({
  network: 'devnet',
  baseUrl: 'https://fullnode.devnet.sui.io:443',
});

const ephemeral = Ed25519Keypair.generate();
const { systemState } = await suiClient.core.getCurrentSystemState();
const epoch = systemState.epoch;
const maxEpoch = Number(epoch) + 2;                     // valid for ~2 epochs
const randomness = generateRandomness();                // string
const nonce = generateNonce(ephemeral.getPublicKey(), maxEpoch, randomness);

// Persist these — you need them after the OAuth redirect.
sessionStorage.setItem('zk_ephemeral', ephemeral.getSecretKey());
sessionStorage.setItem('zk_maxEpoch', String(maxEpoch));
sessionStorage.setItem('zk_randomness', randomness);
```

### Step 2 — redirect to OAuth provider

```typescript
// @check:skip
const params = new URLSearchParams({
  client_id: GOOGLE_CLIENT_ID,
  redirect_uri: 'http://localhost:3000/callback',
  response_type: 'id_token',
  scope: 'openid email',
  nonce,                                                 // critical
});
window.location.href =
  `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
```

### Step 3–4 — JWT → address

```typescript
// @check:skip
import { jwtToAddress, decodeJwt } from '@mysten/sui/zklogin';

const jwt = new URLSearchParams(window.location.hash.slice(1)).get('id_token')!;

// Salt should be fetched from your salt service (per-user, secret).
// For demos a fixed salt is fine; production needs per-user salts.
const userSalt = await fetchSaltForUser(jwt);            // string or bigint

const address = jwtToAddress(jwt, userSalt, /*legacy*/ false);
```

### Step 5 — fetch ZK proof from prover

```typescript
// @check:skip
const ephemeral = Ed25519Keypair.fromSecretKey(
  sessionStorage.getItem('zk_ephemeral')!,
);
const maxEpoch = Number(sessionStorage.getItem('zk_maxEpoch'));
const randomness = sessionStorage.getItem('zk_randomness')!;

const extendedEphemeralPublicKey = getExtendedEphemeralPublicKey(
  ephemeral.getPublicKey(),
);

const proofRes = await fetch('https://prover-dev.mystenlabs.com/v1', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    jwt,
    extendedEphemeralPublicKey,
    maxEpoch,
    jwtRandomness: randomness,
    salt: userSalt,
    keyClaimName: 'sub',
  }),
});
const partialZkLoginSignature = await proofRes.json();
// → { proofPoints, issBase64Details, headerBase64 }
```

### Step 6–7 — sign + assemble zkLogin signature

```typescript
// @check:skip
import { Transaction } from '@mysten/sui/transactions';
import { genAddressSeed, getZkLoginSignature } from '@mysten/sui/zklogin';
import { decodeJwt } from '@mysten/sui/zklogin';

const tx = new Transaction();
tx.setSender(address);
// ...tx.moveCall(...) etc.

const { bytes, signature: userSignature } =
  await tx.sign({ client: suiClient, signer: ephemeral });

const decoded = decodeJwt(jwt);
const addressSeed = genAddressSeed(
  BigInt(userSalt),
  'sub',
  decoded.sub!,
  decoded.aud as string,
).toString();

const zkLoginSignature = getZkLoginSignature({
  inputs: { ...partialZkLoginSignature, addressSeed },
  maxEpoch,
  userSignature,
});

const result = await suiClient.core.executeTransaction({
  transaction: bytes,
  signature: zkLoginSignature,
});
```

### `ZkLoginSigner` — official signer wrapper (sui ≥2.20)

Since `@mysten/sui@2.20.0` you no longer need to hand-assemble signatures with
`getZkLoginSignature` for every signing call. `ZkLoginSigner` wraps the ephemeral
signer + proof and behaves like any other `Signer` (works with
`client.signAndExecuteTransaction`, dapp-kit, etc.):

```typescript
// @check:skip — uses ephemeral/partialZkLoginSignature/addressSeed/maxEpoch/address from the flow above
import { ZkLoginSigner } from '@mysten/sui/zklogin';

const signer = new ZkLoginSigner({
  ephemeralSigner: ephemeral,
  inputs: { ...partialZkLoginSignature, addressSeed },
  maxEpoch,
  legacyAddress: false, // REQUIRED. Must match how the address was derived (jwtToAddress default: false)
  address, // optional but recommended: constructor throws if derived address mismatches
});

const { bytes, signature } = await signer.signTransaction(txBytes);
```

Notes (verified against `zklogin/signer.d.mts` 2.23.2 — identical to 2.22.0):
- `legacyAddress` is **required**; a wrong value silently derives a different address — always pass `address` to guard.
- `sign()` throws (typed `never`) like other composite signers; use `signTransaction` / `signPersonalMessage`.
- `getPublicKey()` returns `ZkLoginPublicIdentifier` (pass `client` in options if you want it to verify signatures).
- The manual `genAddressSeed` + `getZkLoginSignature` flow above remains valid — `ZkLoginSigner` is the same assembly packaged as a `Signer`.

## Move contract support

No special Move code is needed. zkLogin addresses are regular SUI addresses — `tx_context::sender(ctx)` returns them like any other.

```move
public fun create_profile(name: String, ctx: &mut TxContext) {
    let user = tx_context::sender(ctx);  // works with zkLogin
    // ...
}
```

## Security considerations

- Keep OAuth client secrets server-side; use PKCE / implicit flow for SPAs.
- Always validate JWT signature server-side before trusting it for high-value ops.
- Generate a fresh `randomness` (and therefore nonce) per login attempt.
- Persist the ephemeral key only for its short lifetime; rotate when `maxEpoch` passes.
- User salt is sensitive — leaking it links the OAuth identity to the on-chain address. Store server-side per user.

## Common Mistakes

**`import { ZkLoginProvider } from '@mysten/zklogin'` — both the symbol and the package are wrong.**
- Install `@mysten/sui@^2`, import from `@mysten/sui/zklogin`, use the functional API above.

**Skipping `extendedEphemeralPublicKey` when calling the prover.**
- The prover requires the *extended* public key; pass `getExtendedEphemeralPublicKey(ephemeral.getPublicKey())`, not the raw key.

**Using `jwt.sub` directly as `addressSeed`.**
- The seed is `genAddressSeed(salt, 'sub', sub, aud)` — a Poseidon hash. Using the raw sub gives the wrong address.

**Forgetting to call `tx.setSender(address)` before signing.**
- The ephemeral keypair signs *for* the zkLogin address. If sender isn't set to the zkLogin address, the signature won't verify on-chain.

**Reusing `maxEpoch` past expiry.**
- Once the current epoch exceeds `maxEpoch`, every signature fails. Refresh the ephemeral key + nonce + JWT.

## Resources

- [zkLogin docs (Sui)](https://docs.sui.io/concepts/cryptography/zklogin)
- [Mysten Prover service](https://docs.sui.io/guides/developer/cryptography/zklogin-integration)
- API source: `@mysten/sui/zklogin`
