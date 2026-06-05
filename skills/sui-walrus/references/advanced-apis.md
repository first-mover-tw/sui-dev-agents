<!-- Verified against @mysten/walrus 1.1.7 d.mts on 2026-06-04: files/blob.d.mts, files/file.d.mts, client.d.mts, utils/quilts.d.mts, utils/bcs.d.mts, constants.d.mts -->

# Walrus Advanced APIs (@mysten/walrus ≥ 1.1.7)

Reference for the newer high-level exports added around 1.1.7: the file/blob
abstractions, quilt batching, blob-ID conversion helpers, and network
package-config constants.

## Contents

- [WalrusFile](#walrusfile)
- [FileReader](#filereader)
- [WalrusBlob](#walrusblob)
- [encodeQuilt — two surfaces](#encodequilt--two-surfaces)
- [blobIdFromInt / blobIdToInt](#blobidfromint--blobidtoint)
- [TESTNET_WALRUS_PACKAGE_CONFIG](#testnet_walrus_package_config)
- [MAINNET_WALRUS_PACKAGE_CONFIG](#mainnet_walrus_package_config)

## WalrusFile

Source: `files/file.d.mts`, re-exported from the package index.

```text
declare class WalrusFile {
  static from(options: { contents: Uint8Array | Blob; identifier: string; tags?: Record<string, string> }): WalrusFile;
  constructor({ reader }: { reader: FileReader });
  getIdentifier(): Promise<string | null>;
  getTags(): Promise<Record<string, string>>;
  bytes(): Promise<Uint8Array>;
  text(): Promise<string>;
  json(): Promise<any>;
}
```

WHAT: a higher-level file abstraction layered over raw Walrus blobs. Wrap
content with an `identifier` and optional `tags` via `WalrusFile.from(...)`, then
read it back as `bytes()`, `text()`, or `json()`.

WHY/WHEN: use it whenever you'd otherwise be doing manual blob plumbing —
tracking the raw `Uint8Array`, its name, and metadata by hand. The identifier +
tags travel with the content, so when you later pull files out of a blob (see
`WalrusBlob#files`) you can filter and decode them without bookkeeping on your
side. Reach for `WalrusFile.from` on the write path; reach for the `text()` /
`json()` readers on the read path.

## FileReader

Type, source: `files/file.d.mts`.

```text
interface FileReader {
  getIdentifier(): Promise<string | null>;
  getTags(): Promise<Record<string, string>>;
  getBytes(): Promise<Uint8Array>;
}
```

WHAT: the source interface a `WalrusFile` reads from. The `WalrusFile`
constructor takes `{ reader }`, and every `WalrusFile` accessor delegates to
the underlying reader.

WHY/WHEN: implement `FileReader` to back a `WalrusFile` with a custom source —
e.g. lazy fetch from a gateway, an in-memory buffer, or a test double. Most
callers never touch this directly because `WalrusFile.from` supplies a reader
for them; you only implement it when you need a non-default backing source.

## WalrusBlob

Source: `files/blob.d.mts`, re-exported from the package index.

```text
declare class WalrusBlob {
  constructor({ reader, client }: { reader: BlobReader; client: WalrusClient });
  asFile(): WalrusFile;
  blobId(): Promise<string | null>;
  files(filters?: { ids?: string[]; tags?: { [tagName: string]: string }[]; identifiers?: string[] }): Promise<WalrusFile[]>;
  exists(): Promise<boolean>;
  storedUntil(): Promise<number | null>;
}
```

WHAT: a stored blob. A single Walrus blob may pack MANY files when it's a quilt,
so `WalrusBlob` exposes both the whole-blob view (`asFile()`, `blobId()`) and
the per-file view (`files(...)`).

WHY/WHEN:
- `files(filters?)` pulls the packed files out, optionally filtering by `ids`,
  `tags`, or `identifiers` — this is how you address one file inside a quilt.
- `storedUntil()` returns the storage-epoch expiry (or `null`) so you can decide
  when to renew/extend storage before the blob is dropped.
- `exists()` checks availability before you attempt a read.
- `asFile()` treats the blob as a single `WalrusFile` (the non-quilt case).

## encodeQuilt — two surfaces

CAVEAT — there are TWO distinct `encodeQuilt` surfaces. Do NOT conflate them:
one is a synchronous standalone function, the other is an async client method
with a different parameter shape.

### 1. Standalone function — SYNCHRONOUS

Source: `utils/quilts.d.mts`. Takes `numShards` + optional `encodingType`.

```text
interface EncodeQuiltOptions {
  blobs: { contents: Uint8Array; identifier: string; tags?: Record<string, string> }[];
  numShards: number;
  encodingType?: EncodingType;
}
declare function encodeQuilt(opts: EncodeQuiltOptions): { quilt: Uint8Array; index: { patches: (QuiltPatchV1.$inferInput & { startIndex: number })[] } };
```

### 2. `WalrusClient#encodeQuilt` method — ASYNC

Source: `client.d.mts`. Returns a `Promise`; takes NO `numShards` /
`encodingType` param.

```text
encodeQuilt({ blobs }: { blobs: { contents: Uint8Array; identifier: string; tags?: Record<string, string> }[] }): Promise<{ quilt: Uint8Array; index: { patches: (...)[] } }>;
```

WHY quilts: batching many small files into ONE blob is a storage/cost win —
Walrus charges per blob, so packing N small files as a quilt amortizes that cost
to a single blob instead of N.

WHICH to pick:
- The **standalone function is synchronous** and requires you to pass
  `numShards` yourself — use it when encoding offline / without a client.
- The **client method is asynchronous** and derives the shard count from the
  client's on-chain system state, so you don't pass `numShards` (or
  `encodingType`). Prefer the client method unless you're explicitly encoding
  offline.

## blobIdFromInt / blobIdToInt

Source: `utils/bcs.d.mts`.

```text
declare function blobIdFromInt(blobId: bigint | string): string;
declare function blobIdToInt(blobId: string): bigint;
```

WHAT: convert between the two representations of a Walrus blob ID:
- the **u256 integer form** — how it's stored on-chain and emitted in Move events;
- the **base64url string form** — what the SDK and HTTP API use.

WHY/WHEN: use these when correlating on-chain data with SDK calls — e.g. you
read a blob ID off a Move event as a u256 and need the string form to fetch via
the SDK (`blobIdFromInt`), or you have an SDK string ID and want to look it up
in on-chain state (`blobIdToInt`).

## TESTNET_WALRUS_PACKAGE_CONFIG

Source: `constants.d.mts`.

```text
declare const TESTNET_WALRUS_PACKAGE_CONFIG: { systemObjectId: string; stakingPoolId: string; exchangeIds: string[]; };
```

WHAT: the testnet network package config — system object ID, staking pool ID,
and `exchangeIds` (the SUI/WAL exchange objects used by the testnet faucet/
exchange flow).

WHY/WHEN: import this instead of hardcoding system/staking object IDs in your
testnet setup.

## MAINNET_WALRUS_PACKAGE_CONFIG

Source: `constants.d.mts`.

CAVEAT — mainnet has NO `exchangeIds` field. The structure is NOT symmetric with
testnet: there is no SUI/WAL exchange on mainnet, so the field is simply absent
(not empty).

```text
declare const MAINNET_WALRUS_PACKAGE_CONFIG: { systemObjectId: string; stakingPoolId: string; };
```

WHAT: the mainnet network package config — system object ID and staking pool ID
only.

WHY/WHEN: import these constants so you stop hardcoding network object IDs. Do
NOT assume the mainnet config mirrors testnet — the testnet-only `exchangeIds`
(faucet/exchange) field does not exist on mainnet, so code that reads
`config.exchangeIds` must guard for mainnet.
