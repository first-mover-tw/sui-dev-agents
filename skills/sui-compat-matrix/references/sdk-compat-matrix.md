# SUI SDK Compat Matrix

Canonical source-of-truth for `@mysten/*` versions across in-scope skills. See `skills/sui-compat-matrix/SKILL.md` for the banner spec and bump SOP.

| Skill | Package | Kind | Tested | Accepted | Last verified | Notes-tag |
|---|---|---|---|---|---|---|
| skills/sui-ts-sdk/SKILL.md | @mysten/sui | primary | 2.24.0 | ^2.0 | 2026-08-16 | — |
| skills/sui-frontend/SKILL.md | @mysten/sui | primary | 2.24.0 | ^2.0 | 2026-08-16 | — |
| skills/sui-frontend/SKILL.md | @mysten/dapp-kit-react | primary | 2.1.16 | ^2.0 | 2026-08-16 | ui-subpath |
| skills/sui-frontend/SKILL.md | @mysten/dapp-kit-core | primary | 1.6.14 | ^1.3 | 2026-08-16 | — |
| skills/sui-deepbook/SKILL.md | @mysten/deepbook-v3 | primary | 1.6.4 | ^1.3 | 2026-08-16 | v2-deprecated |
| skills/sui-deepbook/SKILL.md | @mysten/sui | primary | 2.24.0 | ^2.16 | 2026-08-16 | — |
| skills/sui-kiosk/SKILL.md | @mysten/kiosk | primary | 1.4.0 | ^1.2 | 2026-08-16 | grpc-needs-1-4 |
| skills/sui-kiosk/SKILL.md | @mysten/sui | primary | 2.24.0 | ^2.16 | 2026-08-16 | — |
| skills/sui-seal/SKILL.md | @mysten/seal | primary | 1.4.0 | ^1.1 | 2026-08-16 | — |
| skills/sui-seal/SKILL.md | @mysten/sui | peer | 2.24.0 | ^2.16 | 2026-08-16 | — |
| skills/sui-walrus/SKILL.md | @mysten/walrus | primary | 1.2.14 | ^1.1 | 2026-08-16 | — |
| skills/sui-walrus/SKILL.md | @mysten/sui | peer | 2.24.0 | ^2.16 | 2026-08-16 | — |
| skills/sui-suins/SKILL.md | @mysten/suins | primary | 1.2.14 | ^1.1 | 2026-08-16 | — |
| skills/sui-suins/SKILL.md | @mysten/sui | peer | 2.24.0 | ^2.16 | 2026-08-16 | — |
| skills/sui-passkey/SKILL.md | @mysten/sui | primary | 2.24.0 | ^2.0 | 2026-08-16 | sub-export:passkey |
| skills/sui-zklogin/SKILL.md | @mysten/sui | primary | 2.24.0 | ^2.0 | 2026-08-16 | sub-export:zklogin |
| skills/sui-move-ts-bridge/SKILL.md | @mysten/sui | primary | 2.24.0 | ^2.16 | 2026-08-16 | — |
| skills/sui-move-ts-bridge/SKILL.md | @mysten/kiosk | primary | 1.4.0 | ^1.2 | 2026-08-16 | grpc-needs-1-4 |
| skills/sui-enoki/SKILL.md | @mysten/enoki | primary | 1.2.12 | ^1.0 | 2026-08-16 | — |
| skills/sui-enoki/SKILL.md | @mysten/sui | peer | 2.24.0 | ^2.16 | 2026-08-16 | — |

## Notes-tag glossary

- `ui-subpath` — UI components moved to `/ui` subpath (e.g. `@mysten/dapp-kit-react/ui`)
- `v2-deprecated` — legacy v2 package retired; current is v3
- `sub-export:<name>` — API lives at `@mysten/sui/<name>`, not a separate package
- `grpc-needs-1-4` — `KioskCompatibleClient` only widened to `ClientWithCoreApi` (gRPC accepted) in kiosk 1.4.0; the 1.2.x–1.3.x tail of the accepted range still rejects `SuiGrpcClient`
