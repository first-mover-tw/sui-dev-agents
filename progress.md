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
