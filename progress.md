# sui-dev-agents Progress

## 2026-02-11: 新增 sui-red-team 對抗性資安測試

### 做了什麼
新增 `sui-red-team` skill + subagent，自動生成攻擊測試（預設 10 輪），涵蓋 8 大攻擊類別。

### 新增檔案
- `skills/sui-red-team/SKILL.md` — skill 定義
- `skills/sui-red-team/references/reference.md` — 27 個攻擊向量 catalog
- `skills/sui-red-team/references/examples.md` — 9 個 Move 攻擊測試範例
- `agents/subagents/sui-red-team-subagent.json` — subagent 定義
- `agents/subagents/sui-red-team-subagent-prompt.md` — subagent prompt
- `scripts/hooks/red-team-guard.sh` — deploy 前提醒 hook

### 修改檔案
- `hooks/hooks.json` — 加入 red-team-guard PreToolUse hook
- `agents/claude-code-agent-config.json` — 註冊 sui-red-team-subagent
- `agents/development/sui-development-agent-prompt.md` — routing + workflow 加入 red team 階段

### 決策
- Hook 用 WARN 而非 block（開發者自行決定是否跑紅隊）
- Subagent 給完整工具集（Skill, Read, Write, Edit, Bash, Glob, Grep）因為需要讀 source、生成測試、執行測試
- Workflow 改為 Testing → Red Team → Deployment，有 EXPLOITED 結果就不該直接 deploy

### TODO
- [x] 在 `examples/starter-defi/` 上實測 `/sui-red-team` 驗證完整流程
- [x] 測試 `--rounds` 和 `--keep-tests` 參數
- [x] 確認報告格式與漏洞分類合理

## 2026-02-11: Red Team 實測 + 修復 starter-defi/pool.move

### Red Team 結果 (10 rounds, 13 tests)
- EXPLOITED: 5（permissionless create, no slippage, fee bypass, reversed pool, dust spam）
- SUSPICIOUS: 1（flash loan + LP extraction）
- DEFENDED: 4（dust swap, first depositor, MAX_U64 overflow x2）

### 修復內容 (`sources/pool.move`)
1. **Slippage 保護** — `swap_x_to_y`/`swap_y_to_x` 新增 `min_amount_out` 參數 + `ESlippageExceeded` check
2. **最小 swap 金額** — `MIN_SWAP_AMOUNT = 100`，防 fee rounding bypass
3. **最小 deposit 金額** — `MIN_DEPOSIT_AMOUNT = 100`，防 dust LPToken spam
4. **首次 LP 門檻** — `MIN_LIQUIDITY = 1000`，防 first-depositor manipulation
5. **Overflow 防護** — swap 計算改用 u128 中間值
6. **LP amount > 0 check** — `EZeroLPMinted` 防 zero-LP mint
7. **remove_liquidity amount > 0 check**

### 未修復（design choice）
- `create_pool` 仍 permissionless（AMM 常見設計）
- 未防止反向 Pool<Y,X> 建立（需 type ordering，較複雜）

### 驗證
- 6 個 verification tests 全部 PASS，確認修復有效

## 2026-02-11: 測試 --rounds / --keep-tests 參數 + 修復 plugin 註冊

### 測試結果
- `--rounds 3`：正確只跑 3 輪（非預設 10）✅
- 無 `--keep-tests`：測試檔全部清理（tests/ 為空）✅
- `--keep-tests`：3 個測試檔保留在 `tests/red-team/` ✅

### 修復：Plugin 註冊缺漏
- 新建 `agents/sui-red-team-subagent.md`（頂層 agent 定義，之前漏建）
- `.claude-plugin/plugin.json` agents 陣列加入：
  - `./agents/sui-red-team-subagent.md`
  - `./agents/subagents/sui-red-team-subagent-prompt.md`

### 新發現漏洞（修復後仍存在）
- **LPToken 未綁定 pool ID** — LPToken<X,Y> 可跨不同 Pool<X,Y> 使用（需加 pool_id field）
- **add_liquidity line 64 u64 overflow** — `(amount_x * amount_y).sqrt()` 需改 u128
- **fee rounding bypass** — MIN_SWAP_AMOUNT=100 時 fee 趨近零，建議提高到 334+

### TODO
- [x] 修復 LPToken pool_id 綁定（加 `pool_id: ID` field + `EPoolMismatch` check）
- [x] add_liquidity 改用 u128 計算初始 LP（`(amount_x as u128) * (amount_y as u128)` 再 sqrt）
- [x] MIN_SWAP_AMOUNT 100 → 334，確保 fee >= 1

