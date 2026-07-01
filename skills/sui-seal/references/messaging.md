# Sui Stack Messaging — on-chain encrypted messaging

**Early (`0.x`).** `@mysten/messaging@0.3.0` (repo `MystenLabs/sui-stack-messaging-sdk`). Its
`@mysten/seal`, `@mysten/sui`, `@mysten/walrus` are **hard `dependencies` pinned to old majors**
(`@mysten/seal ^0.9.6`, `@mysten/sui ^1.45.2`, `@mysten/walrus ^0.8.6`), NOT peer-dep ranges — so
installing messaging pulls its own **nested** old seal/sui/walrus, diverging from whatever you pin at
top level. Expect churn while it is `0.x`.

> ⚠️ **Version-incompatibility landmine (read before you copy the Setup).** messaging@0.3.0 composes
> SEAL via `SealClient.asClientExtension(...)` (the `.$extend` factory) — that factory exists **only in
> `@mysten/seal` 0.9.x** and was **removed in seal 1.x**. This skill's main SEAL guidance
> (`sui-seal/SKILL.md`) documents seal **1.x**, where `SealClient` is instantiated directly with
> `new SealClient({ … })` and there is **no `asClientExtension` / no `$extend` factory**. **Consequence:
> messaging@0.3.0's documented composition pattern cannot be satisfied with the seal 1.x you use
> elsewhere** — it currently only works against seal 0.9.x. Do **NOT** silently downgrade your project to
> seal 0.9.x just to make the snippet compile: that reverts to an older, less-audited seal in an
> encryption-critical path. Treat this reference as a **preview** until messaging updates to seal 1.x.

> **Note:** these examples are import-resolution-checked by this repo's snippet gate but **NOT executed**
> — every fence is `// @check:skip`. Import-resolution only proves `@mysten/messaging` and its named
> exports exist at `0.3.0`; it does NOT prove the composed example runs (and per the landmine above, the
> Setup snippet does **not** run against seal 1.x). Symbols below were verified by hand against the
> published `0.3.0` `.d.ts`. Re-verify against the then-current `.d.ts` before relying on them.

## What it is — and when to reach for it

A high-level **encrypted group-messaging** SDK: channels live on-chain, each channel has a symmetric
encryption key wrapped with **SEAL** (threshold envelope encryption), message bodies + attachments are
stored on **Walrus**, and membership is enforced on-chain via `CreatorCap` / `MemberCap`. It is **live on
mainnet and testnet** (`MAINNET_MESSAGING_PACKAGE_CONFIG` / `TESTNET_MESSAGING_PACKAGE_CONFIG`).

Reach for it when the user wants chat / DMs / group channels on SUI with end-to-end-style encryption —
rather than hand-rolling SEAL + Walrus + membership yourself. It composes the primitives documented in
this skill (SEAL) and `sui-walrus` (blob storage).

## Setup — extension chain (messaging's own seal-0.9.x pattern)

This is messaging@0.3.0's **documented** composition, reproduced for reference. It requires
`@mysten/seal` **0.9.x** — see the landmine above; it does **not** compile against seal 1.x (no
`asClientExtension`). `messaging()` returns a `MessagingCompatibleClient =
ClientWithExtensions<{ core, seal, … }>`, so the client must already carry a `seal` extension, and
`messaging()`'s encrypt/decrypt path runs through it — **the SEAL extension must be registered before
`messaging()`.** The base client must provide `.core`; `SuiGrpcClient` does (`SuiClient` from
`@mysten/sui/client` was removed in sui 2.x).

```typescript
// @check:skip
// NOTE: `.asClientExtension` exists only in @mysten/seal 0.9.x (messaging@0.3.0's bundled dep);
// it was removed in seal 1.x. This snippet will NOT compile against the seal 1.x used elsewhere
// in this skill. Preview only until messaging updates to seal 1.x.
import { SuiGrpcClient } from '@mysten/sui/grpc';
import { SealClient } from '@mysten/seal';
import { messaging } from '@mysten/messaging';

const client = new SuiGrpcClient({ url: 'https://fullnode.testnet.sui.io' })
  .$extend(SealClient.asClientExtension({ serverConfigs: [/* { objectId, weight } key servers */] }))
  .$extend(
    messaging({
      // Walrus attachment storage: publisher/aggregator OR uploadRelay/aggregator, plus epochs
      walrusStorageConfig: { publisher: 'https://…', aggregator: 'https://…', epochs: 1 },
      sessionKeyConfig: { address: '0x…', ttlMin: 30 }, // SEAL SessionKey TTL
      // sealConfig: { threshold: 2 },                  // key-server threshold (default 2)
    }),
  );

// messaging methods hang off `client.messaging`
```

