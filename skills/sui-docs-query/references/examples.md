# SUI Docs Query - Examples

Query examples for different targets.

## Example 1: Query Kiosk Documentation

```typescript
const kioskInfo = await sui_docs_query({
  type: "docs",
  target: "kiosk",
  query: "Transfer policy best practices"
});
```

## Example 2: Query GitHub Examples

```typescript
const examples = await sui_docs_query({
  type: "github",
  target: "sui-core",
  query: "NFT marketplace example",
  options: { include_examples: true }
});
```
