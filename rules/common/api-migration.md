---
paths: "**/*.{ts,tsx,js,jsx}"
---

# API Migration Rules (SUI v1.65+)

## JSON-RPC Deprecation

**JSON-RPC is deprecated and will be removed in April 2026.**

### Rules

1. **New projects MUST NOT use JSON-RPC directly.** Use gRPC or GraphQL instead.
2. **Existing projects using JSON-RPC** should plan migration before April 2026.
3. **SDK users (`@mysten/sui`)** are largely unaffected — the SDK handles transport automatically.
4. **Direct `fetch()` calls** to JSON-RPC endpoints must be migrated to gRPC or SDK methods.
5. **WebSocket subscriptions** (`subscribeEvent`) are replaced by gRPC streaming.

### Data Access Selection Guide

| Use Case | Recommended API | Reason |
|----------|----------------|--------|
| Transaction execution | gRPC | Low-latency, type-safe |
| Backend services | gRPC | Streaming, multiplexing |
| Real-time events | gRPC (streaming) | Replaces WebSocket |
| Frontend queries | GraphQL | Flexible, Relay-compatible |
| Complex object graphs | GraphQL | Single request, nested data |
| Historical analytics | Indexer | Custom aggregation |
| Simple object fetch | SDK (auto) | SDK chooses best transport |

### Code Patterns

```typescript
// BAD: Direct JSON-RPC call (deprecated)
const response = await fetch(rpcUrl, {
  method: 'POST',
  body: JSON.stringify({
    jsonrpc: '2.0',
    method: 'sui_getObject',
    params: [objectId],
  }),
});

// GOOD: Use SDK (handles gRPC automatically)
import { SuiClient } from '@mysten/sui/client';
const client = new SuiClient({ url: getFullnodeUrl('testnet') });
const object = await client.getObject({ id: objectId });
```

### Detection

If code contains any of these patterns, flag for migration:
- `"jsonrpc": "2.0"` in fetch calls
- Direct `curl` calls with `sui_*` or `suix_*` methods
- WebSocket connections to SUI RPC for event subscriptions
- `SUI_RPC_URL` environment variables pointing to JSON-RPC endpoints