## Create a channel

One-shot:

```typescript
// @check:skip
const { digest, channelId, creatorCapId, encryptedKeyBytes } =
  await client.messaging.executeCreateChannelTransaction({
    signer,
    initialMembers: ['0xalice…', '0xbob…'], // optional
  });
```

Step-by-step flow (when you need the caps/key between steps):

```typescript
// @check:skip
const flow = client.messaging.createChannelFlow({
  creatorAddress: signer.toSuiAddress(),
  initialMemberAddresses: ['0xbob…'],
});
const tx = flow.build();
// …sign & execute tx to get `digest`…
const { creatorCap, creatorMemberCap } = await flow.getGeneratedCaps({ digest });
const { transaction, encryptedKeyBytes } =
  await flow.generateAndAttachEncryptionKey({ creatorCap, creatorMemberCap });
// …execute `transaction`…
const { channelId } = await flow.getGeneratedEncryptionKey({ creatorCap, encryptedKeyBytes });
```

## Send a message

`encryptedKey` is the channel's `EncryptedSymmetricKey` (from channel creation / fetched via the read
methods). `attachments` are `File[]` and are stored on Walrus.

```typescript
// @check:skip
const { digest, messageId } = await client.messaging.executeSendMessageTransaction({
  signer,
  channelId,
  memberCapId,          // the sender's MemberCap for this channel
  message: 'gm',
  encryptedKey,         // EncryptedSymmetricKey
  attachments: [],      // optional File[]
});
```

## Add members

```typescript
// @check:skip
// With signer's address it auto-fetches the CreatorCap:
const { digest, addedMembers } = await client.messaging.executeAddMembersTransaction({
  signer,
  channelId,
  memberCapId,
  newMemberAddresses: ['0xcarol…'],
});
// addedMembers: { memberCap, ownerAddress }[]
```

## Read messages (decrypted) + poll

Both methods return **decrypted** messages (they decrypt via the seal client under the hood).

```typescript
// @check:skip
// Paginated history:
const page = await client.messaging.getChannelMessages({
  channelId,
  userAddress: signer.toSuiAddress(),
  cursor: undefined,
  limit: 50,
  direction: 'backward',
});

// Incremental polling — pass the prior pollingState back in each tick:
const fresh = await client.messaging.getLatestMessages({
  channelId,
  userAddress: signer.toSuiAddress(),
  pollingState: page.pollingState,
  limit: 50,
});
```

Other reads: `getChannelMemberships(request)`, `getChannelMembers(channelId)`,
`getUserMemberCap(userAddress, channelId)`, `getCreatorCap(userAddress, channelId)`.

## Session keys

The client either manages the SEAL `SessionKey` (via `sessionKeyConfig`) or takes an external one (via
`sessionKey`). For managed keys, `refreshSessionKey()` forces a refresh; for external keys (e.g. a React
context), `updateSessionKey(newSessionKey)` swaps it in.

## Config surface (verified vs `0.3.0` `.d.ts`)

- `walrusStorageConfig: StorageConfig` — `{ publisher, aggregator, epochs }` OR `{ uploadRelay, aggregator, epochs }`. (Or pass a custom `storage` adapter instead.)
- `sessionKeyConfig: SessionKeyConfig` — `{ address, ttlMin, mvrName?, signer? }`.
- `sealConfig: SealConfig` — `{ threshold? }` (default `2`). Key **servers** are configured separately via `SealClient.asClientExtension({ serverConfigs })`, not here.
- `packageConfig` — defaults to the network's `*_MESSAGING_PACKAGE_CONFIG`; override only for a custom deployment.
