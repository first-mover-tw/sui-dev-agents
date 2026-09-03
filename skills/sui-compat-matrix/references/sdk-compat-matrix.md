# SUI SDK Compat Matrix

Canonical source-of-truth for `@mysten/*` versions across in-scope skills. See `skills/sui-compat-matrix/SKILL.md` for the banner spec and bump SOP.

| Skill | Package | Kind | Tested | Accepted | Last verified | Notes-tag |
|---|---|---|---|---|---|---|
| skills/sui-ts-sdk/SKILL.md | @mysten/sui | primary | 2.29.0 | ^2.0 | 2026-09-03 | — |
| skills/sui-frontend/SKILL.md | @mysten/sui | primary | 2.29.0 | ^2.29.0 | 2026-09-03 | — |
| skills/sui-frontend/SKILL.md | @mysten/dapp-kit-react | primary | 2.1.25 | ^2.0 | 2026-09-03 | ui-subpath |
| skills/sui-frontend/SKILL.md | @mysten/dapp-kit-core | primary | 1.6.23 | ^1.3 | 2026-09-03 | — |
| skills/sui-deepbook/SKILL.md | @mysten/deepbook-v3 | primary | 2.1.4 | ^2.0.1 | 2026-09-03 | pyth-token |
| skills/sui-deepbook/SKILL.md | @mysten/sui | primary | 2.29.0 | ^2.29.0 | 2026-09-03 | — |
| skills/sui-kiosk/SKILL.md | @mysten/kiosk | primary | 1.4.8 | ^1.2 | 2026-09-03 | grpc-needs-1-4 |
| skills/sui-kiosk/SKILL.md | @mysten/sui | primary | 2.29.0 | ^2.29.0 | 2026-09-03 | — |
| skills/sui-seal/SKILL.md | @mysten/seal | primary | 1.4.8 | ^1.1 | 2026-09-03 | — |
| skills/sui-seal/SKILL.md | @mysten/sui | peer | 2.29.0 | ^2.29.0 | 2026-09-03 | — |
| skills/sui-walrus/SKILL.md | @mysten/walrus | primary | 1.2.23 | ^1.1 | 2026-09-03 | — |
| skills/sui-walrus/SKILL.md | @mysten/sui | peer | 2.29.0 | ^2.29.0 | 2026-09-03 | — |
| skills/sui-suins/SKILL.md | @mysten/suins | primary | 2.0.4 | ^2.0 | 2026-09-03 | pyth-token |
| skills/sui-suins/SKILL.md | @mysten/sui | peer | 2.29.0 | ^2.29.0 | 2026-09-03 | — |
| skills/sui-passkey/SKILL.md | @mysten/sui | primary | 2.29.0 | ^2.0 | 2026-09-03 | sub-export:passkey |
| skills/sui-zklogin/SKILL.md | @mysten/sui | primary | 2.29.0 | ^2.0 | 2026-09-03 | sub-export:zklogin |
| skills/sui-move-ts-bridge/SKILL.md | @mysten/sui | primary | 2.29.0 | ^2.29.0 | 2026-09-03 | — |
| skills/sui-move-ts-bridge/SKILL.md | @mysten/kiosk | primary | 1.4.8 | ^1.2 | 2026-09-03 | grpc-needs-1-4 |
| skills/sui-enoki/SKILL.md | @mysten/enoki | primary | 1.2.20 | ^1.0 | 2026-09-03 | — |
| skills/sui-enoki/SKILL.md | @mysten/sui | peer | 2.29.0 | ^2.29.0 | 2026-09-03 | — |

## Notes-tag glossary

- `ui-subpath` — UI components moved to `/ui` subpath (e.g. `@mysten/dapp-kit-react/ui`)
- `pyth-token` — SDK ≥2.0 pushes Pyth price updates through the keyed Pyth Pro Hermes endpoint (`https://pyth.dourolabs.app/hermes`, HTTP 401 without a bearer token): construct the client with `pythAccessToken` (deepbook-v3: any margin flow that refreshes prices; suins: `getPriceInfoObject`, i.e. non-USDC `register`/`renew`). Read-only / USDC paths need no token.
- `sub-export:<name>` — API lives at `@mysten/sui/<name>`, not a separate package

## Peer ranges

- `@mysten/sui` rows in skills that pair it with a sibling package (deepbook, kiosk, seal, walrus, suins, move-ts-bridge, enoki) carry the sibling's peer range as Accepted; standalone `@mysten/sui` rows (ts-sdk, passkey, zklogin) keep the loose `^2.0` since nothing else constrains them. **sui-frontend is not standalone** — it installs `@mysten/dapp-kit-core`, whose peer is `^2.29.0`, so a `^2.0` accepted range there is a lie: `npm i @mysten/sui@2.0.0 @mysten/dapp-kit-core@1.6.23` fails with ERESOLVE. Its `@mysten/sui` row carries the sibling peer range like the other paired skills.
- every 2.29.0-generation sibling (`dapp-kit-core`, `enoki`, `kiosk`, `seal`, `suins`, `wallet-standard`, `walrus`, `zksend`) declares `peerDependencies: { "@mysten/sui": "^2.29.0" }`, and `deepbook-v3` 2.1.4 now does too (2.0.1 declared `^2.26.2`, 2.1.3 `^2.28.0`). Bump `@mysten/sui` and the siblings together — a lone sibling bump against an older `@mysten/sui` fails peer resolution.
- **deepbook-v3 accepted range vs subpaths**: the range stays `^2.0.1` even though Tested is 2.1.4, because the documented **root** surface (spot, BalanceManager, margin, flash loans, governance) is unchanged across 2.0.1→2.1.4: the **root export set** is unchanged and every hardcoded package id on that surface is byte-identical. `dist/utils/constants.mjs` is byte-identical, and so is `dist/index.d.mts` — though that alone proves nothing, since it is only a re-export barrel. Diffing what it pulls in: the sole **non-additive** delta on the public type surface is a semantically-irrelevant union reorder on `DeepBookClient.getAccountOrderDetails` (`dist/client.d.mts`); `contracts/utils/index.d.mts` is on that surface too but purely additive (`MoveTuple`, `ConfigValue`, `RawTransactionArgument`). The rest is inert: alias renumbering, plus a dropped `import "./types/bcs.mjs"` in four emitted modules (`dist/index.mjs` and the three `dist/queries/*Queries.mjs`) whose target is `import …; export {}` — no side effect, and not importable by consumers anyway, since 2.0.1's `exports` map has only `.`. Method note for the next bump: diff what the barrel imports, not just the barrel. The `/account`, `/sessions` and `/predict` subpaths, however, only exist in the 2.1.x line: code importing one needs `^2.1.3` (npm published no 2.1.0–2.1.2 — the first release carrying the subpaths is **2.1.3**).
- `grpc-needs-1-4` — `KioskCompatibleClient` only widened to `ClientWithCoreApi` (gRPC accepted) in kiosk 1.4.0; the 1.2.x–1.3.x tail of the accepted range still rejects `SuiGrpcClient`