## 2026-02-11: 新增 sui-decompile skill + Coverage 分析工具

### 背景
調研網上現有 SUI 開發工具後，發現我們缺少「研究鏈上合約」和「自動覆蓋率分析」兩大功能。

### 新增檔案
- `skills/sui-decompile/SKILL.md` — 鏈上合約反編譯/原始碼擷取 skill
  - Method 1: `sui client` CLI（最快，不需 browser）
  - Method 2: Suivision Explorer（Playwright MCP，有 verified source）
  - Method 3: Suiscan Explorer（Playwright MCP，fallback）
  - 支援多模組 package、常用合約表、與其他 skill 整合
- `skills/sui-tester/scripts/analyze_source.py` — PTY 擷取 colored coverage output，辨識未覆蓋段落，輸出 human/JSON/markdown
- `skills/sui-tester/scripts/analyze_lcov.py` — 解析 LCOV 格式，function/line/branch 分析 + 優先級建議
- `skills/sui-tester/scripts/parse_bytecode.py` — pipe-based bytecode coverage parser
- `skills/sui-tester/scripts/parse_source.py` — pipe-based source coverage parser

### 修改檔案
- `skills/sui-tester/SKILL.md` — 新增「Automated Coverage Analysis Tools」、「Coverage Improvement Workflow」、「Coverage Test Patterns」三大段落
- `.claude-plugin/plugin-marketplace-metadata.json` — skill count 18→19，features 加入 decompile + coverage analysis

### 決策
- sui-decompile 優先用 CLI method（不需 browser），browser 作為有 verified source 時的替代
- Coverage scripts 放在 sui-tester/scripts/ 而非獨立 skill（與現有測試 workflow 整合更自然）
- ~~SUI MCP Server 和 Agent Wallet 暫不實作~~ → 已於同日完成（見下方）

### TODO
- [x] 用 `0xdee9` (DeepBook) 測試 sui-decompile 能否擷取原始碼
  - Suivision Code tab 成功載入，7 模組（clob, clob_v2, critbit, custodian, custodian_v2, math, order_query）
  - `table tr > td` selector 正確抽取 1703 行 verified source
  - 模組 sidebar selector 已修正（原 `[role="tab"]` 抓不到，改用文字匹配）
- [x] 用 `examples/` starter project 跑 coverage analysis，確認報告正確
  - 5 tests PASS，analyze_source.py 找到 46 uncovered segments
  - human / JSON / markdown 三種輸出格式均正常
- [x] 確認 analyze_source.py PTY 在 macOS 上正常運作

## 2026-02-11: SUI MCP Server + Agent Wallet

### 背景
調研網上現有 SUI MCP server（有偏 wallet、偏 DeFi、極簡版等不同取向），決定自建 MCP server。理由：現有 package 各有偏重，而我們的 plugin 已有 skills 覆蓋大部分功能，MCP 的價值在於結構化查詢 + wallet 簽章整合。

### 新增檔案
- `mcp-server/` — 完整 TypeScript MCP server（pnpm, `@modelcontextprotocol/sdk` + `@mysten/sui`）
  - `src/index.ts` — server entry, 14 tools 註冊, stdio transport
  - `src/client.ts` — SuiClient wrapper, 讀 `SUI_NETWORK` env var
  - `src/tools/balance.ts` — `sui_get_balance`（所有 coin types）
  - `src/tools/object.ts` — `sui_get_object`, `sui_get_owned_objects`
  - `src/tools/transaction.ts` — `sui_get_transaction`, `sui_dry_run`
  - `src/tools/events.ts` — `sui_get_events`（by digest 或 event type）
  - `src/tools/coins.ts` — `sui_get_coins`
  - `src/tools/network.ts` — `sui_get_latest_checkpoint`
  - `src/tools/names.ts` — `sui_resolve_name`（SuiNS 雙向解析）
  - `src/tools/package.ts` — `sui_get_package`（列出 modules/structs/functions）
  - `src/tools/wallet.ts` — 4 wallet tools（status, transfer, call, publish）
- `scripts/hooks/tx-approval-guard.sh` — 攔截繞過 MCP 的直接 CLI 簽章
- `skills/sui-wallet/SKILL.md` — Agent wallet 操作指南
- `commands/mcp-status.md` — MCP 狀態檢查指令
- `commands/wallet-status.md` — Wallet 狀態檢查指令

