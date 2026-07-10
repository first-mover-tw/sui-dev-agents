---
name: sui-walrus
description: Use when storing or retrieving files using Walrus — SUI's decentralized blob storage. Triggers on "Walrus", "blob storage", "upload file to chain", "decentralized storage", "store NFT image", "IPFS alternative on SUI", "where to store NFT metadata", "host a site on-chain", or any off-chain data storage needs on SUI. Also use for Walrus Sites (decentralized web hosting), storing game assets, media files, or when the user asks "where do I put large files on SUI". Also covers Walrus Memory (the @mysten-incubation/memwal beta SDK) — trigger on "Walrus Memory", "portable agent memory", "AI agent memory", "agent memory layer", "store agent memories", or giving an AI agent durable cross-session memory.
---

# SUI Walrus Integration

**Decentralized blob storage for NFTs, media, and large files.**

## SDK Versions

Targets: `@mysten/walrus` 1.2.4 (^1.1), `@mysten/sui` 2.20.2 (^2.16). Tested: 2026-07-10.

**Compatibility notes:** `@mysten/walrus@1.x` declares `@mysten/sui ^2.16.0` as a peer dependency. Do not install on top of a sui 1.x project — npm will pull a second sui copy and you will get dual-`SuiClient` type errors. The walrus JS SDK only works against `SuiGrpcClient` / `SuiJsonRpcClient` from sui 2.x. Run `npm ls @mysten/sui` first — if 1.x is present, decide before installing: upgrade the project to sui 2.x, or stay on legacy walrus tooling (CLI only).

## Overview

Walrus provides:
- Decentralized blob storage (images, videos, metadata)
- Content-addressable storage (immutable blob IDs)
- High availability through erasure coding
- Integration with SUI Move contracts

## Use Cases

- NFT metadata and images
- Game assets and textures
- Document storage
- Media CDN
- DApp static assets

## Quick Start

There are two integration paths. Use the **JS SDK** for in-app uploads (browser/Node) where the user pays for their own storage. Use **publishers/aggregators** (HTTP) when you want the lightest client — most apps should start there. The CLI is for local tooling and ops.

### JS SDK (recommended for apps)

```bash
npm install @mysten/walrus @mysten/sui
```

Setup — extend a sui 2.x client with the walrus plugin:

```typescript
import { SuiGrpcClient } from '@mysten/sui/grpc';
import { walrus } from '@mysten/walrus';

const client = new SuiGrpcClient({
  network: 'testnet',
  baseUrl: 'https://fullnode.testnet.sui.io:443',
}).$extend(walrus());
```

Read a blob:

```typescript
// @check:skip
const bytes = await client.walrus.readBlob({ blobId });
```

Write a blob (requires a `Signer` and SUI for gas + WAL for storage fees):

```typescript
// @check:skip
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';

const signer = Ed25519Keypair.fromSecretKey(/* ... */);

const { blobId } = await client.walrus.writeBlob({
  blob: new Uint8Array(/* ... */),
  deletable: false,
  epochs: 3,
  signer,
});
```

For crash-recoverable uploads use `writeBlobFlow` / `writeFilesFlow` (see the package README — the flow API exposes `register` / `upload` / `certify` steps with `onStep` and `resume` hooks). Catch `RetryableWalrusClientError` to reset cached state on epoch changes.

> Reading/writing raw blobs through the SDK requires hundreds to thousands of node requests per blob. For high-traffic apps, prefer the upload-relay or publishers/aggregators path.

### Install Walrus CLI

```bash
# Install Walrus CLI
cargo install walrus-cli

# Configure network
walrus config --network testnet
```

### Upload Blob

```bash
# Upload file to Walrus
walrus upload myimage.png

# Returns blob ID: bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi
```

### Store Blob ID in Move

