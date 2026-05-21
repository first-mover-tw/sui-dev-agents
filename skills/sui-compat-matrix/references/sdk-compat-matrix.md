# SUI SDK Compat Matrix

Canonical source-of-truth for `@mysten/*` versions across in-scope skills. See `skills/sui-compat-matrix/SKILL.md` for the banner spec and bump SOP.

| Skill | Package | Kind | Tested | Accepted | Last verified | Notes-tag |
|---|---|---|---|---|---|---|
| skills/sui-ts-sdk/SKILL.md | @mysten/sui | primary | 2.17.0 | ^2.0 | 2026-05-20 | — |
| skills/sui-frontend/SKILL.md | @mysten/sui | primary | 2.17.0 | ^2.0 | 2026-05-21 | — |
| skills/sui-frontend/SKILL.md | @mysten/dapp-kit-react | primary | 2.0.3 | ^2.0 | 2026-05-21 | ui-subpath |
| skills/sui-frontend/SKILL.md | @mysten/dapp-kit-core | primary | 1.3.2 | ^1.3 | 2026-05-21 | — |
| skills/sui-deepbook/SKILL.md | @mysten/deepbook-v3 | primary | 1.3.6 | ^1.3 | 2026-05-21 | v2-deprecated |
| skills/sui-deepbook/SKILL.md | @mysten/sui | primary | 2.17.0 | ^2.16 | 2026-05-21 | — |
| skills/sui-kiosk/SKILL.md | @mysten/kiosk | primary | 1.2.6 | ^1.2 | 2026-05-21 | no-grpc |
| skills/sui-kiosk/SKILL.md | @mysten/sui | primary | 2.17.0 | ^2.16 | 2026-05-21 | — |
| skills/sui-seal/SKILL.md | @mysten/seal | primary | 1.1.3 | ^1.1 | 2026-05-21 | — |
| skills/sui-seal/SKILL.md | @mysten/sui | peer | 2.17.0 | ^2.16 | 2026-05-21 | — |
| skills/sui-walrus/SKILL.md | @mysten/walrus | primary | 1.1.7 | ^1.1 | 2026-05-20 | — |
| skills/sui-walrus/SKILL.md | @mysten/sui | peer | 2.17.0 | ^2.16 | 2026-05-20 | — |
| skills/sui-suins/SKILL.md | @mysten/suins | primary | 1.1.4 | ^1.1 | 2026-05-21 | — |
| skills/sui-suins/SKILL.md | @mysten/sui | peer | 2.17.0 | ^2.16 | 2026-05-21 | — |
| skills/sui-passkey/SKILL.md | @mysten/sui | primary | 2.17.0 | ^2.0 | 2026-05-21 | sub-export:passkey |
| skills/sui-zklogin/SKILL.md | @mysten/sui | primary | 2.17.0 | ^2.0 | 2026-05-21 | sub-export:zklogin |
| skills/sui-fullstack-integration/SKILL.md | @mysten/sui | primary | 2.17.0 | ^2.16 | 2026-05-21 | — |
| skills/sui-fullstack-integration/SKILL.md | @mysten/kiosk | primary | 1.2.6 | ^1.2 | 2026-05-21 | no-grpc |

## Notes-tag glossary

- `no-grpc` — package does not accept `SuiGrpcClient` (use `SuiJsonRpcClient` or `SuiGraphQLClient`)
- `ui-subpath` — UI components moved to `/ui` subpath (e.g. `@mysten/dapp-kit-react/ui`)
- `v2-deprecated` — legacy v2 package retired; current is v3
- `sub-export:<name>` — API lives at `@mysten/sui/<name>`, not a separate package
