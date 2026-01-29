# SUI Frontend - Reference Guide

Complete SDK API reference and advanced patterns.

## @mysten/sui.js SDK Reference

### SuiClient Methods

- `getObject(params)` - Fetch single object
- `multiGetObjects(params)` - Fetch multiple objects (batch)
- `getOwnedObjects(params)` - Query objects by owner/type
- `getDynamicFields(params)` - Query dynamic fields
- `executeTransactionBlock(params)` - Execute transaction
- `subscribeEvent(params)` - Subscribe to events

### TransactionBlock Methods

- `moveCall(params)` - Call Move function
- `transferObjects(objects, recipient)` - Transfer objects
- `splitCoins(coin, amounts)` - Split coins
- `mergeCoins(destination, sources)` - Merge coins
- `pure(value, type)` - Pure argument
- `object(id)` - Object argument

## @mysten/dapp-kit Hooks

### Wallet Hooks

- `useCurrentAccount()` - Get current connected account
- `useAccounts()` - Get all connected accounts
- `useConnectWallet()` - Connect wallet mutation
- `useDisconnectWallet()` - Disconnect wallet mutation
- `useSwitchAccount()` - Switch account mutation

### Client Hooks

- `useSuiClient()` - Get SUI client instance
- `useSuiClientQuery()` - Query with SUI client
- `useSuiClientMutation()` - Mutation with SUI client

### Transaction Hooks

- `useSignAndExecuteTransactionBlock()` - Sign and execute transaction
- `useSignTransactionBlock()` - Sign transaction only
- `useSignPersonalMessage()` - Sign message

See examples.md for complete usage patterns.
