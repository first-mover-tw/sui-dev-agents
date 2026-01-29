---
name: sui-tools-guide
description: Use when selecting SUI ecosystem tools, comparing integration options, or deciding between multiple libraries. Triggers on tool selection decisions, ecosystem navigation, or integration pattern questions.
---

# SUI Tools Guide

**Navigate the SUI ecosystem and choose the right tools for your project.**

## Overview

This guide helps you:
- Understand available SUI ecosystem tools
- Choose the right tools for your use case
- Learn how to combine multiple tools
- Get started quickly with integration patterns

## Available Tools

### Storage & Data
- **Walrus** - Decentralized blob storage for NFT metadata, files, and media
- **Arweave** - Permanent storage alternative

### Identity & Auth
- **zkLogin** - OAuth-based authentication (Google, Facebook, Twitch)
- **Passkey** - WebAuthn passwordless login
- **Multi-sig** - Multi-signature wallets

### DeFi & Trading
- **DeepBook** - Decentralized order book DEX
- **Cetus** - AMM protocol
- **Turbos** - AMM with concentrated liquidity

### NFT Infrastructure
- **Kiosk** - NFT trading standard with transfer policies and royalties
- **OriginByte** - NFT protocol suite

### Domain & Identity
- **SuiNS** - SUI Name Service (human-readable addresses)

### Advanced Features
- **Seal** - Sealed-bid auctions
- **Nautilus** - Cross-chain bridge

## Decision Tree

### "I'm building..."

**NFT Marketplace**
→ Use: Kiosk (required), Walrus (metadata), SuiNS (optional)

**DeFi Protocol**
→ Use: DeepBook (orderbook) or Cetus/Turbos (AMM)

**GameFi**
→ Use: Kiosk (items), Walrus (assets), zkLogin (easy onboarding)

**DAO**
→ Use: Multi-sig, custom governance

**Social Platform**
→ Use: zkLogin (auth), Walrus (media), SuiNS (profiles)

## Tool Combinations

### NFT Marketplace Stack
```
Kiosk (NFT standard)
  + Walrus (metadata storage)
  + zkLogin (user auth)
  + SuiNS (seller profiles)
```

### DeFi Trading Stack
```
DeepBook (orderbook)
  + Pyth/Switchboard (price feeds)
  + Multi-sig (treasury)
```

### GameFi Stack
```
Kiosk (in-game items)
  + Walrus (game assets)
  + zkLogin (player login)
  + Leaderboard (custom)
```

## Quick Start for Each Tool

For detailed integration, use the specific tool skills:
- `sui-walrus` - Walrus integration
- `sui-zklogin` - zkLogin integration
- `sui-deepbook` - DeepBook integration
- `sui-kiosk` - Kiosk integration
- `sui-passkey` - Passkey integration
- `sui-seal` - Sealed auction integration
- `sui-nautilus` - Bridge integration
- `sui-suins` - SuiNS integration

## Integration Complexity Matrix

| Tool | Complexity | Time to Integrate | Required For |
|------|-----------|-------------------|--------------|
| Kiosk | Medium | 1-2 days | NFT marketplaces |
| Walrus | Low | 2-4 hours | Decentralized storage |
| zkLogin | Medium | 1 day | OAuth authentication |
| DeepBook | High | 3-5 days | Orderbook DEX |
| SuiNS | Low | 1-2 hours | Name resolution |
| Passkey | Low | 2-4 hours | Passwordless auth |
| Seal | Medium | 1-2 days | Sealed auctions |
| Nautilus | High | 3-7 days | Cross-chain |

## Common Patterns

### Pattern 1: NFT with Metadata
```move
// Store blob ID in NFT
public struct NFT has key, store {
    id: UID,
    name: String,
    walrus_blob_id: vector<u8>
}
```

### Pattern 2: User Identity
```move
// Support both zkLogin and traditional wallets
public fun authenticate(
    zklogin_proof: Option<ZkLoginProof>,
    ctx: &TxContext
) {
    let user = if (option::is_some(&zklogin_proof)) {
        // Verify zkLogin
        zklogin::verify(option::borrow(&zklogin_proof))
    } else {
        // Traditional wallet
        tx_context::sender(ctx)
    };
}
```

### Pattern 3: Trading with Royalties
```move
// Kiosk + custom royalty logic
use sui::kiosk;
use sui::transfer_policy;

public fun buy_with_royalty<T: key + store>(
    kiosk: &mut Kiosk,
    item_id: ID,
    payment: Coin<SUI>,
    policy: &TransferPolicy<T>,
    ctx: &mut TxContext
) {
    // Kiosk handles transfer policy enforcement
    kiosk::purchase(kiosk, item_id, payment, policy, ctx);
}
```

## Recommended Combinations

### Beginner Projects
Start simple:
- NFT collection → Just Kiosk
- Simple marketplace → Kiosk + basic UI
- DeFi token → Standard Coin module

### Intermediate Projects
Add one ecosystem tool:
- NFT marketplace → Kiosk + Walrus
- Social app → zkLogin + custom logic
- Trading app → DeepBook + price feeds

### Advanced Projects
Combine multiple tools:
- Full marketplace → Kiosk + Walrus + zkLogin + SuiNS
- DeFi protocol → DeepBook + Oracle + Multi-sig + Governance
- Cross-chain app → Nautilus + Kiosk + DeepBook

## When NOT to Use Ecosystem Tools

**Don't over-engineer:**
- Simple NFT collection → Don't need zkLogin, SuiNS, etc.
- Internal tools → Don't need decentralized storage
- MVP/prototype → Start with core features only

**Build custom when:**
- Unique requirements not met by existing tools
- Performance is critical
- You need full control

## Common Mistakes

❌ **Using tools without understanding tradeoffs**
- **Problem:** Wrong tool for use case, technical debt
- **Fix:** Review tool complexity matrix, start simple

❌ **Integrating all tools at once**
- **Problem:** Overwhelming complexity, delays launch
- **Fix:** Start with core tool (e.g., Kiosk), add others later

❌ **Not checking tool maintenance status**
- **Problem:** Using deprecated/unmaintained tools
- **Fix:** Query GitHub activity, check latest docs before integrating

❌ **Skipping testnet before mainnet**
- **Problem:** Tool integration bugs discovered in production
- **Fix:** Test full stack on testnet for 48+ hours

❌ **Choosing tools based on hype**
- **Problem:** Tool doesn't fit your actual needs
- **Fix:** Use decision tree, focus on requirements not trends

❌ **Not reading tool-specific documentation**
- **Problem:** Incorrect implementation, missing features
- **Fix:** Use tool-specific skills (sui-walrus, sui-zklogin, etc.)

❌ **Over-relying on ecosystem tools for core logic**
- **Problem:** Locked into external dependencies
- **Fix:** Build core business logic in-house, use tools for infrastructure

## Getting Help

Each tool has its own skill for detailed integration:
```bash
# Example: Get Walrus integration help
sui-walrus

# Example: Get zkLogin help
sui-zklogin
```

Query latest tool updates:
```typescript
const toolInfo = await sui_docs_query({
  type: "docs",
  target: "walrus",
  query: "latest features and API updates"
});
```

---

**Choose the right tools, build faster, leverage the SUI ecosystem!**
