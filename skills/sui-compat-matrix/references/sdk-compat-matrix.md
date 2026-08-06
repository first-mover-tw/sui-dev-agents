# SUI SDK Compat Matrix

Canonical source-of-truth for `@mysten/*` versions across in-scope skills. See `skills/sui-compat-matrix/SKILL.md` for the banner spec and bump SOP.

| Skill | Package | Kind | Tested | Accepted | Last verified | Notes-tag |
|---|---|---|---|---|---|---|
| skills/sui-ts-sdk/SKILL.md | @mysten/sui | primary | 2.23.2 | ^2.0 | 2026-08-06 | — |
| skills/sui-frontend/SKILL.md | @mysten/sui | primary | 2.23.2 | ^2.0 | 2026-08-06 | — |
| skills/sui-frontend/SKILL.md | @mysten/dapp-kit-react | primary | 2.1.15 | ^2.0 | 2026-08-06 | ui-subpath |
| skills/sui-frontend/SKILL.md | @mysten/dapp-kit-core | primary | 1.6.13 | ^1.3 | 2026-08-06 | — |
| skills/sui-deepbook/SKILL.md | @mysten/deepbook-v3 | primary | 1.6.3 | ^1.3 | 2026-08-06 | v2-deprecated |
| skills/sui-deepbook/SKILL.md | @mysten/sui | primary | 2.23.2 | ^2.16 | 2026-08-06 | — |
| skills/sui-kiosk/SKILL.md | @mysten/kiosk | primary | 1.3.13 | ^1.2 | 2026-08-06 | no-grpc |
| skills/sui-kiosk/SKILL.md | @mysten/sui | primary | 2.23.2 | ^2.16 | 2026-08-06 | — |
| skills/sui-seal/SKILL.md | @mysten/seal | primary | 1.3.8 | ^1.1 | 2026-08-06 | — |
| skills/sui-seal/SKILL.md | @mysten/sui | peer | 2.23.2 | ^2.16 | 2026-08-06 | — |
| skills/sui-walrus/SKILL.md | @mysten/walrus | primary | 1.2.13 | ^1.1 | 2026-08-06 | — |
| skills/sui-walrus/SKILL.md | @mysten/sui | peer | 2.23.2 | ^2.16 | 2026-08-06 | — |
| skills/sui-suins/SKILL.md | @mysten/suins | primary | 1.2.13 | ^1.1 | 2026-08-06 | — |
| skills/sui-suins/SKILL.md | @mysten/sui | peer | 2.23.2 | ^2.16 | 2026-08-06 | — |
| skills/sui-passkey/SKILL.md | @mysten/sui | primary | 2.23.2 | ^2.0 | 2026-08-06 | sub-export:passkey |
| skills/sui-zklogin/SKILL.md | @mysten/sui | primary | 2.23.2 | ^2.0 | 2026-08-06 | sub-export:zklogin |
| skills/sui-move-ts-bridge/SKILL.md | @mysten/sui | primary | 2.23.2 | ^2.16 | 2026-08-06 | — |
| skills/sui-move-ts-bridge/SKILL.md | @mysten/kiosk | primary | 1.3.13 | ^1.2 | 2026-08-06 | no-grpc |
| skills/sui-enoki/SKILL.md | @mysten/enoki | primary | 1.2.11 | ^1.0 | 2026-08-06 | — |
| skills/sui-enoki/SKILL.md | @mysten/sui | peer | 2.23.2 | ^2.16 | 2026-08-06 | — |

## Notes-tag glossary

- `no-grpc` — package does not accept `SuiGrpcClient` (use `SuiGraphQLClient`; `SuiJsonRpcClient` now only works against your own full node — public fullnode JSON-RPC shut off 2026-07-31)
- `ui-subpath` — UI components moved to `/ui` subpath (e.g. `@mysten/dapp-kit-react/ui`)
- `v2-deprecated` — legacy v2 package retired; current is v3
- `sub-export:<name>` — API lives at `@mysten/sui/<name>`, not a separate package
