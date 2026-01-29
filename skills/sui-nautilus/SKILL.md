---
name: sui-nautilus
description: Use when implementing cross-chain asset transfers, bridging tokens between SUI and other blockchains, or integrating Nautilus bridge. Triggers on cross-chain transfer needs, bridge integration, or multi-chain asset management.
---

# SUI Nautilus Integration

**Cross-chain bridge for moving assets between SUI and other blockchains.**

## Overview

Nautilus provides:
- Cross-chain asset transfers
- Bridge between SUI and EVM chains
- Liquidity pools
- Message passing

## Use Cases

- Multi-chain dApps
- Cross-chain DEX
- Asset migration
- Liquidity bridging

## Quick Start

### Bridge Assets to SUI

```move
use nautilus::bridge;

public fun bridge_from_ethereum(
    proof: vector<u8>,
    amount: u64,
    recipient: address,
    ctx: &mut TxContext
) {
    bridge::process_deposit(
        proof,
        amount,
        recipient,
        ctx
    );
}
```

### Bridge Assets from SUI

```move
public fun bridge_to_ethereum(
    coin: Coin<SUI>,
    eth_address: vector<u8>,
    ctx: &mut TxContext
) {
    bridge::initiate_withdrawal(
        coin,
        eth_address,
        ctx
    );
}
```

## Frontend Integration

```typescript
// Bridge SUI to Ethereum
async function bridgeToEthereum(amount: number, ethAddress: string) {
  const txb = new TransactionBlock();

  const [coin] = txb.splitCoins(txb.gas, [txb.pure(amount)]);

  txb.moveCall({
    target: `${NAUTILUS_PACKAGE}::bridge::initiate_withdrawal`,
    arguments: [
      coin,
      txb.pure(Array.from(Buffer.from(ethAddress.slice(2), 'hex')))
    ]
  });

  return await signAndExecute({ transactionBlock: txb });
}
```

## Best Practices

- Verify bridge security
- Check bridge liquidity
- Handle confirmation times
- Implement status tracking
- Test on testnets first

## Common Mistakes

❌ **Not checking bridge liquidity before transfer**
- **Problem:** Transfer fails, funds stuck in bridge
- **Fix:** Query bridge reserves, warn users if liquidity is low

❌ **Ignoring confirmation times**
- **Problem:** Users think transfer failed, support tickets
- **Fix:** Display estimated time (SUI→ETH: ~10min, ETH→SUI: ~15min)

❌ **Not validating destination address format**
- **Problem:** Funds sent to invalid address, permanently lost
- **Fix:** Validate Ethereum address (0x..., 42 chars) before bridging

❌ **Missing bridge event monitoring**
- **Problem:** Cannot track transfer status, poor UX
- **Fix:** Subscribe to bridge events (Initiated, Completed, Failed)

❌ **Not handling bridge failures gracefully**
- **Problem:** Funds locked, no refund mechanism
- **Fix:** Implement timeout-based refunds, show retry option

❌ **Using bridge on mainnet without testnet testing**
- **Problem:** Real funds lost due to bugs
- **Fix:** Test full bridge flow on testnets first

❌ **Not accounting for bridge fees**
- **Problem:** Unexpected cost, transaction fails
- **Fix:** Query bridge fees, display total cost to user upfront

Query Nautilus docs:
```typescript
const nautilusInfo = await sui_docs_query({
  type: "github",
  target: "nautilus",
  query: "cross-chain bridge integration guide"
});
```

---

**Connect SUI to the multi-chain ecosystem!**