### 修改檔案
- `.mcp.json` — 註冊 `sui-dev-mcp` server（保留原有 template）
- `hooks/hooks.json` — 加入 `tx-approval-guard` PreToolUse hook
- `.claude-plugin/plugin.json` — version 2.1.0 → 2.2.0
- `agents/subagents/sui-deployer-subagent-prompt.md` — 加入 wallet approval 流程
- `agents/subagents/sui-developer-subagent-prompt.md` — 加入 MCP query tools 使用指引
- `agents/subagents/sui-tester-subagent-prompt.md` — 加入 MCP 驗證說明

### 決策
- **10 query tools + 4 wallet tools**：query 不重複現有 skills（build/test/publish/decompile），wallet 用 dry-run → approve → execute 流程
- **Wallet 用 `execFileSync`**（非 `exec`）防 command injection
- **Wallet tools 不自動執行**：只做 dry-run 並回傳 `PENDING_APPROVAL`，使用者在 Claude Code 確認後才執行
- **tx-approval-guard hook** 作為 backup，攔截直接 `sui client` 簽章指令

### TODO
- [x] 重啟 session 驗證 MCP server 自動載入
  - 根因：`installed_plugins.json` 指向 `2.1.0` cache（無 mcp-server/）
  - 修復：建立 `2.2.0` cache + 更新 `installed_plugins.json` installPath & version
- [~] `/mcp-status` 確認連線 → 需重啟 session
- [~] E2E: 用 `sui_get_package` 查 `0x2` package → 需重啟 session
- [~] E2E: `/wallet-status` 顯示 address + balance → 需重啟 session
- [~] E2E: `sui_wallet_publish` deploy starter-defi → 需重啟 session

## 2026-02-11: MCP Server JSON-RPC → gRPC + SDK PTB Migration

### 背景
JSON-RPC deprecated（2026 April 移除）。MCP server 原用 `SuiClient`（JSON-RPC），需改 gRPC。Wallet tools 原用 `execFileSync("sui", ...)` CLI，改用 SDK PTB。

### 修改檔案

| File | Change |
|------|--------|
| `client.ts` | `SuiClient` → `SuiGrpcClient` + `baseUrl` + `getActiveAddress()` + `getActiveKeypair()` (支援 bech32 & legacy base64 keystore) |
| `yaml.ts` | **新增** — 最小 YAML parser 讀 `client.yaml` active_address |
| `balance.ts` | `client.getAllBalances({owner})` → `client.core.getAllBalances({address})` |
| `coins.ts` | `client.getCoins({owner})` → `client.core.getCoins({address})`, response `.objects[]` |
| `events.ts` | `queryEvents` → `core.getTransaction()` 取 events（gRPC 無 queryEvents） |
| `names.ts` | `resolveNameServiceAddress` → `nameService.lookupName()` / `reverseLookupName()` + NOT_FOUND handling |
| `network.ts` | `getLatestCheckpointSequenceNumber` → `ledgerService.getServiceInfo()` |
| `object.ts` | `getObject` → `core.getObjects({objectIds})`, `getOwnedObjects` → `core.getOwnedObjects({address})` |
| `package.ts` | `getNormalizedMoveModulesByPackage` → `movePackageService.getPackage()` |
| `transaction.ts` | `getTransactionBlock` → `core.getTransaction()`, `dryRunTransactionBlock` → `core.dryRunTransaction()` + `fromBase64` |
| `wallet.ts` | 全部 `execFileSync("sui")` 移除（publish 的 build 除外），改用 SDK `Transaction` PTB + `buildAndDryRun` / `signAndExecute` helpers，新增 `execute` flag |

### 關鍵發現
- `SuiGrpcClient` 需要 `baseUrl`（gRPC endpoint），`{ network }` alone 不夠
- gRPC endpoints: `https://fullnode.{network}.sui.io:443`
- `core.*` 方法用 `address` 非 `owner`，response 結構不同（`.balances[]`, `.objects[]`, `.cursor`）
- `dryRunTransaction` / `executeTransaction` 需 `Uint8Array`（tx.build() 產生），不接受 Transaction 物件
- sui.keystore 可能是 legacy base64 格式（flag byte + 32-byte key），非 bech32
- gRPC 無 `queryEvents` by event type，events tool 簡化為只接受 digest
- `SUI_GRPC_URL` env 可覆寫 gRPC endpoint