```move
module nft::metadata {
    use sui::object::{Self, UID};
    use std::string::String;

    public struct NFT has key, store {
        id: UID,
        name: String,
        walrus_blob_id: vector<u8>,  // Store blob ID
    }

    public fun create_nft(
        name: String,
        walrus_blob_id: vector<u8>,
        ctx: &mut TxContext
    ): NFT {
        NFT {
            id: object::new(ctx),
            name,
            walrus_blob_id,
        }
    }

    public fun metadata_url(nft: &NFT): String {
        // Construct Walrus URL
        string::utf8(b"walrus://")
            .append(string::utf8(nft.walrus_blob_id))
    }
}
```

## Frontend Integration

### Upload from Browser

Use the real `@mysten/walrus` extension on a v2 Sui client (see the `$extend(walrus())` examples earlier in this file). There is no separate `@walrus-sdk/client` package — that name is fabricated. A minimal upload + Move-call pattern looks like:

```typescript
// @check:skip
import { SuiGrpcClient } from '@mysten/sui/grpc';
import { walrus } from '@mysten/walrus';
import { Transaction } from '@mysten/sui/transactions';

const client = new SuiGrpcClient({
  network: 'testnet',
  baseUrl: 'https://fullnode.testnet.sui.io:443',
}).$extend(walrus());

async function uploadNFTMetadata(file: File, signer) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const { blobId } = await client.walrus.writeBlob({
    blob: bytes,
    deletable: false,
    epochs: 5,
    signer,
  });

  const tx = new Transaction();
  tx.moveCall({
    target: `${PACKAGE_ID}::nft::create_nft`,
    arguments: [tx.pure.string('My NFT'), tx.pure.string(blobId)],
  });

  return blobId;
}
```

### Retrieve and Display

```tsx
function NFTImage({ blobId }: { blobId: string }) {
  const url = `https://walrus-testnet.storage/${blobId}`;

  return <img src={url} alt="NFT" />;
}
```

## Best Practices

- Store blob ID (32 bytes) in Move, not full URL
- Upload metadata and images separately
- Use IPFS CID format for compatibility
- Implement retry logic for uploads
- Cache blob IDs for quick access

## Common Mistakes

❌ **Storing full URL in Move contract**
- **Problem:** URLs change, wastes storage (200+ bytes vs 32 bytes)
- **Fix:** Store only blob ID, construct URL in frontend

❌ **No retry logic on upload failure**
- **Problem:** Network failures break user experience
- **Fix:** Implement exponential backoff retry (3-5 attempts)

❌ **Uploading without checksum verification**
- **Problem:** Silent corruption, blob ID mismatch
- **Fix:** Verify blob ID matches uploaded content hash

❌ **Hardcoding Walrus gateway URLs**
- **Problem:** Gateway changes break all URLs
- **Fix:** Use environment variables for gateway URLs

❌ **Not handling large file uploads**
- **Problem:** Browser memory issues, upload timeout
- **Fix:** Implement chunked upload for files >10MB

Query latest Walrus docs via the in-repo `sui-docs-query` skill (not an SDK function — invoke the skill from Claude Code with args like `type=docs target=walrus query="blob upload API and storage patterns"`).

## See Also

- [advanced-apis.md](references/advanced-apis.md) — Read when working with WalrusFile/WalrusBlob, batching small files via quilts (`encodeQuilt`), converting blob IDs (int ↔ string), or needing network package-config constants (walrus ≥1.1.7)
- [memory.md](references/memory.md) — Read when the user wants Walrus Memory / portable agent memory / AI agent memory (the `@mysten-incubation/memwal` beta SDK): an agent memory layer (store + SEAL-encrypt + onchain ownership + semantic recall) built on top of raw Walrus blob storage
- On-chain **encrypted messaging** (the `@mysten/messaging` SDK) uses Walrus for attachment storage — documented under [sui-seal/references/messaging.md](../sui-seal/references/messaging.md)

---

**Decentralized, permanent storage for your SUI NFTs and dApps!**
