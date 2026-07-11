// Smoke test: spins up the MCP server in-process and calls every tool once (testnet).
// Wallet execution tools stop at simulate — nothing is submitted on-chain.
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createServer } from '../dist/index.js';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SMOKE_PACKAGE_PATH = path.join(__dirname, 'fixtures', 'smoke-package');

// Filled from `sui client active-address` (testnet wallet with owned objects).
const TESTNET_ADDR = '0x1509b5fdf09296b2cf749a710e36da06f5693ccd5b2144ad643b3a895abcbc4c';
// Filled from a real `previousTransaction` digest returned by sui_get_owned_objects (gRPC) for TESTNET_ADDR.
const KNOWN_DIGEST = 'BKmfB9WkusChGppLTYXbRSjuBZpHZzW89XwEfaVgZLiL';

const CASES = [
  // --- gRPC-backed (expected to work) ---
  { tool: 'sui_get_latest_checkpoint', args: {} },
  { tool: 'sui_get_balance', args: { address: TESTNET_ADDR } },
  { tool: 'sui_get_coins', args: { address: TESTNET_ADDR } },
  { tool: 'sui_get_owned_objects', args: { address: TESTNET_ADDR, limit: 5 } },
  { tool: 'sui_get_package', args: { packageId: '0x2' } },
  { tool: 'sui_wallet_status', args: {} },

  // --- gRPC-backed (migrated off JSON-RPC; expected to work) ---
  { tool: 'sui_get_object', args: { objectId: '0x5' } },
  { tool: 'sui_get_transaction', args: { digest: KNOWN_DIGEST } },
  { tool: 'sui_get_events', args: { digest: KNOWN_DIGEST } },
  { tool: 'sui_resolve_name', args: { address: TESTNET_ADDR } },
  { tool: 'sui_dry_run', args: { txBytes: 'not-base64!!!' }, expectError: true }, // malformed input must not crash

  // --- wallet build/dry-run tools (gRPC-backed via tx.build / simulateTransaction) ---
  { tool: 'sui_wallet_transfer', args: { recipient: TESTNET_ADDR, amount: 0.001, execute: false } },
  // clock::timestamp_ms(&Clock) returns u64 (has drop), so the built PTB has no
  // UnusedValueWithoutDrop — unlike coin::zero<SUI>() which returns a Coin with no drop.
  { tool: 'sui_wallet_call', args: { package_id: '0x2', module: 'clock', function_name: 'timestamp_ms', type_args: [], args: ['0x6'], execute: false } },
  { tool: 'sui_wallet_publish', args: { package_path: SMOKE_PACKAGE_PATH, execute: false } },
];

const [ct, st] = InMemoryTransport.createLinkedPair();
const server = createServer();
await server.connect(st);
const client = new Client({ name: 'smoke', version: '1.0.0' });
await client.connect(ct);

let pass = 0;
for (const c of CASES) {
  try {
    const r = await client.callTool({ name: c.tool, arguments: c.args });
    const ok = c.expectError ? r.isError === true : !r.isError;
    console.log(`${ok ? 'PASS' : 'FAIL'} ${c.tool}${ok ? '' : ' → ' + JSON.stringify(r.content?.[0]).slice(0, 200)}`);
    if (ok) pass++;
  } catch (e) {
    const ok = c.expectError === true;
    console.log(`${ok ? 'PASS' : 'FAIL'} ${c.tool} → threw: ${e.message.slice(0, 200)}`);
    if (ok) pass++;
  }
}
console.log(`\n${pass}/${CASES.length}`);
process.exit(pass === CASES.length ? 0 : 1);