### 驗證
- `pnpm build` — 零 type errors
- gRPC testnet 連線成功 — checkpoint, balance, coins, objects, ownedObjects, package 全通
- Keypair loading — legacy base64 keystore 正確載入並 match active address
- nameService NOT_FOUND 正確 handled

### TODO
- [x] 重啟 session 測試 MCP tools 載入（見下方「修復 Plugin 版本指向」）
- [~] E2E: `sui_wallet_status` — 需重啟 session
- [~] E2E: `sui_get_package 0x2` — 需重啟 session
- [~] E2E: `sui_wallet_transfer` dry-run — 需重啟 session

## 2026-02-11: 修復 Plugin MCP Server 載入問題

### 根因
Plugin MCP tools 未出現在 session 中（無 `mcp__plugin_sui-dev-agents_sui-dev-mcp__*`）。

### 發現
1. **`.mcp.json` 格式錯誤** — 多包了一層 `mcpServers` wrapper。正確格式是 server name 直接作為頂層 key（與 context7/playwright 一致）
2. **Cache 版本過舊** — marketplace 和 cache 都停在 2.1.0（MCP server 尚未加入的版本），`mcp-server/dist/` 不存在
3. **Plugin MCP 載入機制** — Claude Code 會自動在 plugin 目錄找 `.mcp.json`，不需要 `plugin.json` 裡聲明 `mcpServers` 欄位

### 修改
- `.mcp.json` — 移除 `mcpServers` wrapper，改為扁平格式；路徑改回 `${CLAUDE_PLUGIN_ROOT}`
- `~/.claude/plugins/marketplaces/sui-dev-agents/` — 同步 `.mcp.json` + `mcp-server/`
- `~/.claude/plugins/cache/sui-dev-agents/sui-dev-agents/2.1.0/` — 同步 `.mcp.json` + `mcp-server/`

### TODO
- [x] 重啟 session 驗證 `sui_*` MCP tools 出現（見下方「修復 Plugin 版本指向」）
- [~] 跑 E2E 測試（mcp-status, get_package, wallet-status, wallet_transfer dry-run）→ 需重啟 session
- [ ] 正式 push 2.2.0 到 GitHub

## 2026-02-11: Plugin 全面排查 JSON-RPC → gRPC 註解更新

### 背景
排查所有 skill 檔案中的 JSON-RPC 相關程式碼範例，確保沒有遺留舊 API 或缺少 gRPC 遷移說明。

### 修改檔案（7 處，6 檔）

| File | Change |
|------|--------|
| `skills/sui-zklogin/SKILL.md` | `executeTransactionBlock` → `executeTransaction`，參數 `transactionBlock` → `transaction`，加 gRPC 註解 |
| `skills/sui-frontend/SKILL.md` | SuiClient 範例加 gRPC 註解 |
| `skills/sui-frontend/references/reference.md` | SuiClient Methods 加 gRPC 說明 + `executeTransactionBlock` → `executeTransaction` |
| `skills/sui-fullstack-integration/references/examples.md` | SuiClient import 加 gRPC 註解 |
| `skills/sui-developer/references/examples.md` | subscribeEvent 加 gRPC streaming 註解 |
| `skills/sui-deepbook/SKILL.md` | getObject 範例加 gRPC 註解 |

### 不需修改（已正確）
- `mcp-server/` — 已用 `SuiGrpcClient` ✅
- `hooks/jsonrpc-warn.sh` — 偵測 hook 正常 ✅
- `rules/common/api-migration.md` — 遷移規則完整 ✅
- `skills/sui-frontend/references/grpc-reference.md` — gRPC 參考文件完整 ✅

## 2026-02-11: 修復 Plugin 版本指向（MCP tools 不載入）

### 根因
`~/.claude/plugins/installed_plugins.json` 的 `sui-dev-agents` 指向 `2.1.0` cache（該版本無 `mcp-server/`），導致 MCP server 永遠不載入。

### 修復
1. `rsync` source → `~/.claude/plugins/cache/sui-dev-agents/sui-dev-agents/2.2.0/`
2. `rsync` source → `~/.claude/plugins/marketplaces/sui-dev-agents/`
3. `installed_plugins.json` — installPath 改指 `2.2.0`，version 改 `2.2.0`

### TODO
- [~] 重啟 session 驗證 `sui_*` MCP tools 出現 → 需重啟 session
- [ ] E2E 全套測試（mcp-status, get_package, wallet-status, wallet_transfer dry-run）
- [ ] push 2.2.0 到 GitHub

## 2026-02-12: 修復 MCP Server node_modules 缺失

