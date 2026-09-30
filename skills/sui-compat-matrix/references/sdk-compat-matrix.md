# SUI SDK Compat Matrix

Canonical source-of-truth for `@mysten/*` versions across in-scope skills. See `skills/sui-compat-matrix/SKILL.md` for the banner spec and bump SOP.

| Skill | Package | Kind | Tested | Accepted | Last verified | Notes-tag |
|---|---|---|---|---|---|---|
| skills/sui-ts-sdk/SKILL.md | @mysten/sui | primary | 2.33.2 | ^2.0 | 2026-09-30 | — |
| skills/sui-frontend/SKILL.md | @mysten/sui | primary | 2.33.2 | ^2.33.2 | 2026-09-30 | — |
| skills/sui-frontend/SKILL.md | @mysten/dapp-kit-react | primary | 2.1.37 | ^2.0 | 2026-09-30 | ui-subpath |
| skills/sui-frontend/SKILL.md | @mysten/dapp-kit-core | primary | 1.6.35 | ^1.3 | 2026-09-30 | — |
| skills/sui-deepbook/SKILL.md | @mysten/deepbook-v3 | primary | 2.6.4 | ^2.0.1 | 2026-09-30 | pyth-token |
| skills/sui-deepbook/SKILL.md | @mysten/sui | primary | 2.33.2 | ^2.33.1 | 2026-09-30 | — |
| skills/sui-kiosk/SKILL.md | @mysten/kiosk | primary | 1.4.17 | ^1.2 | 2026-09-30 | grpc-needs-1-4 |
| skills/sui-kiosk/SKILL.md | @mysten/sui | primary | 2.33.2 | ^2.33.2 | 2026-09-30 | — |
| skills/sui-seal/SKILL.md | @mysten/seal | primary | 1.4.17 | ^1.1 | 2026-09-30 | — |
| skills/sui-seal/SKILL.md | @mysten/sui | peer | 2.33.2 | ^2.33.2 | 2026-09-30 | — |
| skills/sui-walrus/SKILL.md | @mysten/walrus | primary | 1.2.32 | ^1.1 | 2026-09-30 | — |
| skills/sui-walrus/SKILL.md | @mysten/sui | peer | 2.33.2 | ^2.33.2 | 2026-09-30 | — |
| skills/sui-suins/SKILL.md | @mysten/suins | primary | 2.0.13 | ^2.0 | 2026-09-30 | pyth-token |
| skills/sui-suins/SKILL.md | @mysten/sui | peer | 2.33.2 | ^2.33.2 | 2026-09-30 | — |
| skills/sui-passkey/SKILL.md | @mysten/sui | primary | 2.33.2 | ^2.0 | 2026-09-30 | sub-export:passkey |
| skills/sui-zklogin/SKILL.md | @mysten/sui | primary | 2.33.2 | ^2.0 | 2026-09-30 | sub-export:zklogin |
| skills/sui-move-ts-bridge/SKILL.md | @mysten/sui | primary | 2.33.2 | ^2.33.2 | 2026-09-30 | — |
| skills/sui-move-ts-bridge/SKILL.md | @mysten/kiosk | primary | 1.4.17 | ^1.2 | 2026-09-30 | grpc-needs-1-4 |
| skills/sui-enoki/SKILL.md | @mysten/enoki | primary | 1.2.29 | ^1.0 | 2026-09-30 | — |
| skills/sui-enoki/SKILL.md | @mysten/sui | peer | 2.33.2 | ^2.33.2 | 2026-09-30 | — |

## Notes-tag glossary

- `ui-subpath` — UI components moved to `/ui` subpath (e.g. `@mysten/dapp-kit-react/ui`)
- `pyth-token` — SDK ≥2.0 pushes Pyth price updates through the keyed Pyth Pro Hermes endpoint (`https://pyth.dourolabs.app/hermes`, HTTP 401 without a bearer token): construct the client with `pythAccessToken` (deepbook-v3: any margin flow that refreshes prices; suins: `getPriceInfoObject`, i.e. non-USDC `register`/`renew`). Read-only / USDC paths need no token.
- `sub-export:<name>` — API lives at `@mysten/sui/<name>`, not a separate package

