# Code Examples

Detailed code examples for each integration pattern.

## Type Generation Script

```typescript
// scripts/generate-types.ts
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

async function generateTypes() {
  console.log('🔨 Building Move package...');

  // Build Move package to generate ABI
  execSync('sui move build', { stdio: 'inherit' });

  // Read package metadata
  const buildDir = 'build/marketplace';
  const packagePath = path.join(buildDir, 'package-metadata.json');

  if (!fs.existsSync(packagePath)) {
    throw new Error('Package metadata not found. Run sui move build first.');
  }

  const metadata = JSON.parse(fs.readFileSync(packagePath, 'utf-8'));

  // Generate TypeScript types
  const types = generateTypeScriptFromABI(metadata);

  // Write to frontend
  const outputPath = 'frontend/src/types/contracts.ts';
  fs.writeFileSync(outputPath, types);

  console.log(`✅ Generated types: ${outputPath}`);
}

function generateTypeScriptFromABI(metadata: any): string {
  let output = '// Auto-generated from Move ABI\n';
  output += '// DO NOT EDIT MANUALLY\n\n';

  // Generate struct types
  for (const module of metadata.modules) {
    for (const struct of module.structs) {
      output += `export interface ${struct.name} {\n`;

      for (const field of struct.fields) {
        const tsType = moveTypeToTypeScript(field.type);
        output += `  ${field.name}: ${tsType};\n`;
      }

      output += '}\n\n';
    }
  }

  return output;
}

function moveTypeToTypeScript(moveType: string): string {
  const typeMap: Record<string, string> = {
    'u8': 'number',
    'u64': 'number | bigint',
    'u128': 'bigint',
    'bool': 'boolean',
    'address': 'string',
    'vector<u8>': 'Uint8Array',
    'String': 'string',
    'ID': 'string',
    'UID': 'string',
  };

  return typeMap[moveType] || 'any';
}
```

---

## Contract API Wrapper

```typescript
// frontend/src/api/marketplace.ts
import { Transaction } from '@mysten/sui/transactions';
// ✅ SuiClient in SDK v1.65+ uses gRPC internally — no manual migration needed
import { SuiClient } from '@mysten/sui/client';
import type { Listing } from '../types/contracts';

export class MarketplaceAPI {
  constructor(
    private client: SuiClient,
    private packageId: string
  ) {}

  /**
   * Create a new listing
   */
  createListing(params: { nft_id: string; price: number | bigint }): Transaction {
    const tx = new Transaction();

    tx.moveCall({
      target: `${this.packageId}::listing::create_listing`,
      arguments: [
        tx.object(params.nft_id),
        tx.pure(params.price, 'u64'),
      ],
    });

    return txb;
  }

  /**
   * Buy NFT from listing
   */
  buyFromListing(params: { listing_id: string; payment: string }): Transaction {
    const tx = new Transaction();

    tx.moveCall({
      target: `${this.packageId}::listing::buy_from_listing`,
      arguments: [
        tx.object(params.listing_id),
        tx.object(params.payment),
      ],
    });

    return txb;
  }

  /**
   * Fetch listing by ID
   */
  async getListing(listingId: string): Promise<Listing | null> {
    const object = await this.client.getObject({
      id: listingId,
      options: { showContent: true },
    });

    if (!object.data || object.data.content?.dataType !== 'moveObject') {
      return null;
    }

    const fields = object.data.content.fields as any;

    return {
      id: listingId,
      nft_id: fields.nft_id,
      seller: fields.seller,
      price: BigInt(fields.price),
      created_at: BigInt(fields.created_at),
    };
  }
}
```

---

## React Hooks Integration

```typescript
// frontend/src/hooks/useMarketplaceAPI.ts
import { useMemo } from 'react';
import { useCurrentClient } from '@mysten/dapp-kit-react';
import { useNetworkVariable } from '../config/sui';
import { MarketplaceAPI } from '../api/marketplace';

export function useMarketplaceAPI() {
  const client = useCurrentClient();
  const packageId = useNetworkVariable('packageId');

  const api = useMemo(
    () => new MarketplaceAPI(client, packageId),
    [client, packageId]
  );

  return api;
}
```

---

## Event Subscriptions

```typescript
// frontend/src/hooks/useContractEvents.ts
import { useEffect, useState } from 'react';
import { useCurrentClient } from '@mysten/dapp-kit-react';
import { useNetworkVariable } from '../config/sui';
import type { NFTPurchasedEvent } from '../types/contracts';

export function useNFTPurchasedEvents(
  onEvent?: (event: NFTPurchasedEvent) => void
) {
  const client = useCurrentClient();
  const packageId = useNetworkVariable('packageId');
  const [events, setEvents] = useState<NFTPurchasedEvent[]>([]);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    const subscribe = async () => {
      unsubscribe = await client.subscribeEvent({
        filter: {
          MoveEventType: `${packageId}::listing::NFTPurchased`,
        },
        onMessage: (message) => {
          const event = message.parsedJson as NFTPurchasedEvent;

          setEvents((prev) => [event, ...prev]);

          if (onEvent) {
            onEvent(event);
          }
        },
      });
    };

    subscribe();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [client, packageId, onEvent]);

  return events;
}
```

---

## Development Environment Script

```bash
#!/bin/bash
# scripts/dev.sh

# Start local SUI node
echo "🚀 Starting local SUI node..."
sui start --with-faucet &
NODE_PID=$!

sleep 5

# Deploy contracts
echo "📦 Deploying contracts..."
cd contracts
DEPLOY_OUTPUT=$(sui client publish --gas-budget 100000000 --json)
PACKAGE_ID=$(echo $DEPLOY_OUTPUT | jq -r '.objectChanges[] | select(.type == "published") | .packageId')

# Update frontend env
cd ../frontend
echo "VITE_SUI_NETWORK=localnet" > .env.local
echo "VITE_PACKAGE_ID=$PACKAGE_ID" >> .env.local

# Start frontend
npm run dev &
FRONTEND_PID=$!

trap "kill $NODE_PID $FRONTEND_PID; exit" INT

echo "✅ Development environment ready!"
echo "   Package ID: $PACKAGE_ID"

wait
```

---

## Error Handling

```typescript
// frontend/src/lib/contract-errors.ts
export function parseContractError(error: any): {
  title: string;
  message: string;
  action?: string;
} {
  const errorMsg = error?.message || '';

  // Move abort codes
  const abortMatch = errorMsg.match(/MoveAbort.*code:\s*(\d+)/);
  if (abortMatch) {
    const code = abortMatch[1];
    return mapMoveErrorCode(code);
  }

  // Transaction errors
  if (errorMsg.includes('InsufficientGas')) {
    return {
      title: 'Insufficient Gas',
      message: 'Not enough SUI to pay for transaction fees.',
      action: 'Add more SUI to your wallet',
    };
  }

  return {
    title: 'Transaction Failed',
    message: 'An unexpected error occurred.',
  };
}

function mapMoveErrorCode(code: string) {
  const errorMap: Record<string, any> = {
    '1': { title: 'Not Owner', message: 'You don\'t own this NFT.' },
    '2': { title: 'Invalid Price', message: 'Price must be greater than 0.' },
    '3': { title: 'Listing Not Found', message: 'This listing no longer exists.' },
    '4': { title: 'Insufficient Payment', message: 'Payment amount is too low.' },
  };

  return errorMap[code] || {
    title: 'Contract Error',
    message: `Transaction failed with error code ${code}.`,
  };
}
```

---

## Complete Marketplace Component

```typescript
// frontend/src/components/Marketplace.tsx
import { useMarketplaceAPI } from '../hooks/useMarketplaceAPI';
import { useDAppKit } from '@mysten/dapp-kit-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNFTPurchasedEvents } from '../hooks/useContractEvents';
import { toast } from 'sonner';

export function Marketplace() {
  const api = useMarketplaceAPI();
  const queryClient = useQueryClient();
  const dAppKit = useDAppKit();

  // Fetch listings
  const { data: listings } = useQuery({
    queryKey: ['listings'],
    queryFn: () => api.getAllListings(),
  });

  // Listen for events
  useNFTPurchasedEvents((event) => {
    toast.success(`NFT purchased for ${Number(event.price) / 1e9} SUI`);
    queryClient.invalidateQueries({ queryKey: ['listings'] });
  });

  // Buy mutation
  const buyMutation = useMutation({
    mutationFn: async (listingId: string) => {
      const txb = api.buyFromListing({
        listing_id: listingId,
        payment: '0x...',
      });
      return await dAppKit.signAndExecuteTransaction({ transaction: tx });
    },
    onSuccess: () => {
      toast.success('Purchase successful!');
    },
  });

  return (
    <div className="marketplace">
      <h1>Marketplace</h1>
      <div className="listings-grid">
        {listings?.map((listing) => (
          <div key={listing.id}>
            <p>{Number(listing.price) / 1e9} SUI</p>
            <button onClick={() => buyMutation.mutate(listing.id)}>
              Buy Now
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
```