### 根因
Cache 目錄 `~/.claude/plugins/cache/sui-dev-agents/sui-dev-agents/2.2.0/mcp-server/` 缺少 `node_modules/`，導致 `node mcp-server/dist/index.js` 啟動時 `ERR_MODULE_NOT_FOUND: Cannot find package '@modelcontextprotocol/sdk'`。

之前 rsync 時可能跳過了 `node_modules`（或 `.gitignore` 排除了）。

### 修復
1. `rsync` source `node_modules/` → cache `2.2.0/mcp-server/node_modules/`
2. `cp -RL` source `node_modules/` → marketplace（解析 pnpm symlink）
3. 手動確認 `node mcp-server/dist/index.js` 啟動成功（無 error）

### TODO
- [~] 重啟 session 驗證 `sui_*` MCP tools 出現 → 見下方「修復 plugin.json 缺 mcpServers 宣告」
- [ ] E2E 全套測試（mcp-status, get_package, wallet-status, wallet_transfer dry-run）
- [ ] push 2.2.0 到 GitHub

## 2026-02-12: 修復 plugin.json 缺 mcpServers 宣告

### 根因
`plugin.json` 沒有 `mcpServers` field，Claude Code 不會自動 discover plugin root 的 `.mcp.json`（auto-discovery 可能只在 `--plugin-dir` 開發模式有效，installed plugin 需要明確宣告）。

驗證：
- Cache 目錄 `.mcp.json` 格式正確、`node_modules` 齊全、server 啟動零錯誤（exit 124 = timeout, 無 stderr）
- `installed_plugins.json` 指向 `2.2.0` ✓
- `ps aux` 確認無 `sui-dev-mcp` process — Claude Code 根本沒嘗試啟動
- context7/playwright 都用 `.mcp.json` at root，但它們的 `plugin.json` 極簡（可能用了不同載入機制）

### 修復
1. `plugin.json` 加入 `"mcpServers": "./.mcp.json"`（與 `"lspServers": "./.lsp.json"` 對齊）
2. `rsync` plugin.json → cache `2.2.0/` + marketplace

### TODO
- [ ] 重啟 session 驗證 `mcp__plugin_sui-dev-agents_sui-dev-mcp__*` tools 出現
- [ ] E2E 全套測試（mcp-status, get_package, wallet-status, wallet_transfer dry-run）
- [x] push 2.2.0 到 GitHub

## 2026-02-12: 更新文檔 + Push v2.2.0 到 GitHub

### 做了什麼
更新 README、docs/（GUIDE, ARCHITECTURE, QUICKSTART）、marketplace metadata 至 v2.2.0，反映所有新功能。

### 修改檔案（39 files, +2314 / -235）

| 類別 | 重點變更 |
|------|---------|
| `README.md` | v2.2.0、新增 MCP Server + Agent Wallet section、decompile/red-team/wallet 提及、計數更新 |
| `docs/GUIDE.md` | v2.2.0、新增 MCP Server & Agent Wallet 段落、4 個新 skill 說明、9 commands、8 hooks 完整表格 |
| `docs/ARCHITECTURE.md` | v2.2.0、系統架構圖更新（加 MCP Server layer）、directory structure 完整重寫、version history 加入 v2.2.0 |
| `docs/QUICKSTART.md` | 新增 Security & Analysis 段落、MCP/wallet commands、hooks 更新為 8 個 |
| `.claude-plugin/plugin-marketplace-metadata.json` | v2.2.0、features 14 項、capabilities 全開（skills/agents/hooks/mcp/commands/rules）|
| `.gitignore` | 加入 `**/node_modules/`、`mcp-server/dist/`、coverage artifacts、`.claude/` |

### 計數更新

| 元件 | 舊 | 新 |
|------|---|---|
| Skills | 19 | **22**（+red-team, decompile, wallet, move-code-quality）|
| Commands | 7 | **9**（+mcp-status, wallet-status）|
| Hooks | 3 | **8**（+gas-budget-guard, red-team-guard, tx-approval-guard, mainnet-guard, jsonrpc-warn）|
| Rules | 4 | **5**（+api-migration）|
| MCP Tools | 0 | **14**（10 query + 4 wallet）|

### Git
- Commit: `58d3364` — pushed to `main`
- 排除：`.claude/settings.local.json`、`progress.md`、test artifacts

### TODO
- [ ] 重啟 session 驗證 MCP Server 載入
- [ ] E2E 全套測試（mcp-status, get_package, wallet-status, wallet_transfer dry-run）