## Peer ranges

- `@mysten/sui` rows in skills that pair it with a sibling package (deepbook, kiosk, seal, walrus, suins, move-ts-bridge, enoki) carry the sibling's peer range as Accepted; standalone `@mysten/sui` rows (ts-sdk, passkey, zklogin) keep the loose `^2.0` since nothing else constrains them. **sui-frontend is not standalone** — it installs `@mysten/dapp-kit-core`, whose peer is `^2.33.2`, so a `^2.0` accepted range there is a lie: `npm i @mysten/sui@2.0.0 @mysten/dapp-kit-core@1.6.35` fails with ERESOLVE. Its `@mysten/sui` row carries the sibling peer range like the other paired skills.
- every 2.33.2-generation sibling (`dapp-kit-core`, `enoki`, `kiosk`, `seal`, `suins`, `wallet-standard`, `walrus`, `zksend`) declares `peerDependencies: { "@mysten/sui": "^2.33.2" }` (`@mysten/messaging` excepted: 0.3.0 hard-depends on sui `^1.45.2`), and `deepbook-v3` 2.6.4 peers `^2.33.1` (2.0.1 declared `^2.26.2`, 2.1.3 `^2.28.0`, 2.1.4 `^2.29.0`). Bump `@mysten/sui` and the siblings together — a lone sibling bump against an older `@mysten/sui` fails peer resolution.
- **deepbook-v3 accepted range vs subpaths**: the range stays `^2.0.1` even though Tested is 2.6.4, because the documented **root** surface (spot, BalanceManager, margin, flash loans, governance) is unchanged across 2.0.1→2.6.4. Verified 2026-09-30 by packing 2.0.1 and 2.6.4 and diffing `dist/`: `dist/utils/constants.mjs` (every hardcoded package id, coin/pool map) is byte-identical, and so are the root barrel `dist/index.d.mts` (same export list) and `dist/client.d.mts` (`DeepBookClient`, incl. `getAccountOrderDetails`) — but a barrel proves nothing alone, so the files it re-exports were diffed too: every root-reachable `.d.mts` is identical except alias renumbering (`_mysten_sui_bcs47` → `_mysten_sui_bcs477`, …), plus `contracts/utils/index.d.mts`, which is purely additive (`MoveTuple`, `ConfigValue`, `RawTransactionArgument`). The only runtime (`.mjs`) diff is a dropped side-effect-free `import "./types/bcs.mjs"` in `dist/index.mjs` and the three `dist/queries/*Queries.mjs` (its target is `export {}`; 2.0.1's `exports` map has only `.`, so consumers cannot import it). No non-additive type change on the root surface was found between 2.0.1 and 2.6.4. New in 2.6.4: `@mysten/sui` peer range `^2.33.1` (2.0.1: `^2.26.2`), `sideEffects: false`, and the `./account`, `./sessions`, `./predict` subpaths. Method note for the next bump: diff what the barrel imports, not just the barrel. The `/account`, `/sessions` and `/predict` subpaths, however, exist only from **2.1.3** onward (npm published no 2.1.0–2.1.2 — 2.1.3 is the first release carrying them), so code importing one needs `^2.1.3`. The Predict content in `references/predict.md` needs **≥2.6.1** (≥2.5.0 for live testnet ids), per the 2.6.4 CHANGELOG: 2.3.0 mainnet ids + `supplyPlp`/`withdrawPlp` floors, 2.4.0 `*MoveCalls` exports, 2.5.0 redeploy, 2.6.0 v2/`mintCost`/`predictV1`, 2.6.1 mainnet v2 package ids.
- `grpc-needs-1-4` — `KioskCompatibleClient` only widened to `ClientWithCoreApi` (gRPC accepted) in kiosk 1.4.0; the 1.2.x–1.3.x tail of the accepted range still rejects `SuiGrpcClient`
