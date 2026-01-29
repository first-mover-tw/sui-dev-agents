# SUI Frontend - Complete Examples

Real-world component and integration examples.

## Example 1: Complete NFT Marketplace Component

```typescript
// src/components/NFTMarketplace.tsx
import { useListings, useCreateListing, useBuyListing } from '../hooks/useMarketplace';
import { useCurrentAccount } from '@mysten/dapp-kit';

export function NFTMarketplace() {
  const account = useCurrentAccount();
  const { data: listings, isLoading } = useListings();
  const createListing = useCreateListing();
  const buyListing = useBuyListing();

  if (isLoading) return <div>Loading...</div>;

  return (
    <div className="marketplace">
      <h1>NFT Marketplace</h1>
      
      <div className="listings-grid">
        {listings?.map((listing) => (
          <div key={listing.id} className="listing-card">
            <img src={listing.image} alt={listing.name} />
            <h3>{listing.name}</h3>
            <p>Price: {listing.price / 1e9} SUI</p>
            
            {account?.address === listing.seller ? (
              <button onClick={() => cancelListing(listing.id)}>
                Cancel Listing
              </button>
            ) : (
              <button onClick={() => buyListing.mutate({ listingId: listing.id })}>
                Buy Now
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
```

## Example 2: Real-time Event Updates

```typescript
export function RealtimeListings() {
  const queryClient = useQueryClient();
  const events = useMarketplaceEvents('NFTPurchased');

  useEffect(() => {
    if (events.length > 0) {
      queryClient.invalidateQueries({ queryKey: ['listings'] });
      toast.info('New sale detected!');
    }
  }, [events]);

  return <NFTMarketplace />;
}
```

See reference.md for complete API documentation.
