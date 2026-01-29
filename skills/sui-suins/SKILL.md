---
name: sui-suins
description: Use when implementing SUI name service, resolving human-readable addresses, performing reverse lookups, or integrating SuiNS. Triggers on name service integration, address resolution needs, or domain name features.
---

# SUI SuiNS Integration

**Human-readable names for SUI addresses (like ENS for Ethereum).**

## Overview

SuiNS provides:
- Human-readable names (alice.sui)
- Reverse address lookup
- Name ownership and trading
- Subdomains support

## Use Cases

- User profiles
- Wallet address display
- Social features
- Payment requests
- Any user-facing addresses

## Quick Start

### Register Name

```move
use suins::registry;

public fun register_name(
    name: String,
    duration_years: u64,
    payment: Coin<SUI>,
    ctx: &mut TxContext
) {
    registry::register(
        name,
        duration_years,
        payment,
        ctx
    );
}
```

### Resolve Name to Address

```move
public fun resolve(name: String): Option<address> {
    registry::lookup(name)
}
```

## Frontend Integration

```typescript
import { SuiNSClient } from '@suins/sdk';

const suins = new SuiNSClient({ network: 'mainnet' });

// Resolve name to address
async function resolveName(name: string): Promise<string | null> {
  const address = await suins.getAddress(name);
  return address;
}

// Reverse lookup: address to name
async function getName(address: string): Promise<string | null> {
  const name = await suins.getName(address);
  return name;
}

// Register new name
async function registerName(name: string, years: number) {
  const txb = new TransactionBlock();

  const [coin] = txb.splitCoins(txb.gas, [txb.pure(calculateCost(years))]);

  txb.moveCall({
    target: `${SUINS_PACKAGE}::registry::register`,
    arguments: [
      txb.pure(name),
      txb.pure(years),
      coin
    ]
  });

  return await signAndExecute({ transactionBlock: txb });
}
```

## Display Name in UI

```typescript
function AddressDisplay({ address }: { address: string }) {
  const { data: name } = useQuery({
    queryKey: ['suins', address],
    queryFn: () => getName(address)
  });

  return (
    <span>
      {name || `${address.slice(0, 6)}...${address.slice(-4)}`}
    </span>
  );
}
```

## Best Practices

- Cache name resolutions
- Handle missing names gracefully
- Display both name and address
- Support .sui TLD
- Validate name format

## Common Mistakes

❌ **Not caching name resolutions**
- **Problem:** Excessive RPC calls, slow UI, rate limiting
- **Fix:** Use React Query with 5-minute cache for name lookups

❌ **Assuming all addresses have names**
- **Problem:** UI breaks when address has no SuiNS name
- **Fix:** Fallback to truncated address if name is null

❌ **Not validating name format**
- **Problem:** Invalid names sent to contract, transaction fails
- **Fix:** Validate: lowercase, alphanumeric+hyphens, ends with .sui

❌ **Forgetting to handle subdomain resolution**
- **Problem:** sub.alice.sui fails to resolve
- **Fix:** Use SuiNS SDK which handles subdomains automatically

❌ **Hard-coding name prices**
- **Problem:** Prices change, registration fails
- **Fix:** Query current pricing from SuiNS contract

❌ **Not showing expiration dates**
- **Problem:** Users lose names without warning
- **Fix:** Display expiration, send renewal reminders

❌ **Using names without ownership verification**
- **Problem:** Phishing via name squatting
- **Fix:** Verify name ownership on-chain before trusting

Query SuiNS docs:
```typescript
const suinsInfo = await sui_docs_query({
  type: "github",
  target: "suins",
  query: "name registration and resolution API"
});
```

---

**Make SUI addresses human-friendly!**
