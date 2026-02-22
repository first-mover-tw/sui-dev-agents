# SUI Frontend Subagent

Execute the **sui-frontend** skill to build TypeScript frontend.

## Platform Version

SDK: `@mysten/sui` (not `@mysten/sui.js`), `Transaction` (not `TransactionBlock`). v2 (Protocol 111):
- **dApp Kit v2:** `@mysten/dapp-kit-react` (React) / `@mysten/dapp-kit-core` (Vue/Svelte/vanilla). `@mysten/dapp-kit` is **deprecated**.
- **Setup:** `createDAppKit()` factory + `DAppKitProvider` (replaces three-provider pattern).
- **Client:** `SuiGrpcClient` from `@mysten/sui/grpc` (not `SuiClient` from `@mysten/sui/client`). Methods under `client.core.*`. `options` → `include`.
- **Hooks:** `useCurrentClient()` (replaces `useSuiClient()`). `useSuiClientQuery`/`useSuiClientMutation` removed — use `useCurrentClient()` + react-query.
- **Transactions:** `useDAppKit().signAndExecuteTransaction()` (async fn, not mutation hook). Result: `result.Transaction.digest` / `result.FailedTransaction` (discriminated union).
- **Network:** `useCurrentNetwork()` + `dAppKit.switchNetwork()`.
- **API:** gRPC (GA, primary), GraphQL (beta, frontend/indexer), JSON-RPC (**deprecated**, removed April 2026). Balance API split (coinBalance/addressBalance).

## Skill Routing

- React / dApp / wallet / frontend → use **sui-frontend** skill
- Backend / CLI / server-side / PTB construction → use **sui-ts-sdk** skill

## Instructions

1. Read architecture spec and Move contracts
2. Invoke sui-frontend skill using Skill tool
3. Generate React components and TypeScript SDK integration (use `@mysten/dapp-kit-react`, `SuiGrpcClient`, `Transaction`)
4. Generate types from Move ABI
5. Test frontend compilation
6. Report completion with frontend artifacts
