# Move Contract Security & Architecture Finding Registry

A structured registry of security, design, and quality findings for auditing **Sui Move** smart
contracts. Use this for deep contract review (beyond the secret-scanning / pre-commit setup in the
main skill). When asked for a focused review (e.g. "access control + arithmetic"), report **only**
findings whose IDs match the requested categories.

> **Attribution:** Distilled from [MystenLabs/move-code-review-skill](https://github.com/MystenLabs/move-code-review-skill)
> (Apache-2.0), itself derived from 40+ production Move contract reviews. IDs and severities preserved
> from the source so reports stay cross-referenceable.

## Severity

| Sev | Weight | Meaning |
|---|---|---|
| **S1** Critical | 10 | Direct financial loss, unauthorized access, data corruption, funds locked permanently |
| **S2** High | 7 | Incorrect behavior, data-integrity loss, availability/DoS impact |
| **S3** Medium | 4 | Maintainability/scalability risk, reduced composability, correctness under edge conditions |
| **S4** Low | 2 | Code quality, docs, style that hinders long-term maintenance |

## SEC — Security

| ID | Sev | Check | Damage |
|---|---|---|---|
| `SEC-AC-1` | S1 | Unprotected public fn allowing unauthorized mint/create/modify | Unauthorized minting, self-KYC, privilege escalation |
| `SEC-AC-2` | S1 | Auth fn returns `bool` but caller never asserts it | Access-control bypass |
| `SEC-AC-3` | S1 | Missing capability/witness check on critical state-modifying op | Unauthorized state modification |
| `SEC-AR-1` | S1 | Division where denominator can be zero | Abort/panic in production |
| `SEC-AR-2` | S1 | Integer narrowing (u128→u64, u64→u32) without bounds check | Silent truncation, wrong amounts, fund loss |
| `SEC-LG-1` | S1 | Inverted security logic — check blocks wrong party / allows wrong action | Security bypass |
| `SEC-AR-3` | S2 | Precision loss from premature flooring / storing intermediates | Accumulated rounding errors in financial math |
| `SEC-LG-2` | S2 | Wrong-field update — modifies a different field than intended | Silent data corruption |

## DES — Design & Architecture

| ID | Sev | Check | Damage |
|---|---|---|---|
| `DES-OM-1` | S2 | VecMap/VecSet for collections growing beyond ~1,000 entries | O(n) ops → tx timeout / DoS |
| `DES-OM-2` | S2 | Shared object needs `&mut` for most ops on high-TPS paths | Throughput bottleneck, contention |
| `DES-BT-1` | S2 | Transfer-to-object without corresponding `receive` logic | Permanently locked assets |
| `DES-OM-3` | S3 | Multiple `Publisher` objects instead of one shared Registry (borrow/return) | Authority fragmentation |
| `DES-DS-1` | S3 | `address` used where `ID` should reference an object | Type confusion, weaker safety |
| `DES-DS-2` | S3 | Magic numbers as states instead of `Option`/enum | Obscure semantics |
| `DES-FN-1` | S3 | Fn calls `transfer::(public_)transfer` internally instead of returning the object | Breaks PTB composability |
| `DES-FN-2` | S3 | Dedicated batch fn instead of letting callers use PTB loops | Vector limits, less flexibility |
| `DES-DS-3` | S4 | LinkedTable where Table / small VecMap suffice | Unneeded complexity + gas |
| `DES-FN-3` | S4 | Wrapper fn adding indirection without value | Code bloat |

## PAT — Capability & Version Patterns

| ID | Sev | Check | Damage |
|---|---|---|---|
| `PAT-VM-1` | S2 | Missing version checks on state-modifying fns in upgradeable packages | Post-upgrade state corruption |
| `PAT-CP-1` | S3 | Solidity-style role-mapping / modifier auth instead of Move capability objects | Object-model misuse, weaker guarantees |
| `PAT-CP-2` | S3 | Unnecessary `public(package)` — fn only used in its own module | Larger attack surface |
| `PAT-VM-2` | S3 | Migration fn present in a v1 (never-upgraded) package | Dead code, premature abstraction |

## TST — Testing & Validation

| ID | Sev | Check | Damage |
|---|---|---|---|
| `TST-CV-1` | S2 | Security-critical fns (auth/transfers/math) have zero test coverage | Undetected vulns ship |
| `TST-CV-2` | S3 | Only happy-path tests — no failure/revert cases | Edge-case bugs undetected |
| `TST-VL-1` | S3 | Missing bounds checks for vector/VecMap ops | Index-out-of-bounds abort |
| `TST-VL-2` | S3 | Loops without verified termination | Infinite loop / gas exhaustion |
| `TST-VL-3` | S3 | Time calcs ignoring edge cases (epoch boundaries, zero durations) | Incorrect time logic |

## QA — Code Quality & Maintainability

| ID | Sev | Check | Damage |
|---|---|---|---|
| `QA-UC-1` | S3 | Unreachable code — no public/entry path can invoke it | Dead feature / incomplete impl |
| `QA-NM-3` | S3 | Type names shadowing framework types (`CoinMetadata`, `TreasuryCap`, `Publisher`, …) | Type confusion, import collisions |
| `QA-MO-1` | S4 | Module exceeds ~500 lines | Hard to review, higher defect density |
| `QA-MO-2` | S4 | Related defs (roles, consts, types) scattered across modules | Harder to maintain |
| `QA-MO-3` | S4 | Business logic fragmented without clear responsibility boundaries | Hard to trace data flow |
| `QA-NM-1` | S4 | Generic variable names (`data`, `keys`, `info`) | Ambiguous code |
| `QA-NM-2` | S4 | Time fields missing unit suffix (`start_time` vs `start_time_ms`) | Unit-confusion bugs |
| `QA-DC-1` | S4 | Public fns missing `///` doc comments | Undocumented API |
| `QA-DC-2` | S4 | Unresolved TODO/FIXME/HACK in non-test code | Unfinished work shipping |

## CFG — Configuration & Constants

| ID | Sev | Check | Damage |
|---|---|---|---|
| `CFG-HC-1` | S3 | Hardcoded addresses in non-test, non-init code | Can't change recipient/admin without upgrade |
| `CFG-HC-2` | S3 | Non-configurable limits that should be governance-controlled | Inflexible; upgrade needed to tune |
| `CFG-MN-1` | S3 | Numeric literals without named constants | Obscure meaning, error-prone |
| `CFG-MD-1` | S4 | Metadata frozen before required fields set (e.g. `icon_url`) | Permanently incomplete metadata |

## Review workflow

1. **Discovery** — map modules, entry/public fns, capabilities, shared objects, upgrade story.
2. **SEC scan** — access control (AC), arithmetic (AR), logic (LG). Mark security-critical fns for the TST cross-check.
3. **DES scan** — object model (OM), data structures (DS), function design (FN), blind transfers (BT-1).
4. **PAT scan** — capability patterns (CP), version management (VM).
5. **TST scan** — cross-reference Phase-2 critical fns against tests (CV); validation gaps (VL).
6. **QA/CFG scan** — unused code, module size/org, naming/docs, hardcoded config.

**Report:** a findings table (`ID | Severity | Location | Description | Recommendation`), a summary
count by severity, and a **"Reviewed and Cleared"** section noting what was checked and found safe
(so the report shows coverage, not just hits). For scoped reviews, emit only the requested ID prefixes;
mention adjacent observations briefly under Reviewed-and-Cleared rather than as formal findings.
