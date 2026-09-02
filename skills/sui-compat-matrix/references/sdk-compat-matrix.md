# SUI SDK Compat Matrix

Canonical source-of-truth for `@mysten/*` versions across in-scope skills. See `skills/sui-compat-matrix/SKILL.md` for the banner spec and bump SOP.

| Skill | Package | Kind | Tested | Accepted | Last verified | Notes-tag |
|---|---|---|---|---|---|---|
| skills/sui-ts-sdk/SKILL.md | @mysten/sui | primary | 2.28.0 | ^2.0 | 2026-09-02 | — |
| skills/sui-frontend/SKILL.md | @mysten/sui | primary | 2.28.0 | ^2.28.0 | 2026-09-02 | — |
| skills/sui-frontend/SKILL.md | @mysten/dapp-kit-react | primary | 2.1.24 | ^2.0 | 2026-09-02 | ui-subpath |
| skills/sui-frontend/SKILL.md | @mysten/dapp-kit-core | primary | 1.6.22 | ^1.3 | 2026-09-02 | — |
| skills/sui-deepbook/SKILL.md | @mysten/deepbook-v3 | primary | 2.0.1 | ^2.0.1 | 2026-09-02 | pyth-token |
| skills/sui-deepbook/SKILL.md | @mysten/sui | primary | 2.28.0 | ^2.26.2 | 2026-09-02 | — |
| skills/sui-kiosk/SKILL.md | @mysten/kiosk | primary | 1.4.7 | ^1.2 | 2026-09-02 | grpc-needs-1-4 |
| skills/sui-kiosk/SKILL.md | @mysten/sui | primary | 2.28.0 | ^2.28.0 | 2026-09-02 | — |
| skills/sui-seal/SKILL.md | @mysten/seal | primary | 1.4.7 | ^1.1 | 2026-09-02 | — |
| skills/sui-seal/SKILL.md | @mysten/sui | peer | 2.28.0 | ^2.28.0 | 2026-09-02 | — |
| skills/sui-walrus/SKILL.md | @mysten/walrus | primary | 1.2.22 | ^1.1 | 2026-09-02 | — |
| skills/sui-walrus/SKILL.md | @mysten/sui | peer | 2.28.0 | ^2.28.0 | 2026-09-02 | — |
| skills/sui-suins/SKILL.md | @mysten/suins | primary | 2.0.3 | ^2.0 | 2026-09-02 | pyth-token |
| skills/sui-suins/SKILL.md | @mysten/sui | peer | 2.28.0 | ^2.28.0 | 2026-09-02 | — |
| skills/sui-passkey/SKILL.md | @mysten/sui | primary | 2.28.0 | ^2.0 | 2026-09-02 | sub-export:passkey |
| skills/sui-zklogin/SKILL.md | @mysten/sui | primary | 2.28.0 | ^2.0 | 2026-09-02 | sub-export:zklogin |
| skills/sui-move-ts-bridge/SKILL.md | @mysten/sui | primary | 2.28.0 | ^2.28.0 | 2026-09-02 | — |
| skills/sui-move-ts-bridge/SKILL.md | @mysten/kiosk | primary | 1.4.7 | ^1.2 | 2026-09-02 | grpc-needs-1-4 |
| skills/sui-enoki/SKILL.md | @mysten/enoki | primary | 1.2.19 | ^1.0 | 2026-09-02 | — |
| skills/sui-enoki/SKILL.md | @mysten/sui | peer | 2.28.0 | ^2.28.0 | 2026-09-02 | — |

## Notes-tag glossary

- `ui-subpath` — UI components moved to `/ui` subpath (e.g. `@mysten/dapp-kit-react/ui`)
- `pyth-token` — SDK ≥2.0 pushes Pyth price updates through the keyed Pyth Pro Hermes endpoint (`https://pyth.dourolabs.app/hermes`, HTTP 401 without a bearer token): construct the client with `pythAccessToken` (deepbook-v3: any margin flow that refreshes prices; suins: `getPriceInfoObject`, i.e. non-USDC `register`/`renew`). Read-only / USDC paths need no token.
- `sub-export:<name>` — API lives at `@mysten/sui/<name>`, not a separate package

## Peer ranges

- `@mysten/sui` rows in skills that pair it with a sibling package (deepbook, kiosk, seal, walrus, suins, move-ts-bridge, enoki) carry the sibling's peer range as Accepted; standalone `@mysten/sui` rows (ts-sdk, passkey, zklogin) keep the loose `^2.0` since nothing else constrains them. **sui-frontend is not standalone** — it installs `@mysten/dapp-kit-core`, whose peer is `^2.28.0`, so a `^2.0` accepted range there is a lie: `npm i @mysten/sui@2.0.0 @mysten/dapp-kit-core@1.6.22` fails with ERESOLVE. Its `@mysten/sui` row carries the sibling peer range like the other paired skills.
- every 2.28.0-generation sibling (`dapp-kit-core`, `enoki`, `kiosk`, `seal`, `suins`, `wallet-standard`, `walrus`, `zksend`) declares `peerDependencies: { "@mysten/sui": "^2.28.0" }`; `deepbook-v3` 2.0.1 declares `^2.26.2`. Bump `@mysten/sui` and the siblings together — a lone sibling bump against an older `@mysten/sui` fails peer resolution.
- `grpc-needs-1-4` — `KioskCompatibleClient` only widened to `ClientWithCoreApi` (gRPC accepted) in kiosk 1.4.0; the 1.2.x–1.3.x tail of the accepted range still rejects `SuiGrpcClient`
