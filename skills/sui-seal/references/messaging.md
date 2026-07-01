# Sui Stack Messaging — on-chain encrypted messaging

**Early (`0.x`).** `@mysten/messaging@0.3.0` (repo `MystenLabs/sui-stack-messaging-sdk`). Peer deps are
ranges (`@mysten/seal ^0.9.6`, `@mysten/sui ^1.45.2`, `@mysten/walrus ^0.8.6`) — expect the API to churn
while it is `0.x` (the older `experimental_asClientExtension` is already `@deprecated`).

> **Note:** these examples are import-resolution-checked by this repo's snippet gate but **NOT executed**
> — every fence is `// @check:skip`. Import-resolution only proves `@mysten/messaging` and its named
> exports exist at `0.3.0`; it does NOT prove the composed example runs. Symbols below were verified by
> hand against the published `0.3.0` `.d.ts`. Re-verify against the then-current `.d.ts` before relying
> on them.

## What it is — and when to reach for it

A high-level **encrypted group-messaging** SDK: channels live on-chain, each channel has a symmetric
encryption key wrapped with **SEAL** (threshold envelope encryption), message bodies + attachments are
stored on **Walrus**, and membership is enforced on-chain via `CreatorCap` / `MemberCap`. It is **live on
mainnet and testnet** (`MAINNET_MESSAGING_PACKAGE_CONFIG` / `TESTNET_MESSAGING_PACKAGE_CONFIG`).

Reach for it when the user wants chat / DMs / group channels on SUI with end-to-end-style encryption —
rather than hand-rolling SEAL + Walrus + membership yourself. It composes the primitives documented in
this skill (SEAL) and `sui-walrus` (blob storage).

## Setup — extension chain (order matters)

The SEAL extension MUST be registered **before** `messaging()`: `messaging()` returns a
`MessagingCompatibleClient = ClientWithExtensions<{ core, seal, ... }>` and its encrypt/decrypt path runs
through the already-attached seal client. Register them out of order and it fails at runtime (the types
may not catch it). Use a `.core`-providing client — `SuiGrpcClient` (`SuiClient` from `@mysten/sui/client`
was removed in sui 2.x).

```typescript
// @check:skip
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
