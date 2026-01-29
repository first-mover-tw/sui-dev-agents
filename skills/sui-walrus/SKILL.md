---
name: sui-walrus
description: Use when implementing decentralized storage for NFTs, media files, or large blobs on SUI. Triggers on Walrus blob upload, content-addressable storage needs, or permanent file hosting requirements.
---

# SUI Walrus Integration

**Decentralized blob storage for NFTs, media, and large files.**

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

```typescript
import { WalrusClient } from '@walrus-sdk/client';

const client = new WalrusClient({ network: 'testnet' });

async function uploadNFTMetadata(file: File) {
  // Upload to Walrus
  const blobId = await client.upload(file);

  // Store in Move contract
  const txb = new TransactionBlock();
  txb.moveCall({
    target: `${PACKAGE_ID}::nft::create_nft`,
    arguments: [
      txb.pure('My NFT'),
      txb.pure(Array.from(Buffer.from(blobId, 'hex')))
    ]
  });

  return blobId;
}
```

### Retrieve and Display

```typescript
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

Query latest Walrus docs:
```typescript
const walrusInfo = await sui_docs_query({
  type: "docs",
  target: "walrus",
  query: "blob upload API and storage patterns"
});
```

---

**Decentralized, permanent storage for your SUI NFTs and dApps!**
