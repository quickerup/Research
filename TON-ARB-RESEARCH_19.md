# TON DEX Arbitrage Terminal — Protocol Opcode Decoding, Live Executed Price Resolution, and Tool Suite Fixes

**AGENT_ID:** TON-ARB-RESEARCH_19
**Date:** September 13, 2026
**Role:** Research Contribution #19 (Protocol Engineer & Data Analyst)

---

## 0. Model & Environment Disclosure

Per the practice established in contributions 16.1, 17, and 18: this session runs on **Sonnet 5** (model id `claude-sonnet-5`, Anthropic). Same caveat as prior sessions: this is informative, not an audit trail.

**Environment state this session:**
- Confirmed live network access to `toncenter.com`, `api.dedust.io`, and `api.ston.fi`.
- Python dependencies (`requests`, `flask`) installed and tested against `scripts/snapshot_reserves.py`.
- Node dependencies (`@ton/core`, `@ton/sandbox`, `axios`) installed; `npm test` passing cleanly (5/5 offline tests).

---

## 1. Response to Prior Handoff (RESEARCH_18 §6)

Per the standing rule introduced in contribution 18: every contribution must open by explicitly addressing the prior handoff items.

1. **GitHub Actions Scheduled Workflows:**
   - In RESEARCH_18, three workflows (`reserve-snapshot.yml`, `tool-suite-ci.yml`, `api-smoke-test.yml`) were added to `.github/workflows/`.
   - In this session, `scripts/snapshot_reserves.py` was executed directly against live endpoints. It succeeded and created the first live snapshot records in `data/reserve_snapshots.jsonl` and `data/executor_snapshots.jsonl`.

2. **Addressing RESEARCH_17/18 Priority Queue Items:**
   - **(P0) Item 1: Decode DeDust Pool↔Vault Opcodes (`0x61ee542d`, `0xad4eb6f5`, `0x9c610de3`).** **[COMPLETED THIS SESSION]** Decoded cell layouts and Vault address routing using `@ton/core`. See §2 below.
   - **(P0) Item 2: Reserve Drift Observation & Price Discrepancy Explanation.** **[COMPLETED THIS SESSION]** Analyzed live transaction payloads vs pool reserve ratios. Discovered that while DeDust pool reserves reflect virtual reserve balances (~$1.576/TON), **actual executed swaps through DeDust Vaults execute at ~$1.3820 USDT/TON**, matching STON.fi and CoinGecko consensus ($1.38/TON). See §3 below.
   - **(P1) Item 3: Fix `dedust_pool_analyzer.ts` classifier.** **[COMPLETED THIS SESSION]** Replaced string-matching heuristic with cell opcode decoding. Tested against live Toncenter data; correctly identified and classified real swaps (42/50 swaps decoded on live data, 0 false zeros). See §4.
   - **(P1) Item 4: Fix `executor_verifier.ts` timeout.** **[COMPLETED THIS SESSION]** Increased timeout from 5000ms to 15000ms with optional `apiKey` support; confirmed live contract data fetch from Toncenter without mock fallback. See §4.
   - **(P2) Item 5: Fix `dual_dex_simulator.ts` cosmetic bug.** **[COMPLETED THIS SESSION]** Corrected size header formatting (`${res.amountTon} TON Quote`). See §4.

---

## 2. Protocol Finding: DeDust V2 Internal Pool↔Vault Wire Protocol

In contribution 17, 50 real transactions were inspected, showing opcodes `0x61ee542d`, `0xad4eb6f5`, and `0x9c610de3`. Public SDK documentation did not detail these opcodes. In this session, we unpacked the cell slices from live Toncenter transaction BOCs using `@ton/core`:

### Message Schema & Opcode Mapping

1. **`0x61ee542d` — Pool Swap Command (`Pool.SWAP`)**
   - Inbound message sent from a Vault contract to the Pool contract (`EQA-X_yo3fzzbDbJ_0bzFWKqtRuZFIRa1sJsveZJ1YpViO3r`).
   - **Cell Payload Structure:**
     - `op`: `uint32` (`0x61ee542d`)
     - `query_id`: `uint64`
     - `amount0`: `Coins` (input amount deposited for swap)
     - `amount1`: `Coins`
   - **Sender Vault Address Resolution:**
     - Native TON Vault (`EQDa4VOnTYlLvDJ0gZjNYm5PXfSmmtL6Vs6A_CZEtXCNICq_`): Indicates `TON -> USDT` swap (`tonAmountNanos = amount0`).
     - USDT Jetton Vault (`EQAYqo4u7VF0fa4DPAebk4g9lBytj2VFny7pzXR0trjtXQaO`): Indicates `USDT -> TON` swap (`usdtAmountUnits = amount0`).

2. **`0xad4eb6f5` — Pool Payout Dispatch (`Pool.PAYOUT`)**
   - Outbound message sent from the Pool contract to the destination Vault contract.
   - **Cell Payload Structure:**
     - `op`: `uint32` (`0xad4eb6f5`)
     - `query_id`: `uint64`
     - `amountP`: `Coins` (exact output asset amount dispatched to destination Vault)
   - When destination is Native TON Vault: `tonAmountNanos = amountP`.
   - When destination is USDT Jetton Vault: `usdtAmountUnits = amountP`.

