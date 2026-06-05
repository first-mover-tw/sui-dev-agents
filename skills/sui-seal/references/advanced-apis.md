<!-- Verified against @mysten/seal 1.1.3 d.mts on 2026-06-04: client.d.mts, types.d.mts, bcs.d.mts, session-key.d.mts -->

# Seal Advanced APIs (≥1.1.3)

Newer `@mysten/seal` exports for diagnostics, key reuse, blob introspection, and session persistence. These go beyond the basic `encrypt` / `decrypt` flow documented in `SKILL.md`.

## Contents

- [`getKeyServers`](#getkeyservers)
- [`getPublicKeys`](#getpublickeys)
- [`getDerivedKeys`](#getderivedkeys)
- [`GetDerivedKeysOptions`](#getderivedkeysoptions)
- [`EncryptedObject`](#encryptedobject)
- [`ExportedSessionKey`](#exportedsessionkey)

---

## `getKeyServers`

`SealClient` method.

```text
getKeyServers(): Promise<Map<string, KeyServer>>;
```
(`client.d.mts:59`)

**What:** Returns a map of `objectId → KeyServer` metadata for every key server the client is configured against.

**When:** Reach for this when you need to enumerate the servers backing a threshold policy — diagnostics dashboards, health checks, or UI that shows "this blob is protected by N of M servers." It's the introspection counterpart to the `serverConfigs` you passed into `new SealClient(...)`: instead of re-deriving config yourself, you ask the client which servers it actually resolved and what their on-chain metadata looks like.

## `getPublicKeys`

`SealClient` method.

```text
getPublicKeys(services: string[]): Promise<G2Element[]>;
```
(`client.d.mts:67`)

**What:** Fetches the BLS public keys (G2 group elements) for the given key-server object IDs.

**When:** You need the raw public keys for client-side verification or advanced encryption setups that avoid a full server round-trip. The basic `encrypt` path fetches these for you implicitly; call `getPublicKeys` directly when you're pre-computing encryption material, verifying derived keys yourself, or caching keys to cut latency across many encrypt operations against the same server set.

## `getDerivedKeys`

`SealClient` method.

```text
getDerivedKeys({ kemType, id, txBytes, sessionKey, threshold }: GetDerivedKeysOptions): Promise<Map<string, DerivedKey>>;
```
(`client.d.mts:95`)

**What:** Returns the per-server derived keys for one identity (`id`), keyed by server `objectId`, **without** running a full decrypt.

**When:** This is the key-reuse primitive. If you have many encrypted objects that share the same IBE `id` (same policy, same identity), a normal `decrypt` would re-fetch derived keys from the key servers every single time. Instead, call `getDerivedKeys` once, cache the returned map, and feed those keys into subsequent local decrypts — you pay the key-server round-trip once instead of per object. The `txBytes` must still call your `seal_approve*` Move function (servers dry-run it to authorize), and you still need `threshold` servers to respond, but you amortize that cost across the whole batch.

## `GetDerivedKeysOptions`

Interface (`types.d.mts:66-76`, re-exported via `index.d.mts`).

```text
interface GetDerivedKeysOptions {
  kemType?: KemType;
  id: string;          // id of the encrypted object
  txBytes: Uint8Array; // tx bytes that call seal_approve* functions
  sessionKey: SessionKey;
  threshold: number;
}
```

**What:** The options bag for [`getDerivedKeys`](#getderivedkeys).

**When:** Same scenario as `getDerivedKeys`. Note `txBytes` is a `TransactionKind` (`tx.build({ client, onlyTransactionKind: true })`) that invokes the relevant `seal_approve*` entry — the servers authorize derivation by dry-running it, exactly as in `decrypt`. `kemType` is optional; leave it unset to use the client default.

## `EncryptedObject`

A BCS struct (`declare const EncryptedObject: BcsStruct<{...}>`, `bcs.d.mts:7-37`, re-exported via `index.d.mts`).

Decode raw encrypted bytes with `EncryptedObject.parse(bytes)`. It is a `BcsStruct`, so use `.parse()` — **not** `new EncryptedObject(...)`.

Decoded shape:

```text
{
  version: number (u8)
  packageId: string (bytes[32])
  id: string
  services: [string, number][]   // (objectId, index) pairs
  threshold: number (u8)
  encryptedShares: enum "IBEEncryptions" {
    BonehFranklinBLS12381: {
      nonce: bytes[96],
      encryptedShares: Uint8Array[],
      encryptedRandomness: bytes[32]
    }
  }
  ciphertext: enum "Ciphertext" {
    Aes256Gcm: { blob, aad: Option },
    Hmac256Ctr: { blob, aad: Option, mac: bytes[32] },
    Plain: {}
  }
}
```

**What:** The on-the-wire BCS layout of a Seal-encrypted blob.

**When:** Inspect a blob's metadata **without decrypting it** — which servers protect it (`services`), the `threshold`, the `packageId`, and the IBE `id`. Useful to validate that a blob matches an expected policy before attempting decryption, to route a decrypt request to the correct key servers, or to debug why decryption is failing (wrong package, wrong server set, unexpected ciphertext variant). Because it's pure structural decoding, it needs no key servers and no session key.

## `ExportedSessionKey`

Type (`session-key.d.mts:14-22`).

```text
type ExportedSessionKey = {
  address: string;
  packageId: string;
  mvrName?: string;
  creationTimeMs: number;
  ttlMin: number;
  personalMessageSignature?: string;
  sessionKey: string;
};
```

Produced by `SessionKey#export(): ExportedSessionKey` (`session-key.d.mts:73`).

Restore via `SessionKey.import(data: ExportedSessionKey, suiClient: SealCompatibleClient, signer?: Signer): SessionKey` (`session-key.d.mts:78`).

**What:** A serializable snapshot of a `SessionKey`, including the captured personal-message signature.

**When:** Persist an authenticated session across page reloads, or hand it from a tab to a Web Worker, **without re-prompting the user to sign a new personal message**. The expensive/annoying part of a session key is the user signature; once you have it, `export()` gives you a plain object you can stash (e.g. in `sessionStorage`) and later `import()` back into a live `SessionKey`. The restored session stays valid until `ttlMin` elapses from `creationTimeMs` — after that you must mint and sign a fresh one. Treat the exported blob as sensitive: anyone holding it can decrypt within the policy until it expires.
