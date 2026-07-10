---
name: sui-suins
description: Use when integrating SuiNS (SUI Name Service) — resolving .sui names to addresses, reverse lookups, or registering names. Triggers on "SuiNS", ".sui name", "name resolution", "reverse lookup", "human-readable address", or any name service integration. Also use when the user wants to display user-friendly names instead of hex addresses.
---

# SUI SuiNS Integration

**Human-readable names for SUI addresses (like ENS for Ethereum).**

## SDK Versions

Targets: `@mysten/suins` 1.2.4 (^1.1), `@mysten/sui` 2.20.2 (^2.16). Tested: 2026-07-10.

**Compatibility notes:** `@mysten/sui` is a peer dependency. Use `SuinsClient.getNameRecord(name): Promise<NameRecord | null>` (NameRecord has `targetAddress`) — there is no `getAddress` / `getName`. Reverse lookup goes through `client.core.defaultNameServiceName({ address })`.

## Overview

SuiNS provides:
- Human-readable names (alice.sui)
- Reverse address lookup
- Name ownership and trading
- Subdomains support

## SUI v1.69 SuiNS API Changes

**GraphQL Breaking Changes:**
- `Query.suinsName(name: ...)` → `Query.address(name: ...)` for resolving SuiNS names
- `IAddressable.defaultSuinsName` → `IAddressable.defaultNameRecord.target` for reverse lookup
- New `Query.nameRecord` for fetching the full SuiNS NameRecord for a given name

```graphql
# Old (deprecated)
query { suinsName(name: "alice.sui") { address } }

# New (v1.64+, current)
query { address(name: "alice.sui") }
query { nameRecord(name: "alice.sui") { ... } }
```

## Use Cases

- User profiles
- Wallet address display
- Social features
- Payment requests
- Any user-facing addresses

## Quick Start

### Register Name

On-chain registration is a multi-step PTB through the SuiNS payment package
(price quote → payment intent → receipt → NFT), which is exactly why
`@mysten/suins` ships `SuinsTransaction.register` — it builds the whole PTB for
you. There is no single `registry::register` Move call to target.

```typescript
// @check:skip
import { SuinsClient, SuinsTransaction } from '@mysten/suins';
import { Transaction } from '@mysten/sui/transactions';

const suinsClient = new SuinsClient({ client, network: 'mainnet' });

async function registerName(domain: string, years: number) {
  const tx = new Transaction();
  const suinsTx = new SuinsTransaction(suinsClient, tx);

  // `register` builds the full payment PTB and returns the finalized name NFT.
  // `coinConfig` picks the payment asset. USDC is the base asset (priced
  // directly, no oracle), so it needs no Pyth feed — the simplest path.
  // `coin` is the payment Coin<USDC> input covering the price.
  //
  // Paying in SUI or NS instead requires their Pyth price feed: pass a
  // `priceInfoObjectId` (the SDK throws "Price info object ID is required for
  // non-base asset purchases" without it). See the SuiNS SDK registration guide
  // for price quoting (getPriceList / calculatePrice) and the Pyth plumbing.
  const nft = suinsTx.register({
    domain,
    years,
    coinConfig: suinsClient.config.coins.USDC,
    coin,
  });

  // Optional: point the name at the owner immediately.
  suinsTx.setTargetAddress({ nft, address: owner });

  tx.transferObjects([nft], owner);
  return await signAndExecute({ transaction: tx });
}
```

### Resolve Name to Address

Resolution is a read — do it off-chain via the SDK (`getNameRecord`) or GraphQL
(see below), not from Move. The SDK example is in **Frontend Integration**.

## Frontend Integration

```typescript
// @check:skip
import { SuinsClient } from '@mysten/suins';
import { SuiGrpcClient } from '@mysten/sui/grpc';

const client = new SuiGrpcClient({
  network: 'mainnet',
  baseUrl: 'https://fullnode.mainnet.sui.io:443',
});
const suins = new SuinsClient({ client, network: 'mainnet' });

// Resolve name to address via NameRecord
async function resolveName(name: string): Promise<string | null> {
  const record = await suins.getNameRecord(name);
  return record?.targetAddress ?? null;
}

// Reverse lookup: address to default name (provided by SuiGrpcClient core)
async function getName(address: string): Promise<string | null> {
  const res = await client.core.defaultNameServiceName({ address });
  return res.data.name;
}

// To register a name, use `SuinsTransaction.register` — see the Register Name
// section above. Registration is a payment PTB built by the SDK, not a single
// Move call.
```

## Display Name in UI

```tsx
// @check:skip
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

For the current SuiNS registration/resolution API, use the **sui-docs-query** skill (Context7 MCP).

---

**Make SUI addresses human-friendly!**
