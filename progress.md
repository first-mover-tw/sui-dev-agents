# sui-dev-agents Progress

## 2026-02-22: v2.3.0 — 整合 MystenLabs 官方 sui-dev-skills (SDK v2 + dApp Kit v2)

### 做了什麼
整合 MystenLabs 官方 [sui-dev-skills](https://github.com/MystenLabs/sui-dev-skills) 三個 skill（sui-move, sui-ts-sdk, sui-frontend）作為 source of truth。全面更新 plugin 至 SDK v2 + dApp Kit v2 + Move 2024。

### 新增檔案（3）
- `skills/sui-ts-sdk/SKILL.md` — 新 skill：TypeScript SDK v2（PTB, client, execution, queries）
- `skills/sui-ts-sdk/references/reference.md` — v1→v2 API mapping
- `skills/sui-ts-sdk/references/examples.md` — $extend, coinWithBalance, sponsored tx, BCS 範例

### 修改檔案（18）

| 類別 | 檔案 | 變更 |
|------|------|------|
| **P0 Move Rules** | `rules/sui-move/conventions.md` | 全面重寫：Move 2024 module syntax, public struct, EPascalCase, #[error] macro, method syntax, enums, macros, OTW, capability, pure functions |
| | `rules/sui-move/testing.md` | 更新：test_ prefix 不需、assert_eq!、tx_context::dummy()、test_utils::destroy、merged attributes |
| **P1 Developer** | `skills/sui-developer/SKILL.md` | Protocol 111, Transaction Driver, Balance API, move-code-quality cross-ref |
| | `skills/sui-developer/references/reference.md` | OTW/Enum/Pure patterns, #[error], method syntax, burn pattern, testing patterns |
| | `skills/sui-developer/references/examples.md` | deprecated imports 修正 |
| **P1 Frontend** | `skills/sui-frontend/SKILL.md` | 全面重寫：dApp Kit v2 (createDAppKit, useDAppKit, useCurrentClient, discriminated union results, non-React support) |
| | `skills/sui-frontend/references/reference.md` | v1→v2 method renames, client.core.*, deprecated hooks removal |
| | `skills/sui-frontend/references/grpc-reference.md` | SuiGrpcClient import, SDK v2 breaking changes |
| | `skills/sui-frontend/references/examples.md` | deprecated imports 修正 |
| **P1 Agent** | `agents/subagents/sui-frontend-subagent-prompt.md` | dApp Kit v2, Protocol 111, skill routing (frontend vs backend) |
| **P2 Fullstack** | `skills/sui-fullstack-integration/SKILL.md` | scope 釐清, client.core.*, $extend(), ESM, coinWithBalance |
| | `skills/sui-fullstack-integration/references/examples.md` | deprecated imports 修正 |
| **P2 Migration** | `rules/common/api-migration.md` | SuiGrpcClient as GOOD example, SDK v2 section |
| **P2 Agents** | `agents/sui-supreme.md` | Decision matrix: backend/CLI SDK routing |
| | `agents/sui-development-agent.md` | Routing: sui-ts-sdk + fullstack-integration |
| **P3 Wallet** | `skills/sui-wallet/SKILL.md` | "When to Use This vs dApp Kit" section |
| **P3 Plugin** | `.claude-plugin/plugin.json` | v2.3.0 |
| | `.claude-plugin/plugin-marketplace-metadata.json` | v2.3.0, 23 skills, SDK v2 mentions |

### Verification
- Deprecated pattern scan — 0 remaining `@mysten/dapp-kit` (without suffix) in recommended examples
- All 3 new sui-ts-sdk files have correct YAML frontmatter
- plugin.json skills auto-scan `./skills/` includes sui-ts-sdk

### 計數更新
| 元件 | 舊 | 新 |
|------|---|---|
| Skills | 22 | **23**（+sui-ts-sdk）|
| Version | 2.2.0 | **2.3.0** |

### TODO
- [x] Review all changes and commit — `9e7fe5a`
- [x] push v2.3.0 到 GitHub
- [ ] 更新 README / docs 反映 v2.3.0（sdk v2, dApp Kit v2, 23 skills）
- [ ] 更新 plugin cache（rsync → ~/.claude/plugins/cache/）
- [ ] 重啟 session 驗證 MCP Server 載入
- [ ] E2E 全套測試

---

## 2026-02-12: 更新文檔 + Push v2.2.0 到 GitHub

### 做了什麼
更新 README、docs/（GUIDE, ARCHITECTURE, QUICKSTART）、marketplace metadata 至 v2.2.0，反映所有新功能。

### Git
- Commit: `58d3364` — pushed to `main`

### TODO
- [ ] 重啟 session 驗證 MCP Server 載入
- [ ] E2E 全套測試（mcp-status, get_package, wallet-status, wallet_transfer dry-run）