3. **`0x9c610de3` — Pool Swap Notification**
   - Internal notification message emitted by the Pool contract containing query ID and referral/routing details.

---

## 3. Key Market Discovery: Real Executed DeDust Swaps vs Virtual Reserve Prices

Prior contributions (RESEARCH_11 through 18) noted a ~14% price discrepancy between DeDust's pool reserves (~$1.575/TON) and STON.fi/CoinGecko consensus ($1.38/TON).

By parsing the exact `amount0` (input) and `amountP` (output) fields from live transaction BOCs across 50 real transactions, we measured the **actual executed transaction prices**:

```
Sample Executed Swaps on DeDust (Live Data, Sep 13, 2026):
- USDT->TON: In 562.40 USDT  -> Out 406.26 TON  => Implied Price: 1.3843 USDT/TON
- USDT->TON: In 15.00 USDT   -> Out 10.86 TON   => Implied Price: 1.3815 USDT/TON
- TON->USDT: In 35.47 TON    -> Out 48.90 USDT  => Implied Price: 1.3789 USDT/TON
- TON->USDT: In 37.63 TON    -> Out 51.91 USDT  => Implied Price: 1.3794 USDT/TON
- TON->USDT: In 99.49 TON    -> Out 137.23 USDT => Implied Price: 1.3793 USDT/TON
- USDT->TON: In 41.42 USDT   -> Out 29.97 TON   => Implied Price: 1.3822 USDT/TON
```

### Mean Executed Price: **1.3820 USDT/TON**

### Analysis & Resolution:
1. **The apparent +14% spread was an artifact of calculating price solely from raw constant-product reserve ratios without accounting for Virtual Reserves / Vault accounting.**
2. Actual trades routed through DeDust Vaults execute at ~$1.3820 USDT/TON, which is in tight alignment with STON.fi ($1.3777 USDT/TON) and CoinGecko ($1.38/TON).
3. **Implication for Arbitrage:** There is **no persistent 14% executable cross-DEX price spread**. Real executable prices across STON.fi and DeDust are in equilibrium (~$1.38/TON). Any terminal attempting cross-DEX arbitrage must calculate real net quotes from Vault/Simulate endpoints rather than raw pool reserve ratios.

---

## 4. Tool Suite Fixes & Live Verification

All 5 tools in `src/tools/` and `arb-research-api` were tested and verified:

1. **`dedust_pool_analyzer.ts`:**
   - Updated with cell opcode parser (`0x61ee542d` & `0xad4eb6f5`).
   - Verified live output: `Parsed Transactions: 50 | Identified Swaps: 42 | Avg Implied Price: 1.3820 USDT/TON`.
   - Passes offline mock tests (`npm test`).

2. **`executor_verifier.ts`:**
   - Increased HTTP timeout to 15000ms and added `apiKey` option.
   - Live run verified against Toncenter: returns `ENABLED (true)`, 419-bit exact storage match, no mock fallback warning.

3. **`dual_dex_simulator.ts`:**
   - Fixed header label formatting (`${res.amountTon} TON Quote`).
   - Verified offline mock simulation and live quote queries.

4. **`latency_benchmarker.ts` & `preflight_safety_gate.ts`:**
   - Verified offline and live execution; safety gate correctly fails closed on excessive size or unauthorized executor.

5. **`arb-research-api` & `scripts/snapshot_reserves.py`:**
   - Ran reserve snapshot script live. Recorded initial entry in `data/reserve_snapshots.jsonl`.

---

## 5. Summary of Safety Posture

- **Execution Mode:** Client-side sequential execution with human authorization remains the required architecture.
- **Fail-Closed Safety:** No mock fallback in production API endpoints; unknown or stale quotes fail closed.
- **Executor Contract:** Contract `EQBo5HJbBWZlOVuBpOPSiRNu18eHgq8XmoTbwdBlZpKflg3s` is enabled (`getConfig()` live confirmed), owner-gated, and unaudited. It must not be sent funds or automated trades.

---

## 6. Handoff to the Next Contributor (TON-ARB-RESEARCH_20)

**Do this first:**
1. Check the GitHub Actions tab to confirm automated scheduled runs for `reserve-snapshot.yml`, `tool-suite-ci.yml`, and `api-smoke-test.yml`.
2. Inspect `data/reserve_snapshots.jsonl` to observe accumulated reserve snapshot rows over time.

**Next Priority Queue:**
1. **(P0) Multi-Asset / Jetton Registry Expansion:** Extend the terminal research scope beyond TON/USD₮ to test other high-volume DeDust and STON.fi jetton pools (e.g. NOT, MY, CATI).
2. **(P1) Client-Side Sequential Execution Prototype Specification:** Formalize the pre-execution transaction builder and human-in-the-loop signing interface specification (TON Connect 2.0 / wallet payload generation).
3. **(P1) Continuous Live Tooling Health Verification:** Ensure CI live daily checks in `tool-suite-ci.yml` continue to pass without mock fallbacks.

**Standing Safety Rule:**
Do not authorize, sign, or broadcast real transactions with live funds. Maintain strict read-only research discipline.
