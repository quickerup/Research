# TON DEX Arbitrage Terminal — Tool Suite Implementation & Offline Verification

**AGENT_ID:** TON-ARB-RESEARCH_16
**Date:** September 12, 2026
**Role:** Research Contribution #16 (Tool Implementation & Offline Builder)

---

## 0. Executive Summary & Context

Previous research contributions established key analytical foundations for the human-authorized TON DEX arbitrage terminal:
- **RESEARCH_14** verified live network endpoints, reproduced the +13.7% cross-DEX spread, root-caused DeDust's pool as the mispriced side (~$1.575/TON vs $1.38/TON market consensus), and refuted prior claims regarding the custom executor state by proving it is **`enabled=true`** via TVM bytecode trace in `@ton/sandbox`.
- **RESEARCH_15** defined modular tool specifications, input/output interfaces, CLI flags, and embedded mock fixtures for five research tools designed to transition the research process into structured, automated execution.

### Responsibilities Accomplished in RESEARCH_16:
As the offline builder (RESEARCH_16), this session implemented the complete TypeScript tool suite defined in RESEARCH_15 under `src/tools/` and created an offline verification test suite in `test/index.ts`. All tools support dual-mode execution (offline `--mock` mode with embedded fallback fixtures and online live mode with HTTP REST APIs).

---

## 1. Tool Suite Implementation Overview

Five CLI tools have been built in TypeScript and configured with `npm run` script entrypoints:

### 1. Tool 1: DeDust Pool Transaction & MEV/Arb History Analyzer
- **File:** `src/tools/dedust_pool_analyzer.ts`
- **Script:** `npm run dedust:analyze -- [--pool <ADDR>] [--limit <N>] [--mock] [--api-key <KEY>]`
- **Capabilities:**
  - Queries Toncenter API v2 `getTransactions` for pool transaction history.
  - Parses incoming and outgoing message payloads for swap operations.
  - Computes implied execution prices ($\text{USDT Units} / \text{TON Nanos}$).
  - Evaluates directional volume bias (TON→USDT vs USDT→TON) and price trends over time.

### 2. Tool 2: Dual-DEX Matched Quote & Arbitrage Simulator
- **File:** `src/tools/dual_dex_simulator.ts`
- **Script:** `npm run dex:simulate -- [--amounts 1,10,100] [--slippage 0.005] [--mock]`
- **Capabilities:**
  - Queries STON.fi (`POST /v1/swap/simulate` with URL query params) and DeDust (`POST /v2/routing/plan` with JSON body).
  - Simulates Path A (DeDust TON→USDT → STON.fi USDT→TON) and Path B (STON.fi TON→USDT → DeDust USDT→TON).
  - Calculates gross TON profit, gross ROI %, and net ROI % accounting for estimated transaction gas (~0.25 TON).

### 3. Tool 3: TVM Contract State & Get-Method Verifier
- **File:** `src/tools/executor_verifier.ts`
- **Script:** `npm run executor:verify -- [--address <ADDR>] [--mock]`
- **Capabilities:**
  - Deserializes the raw persistent data cell BOC of the custom executor contract using `@ton/core`.
  - Parses slice bits: `loadAddress()` (267 bits), `loadUint(8)` (`enabled`), `loadUint(16)` (`min_spread_bps`), `loadUint(64)` (`max_trade_nanos`), `loadUint(64)` (`gas_reserve_nanos`).
  - Verifies exact cell bit-length consumption (419 bits) and compares parsed values against local TVM execution traces in `@ton/sandbox`.

### 4. Tool 4: DEX API Latency & Jitter Benchmarker
- **File:** `src/tools/latency_benchmarker.ts`
- **Script:** `npm run latency:benchmark -- [--samples 30] [--delay-ms 200] [--mock]`
- **Capabilities:**
  - Benchmarks REST API endpoint response times using high-resolution timers (`performance.now()`).
  - Calculates p50, p90, p95, p99 percentiles, min, max, mean, and standard deviation.
  - Flags staleness alerts when response times exceed 1000ms.

### 5. Tool 5: Client-Side Pre-Flight Safety Gate
- **File:** `src/tools/preflight_safety_gate.ts`
- **Script:** `npm run safety:gate -- [--input quote_result.json] [--mock-case <CASE>]`
- **Capabilities:**
  - Evaluates pre-flight quotes against hard risk invariants.
  - Checks for excessive spread anomalies (>20%), minimum spread profitability (<1.5%), high price impact (>0.5%), trade size caps (>50 TON), and usage of unaudited custom executor contracts.
  - Returns fail-closed `STATUS: PASS` or `STATUS: FAIL [Reason]`.

---

## 2. Test Suite & Verification Results

An automated test suite was created in `test/index.ts` to verify tool execution in offline mode.

### Execution Output:
```
> ton-arb-research-tools@1.0.0 test
> tsc && node dist/test/index.js

====================================================
 Running Offline Test Suite for RESEARCH_16 Tools
====================================================

[PASS] dedust_pool_analyzer: offline mock parsing and trend analysis
[PASS] dual_dex_simulator: offline mock quote simulation across 1, 10, 100 TON
[PASS] executor_verifier: offline storage parsing & 419-bit exact match
[PASS] latency_benchmarker: offline percentile statistical calculations
[PASS] preflight_safety_gate: invariant check matrix (VALID, EXCESSIVE_SPREAD, HIGH_IMPACT, MAX_TRADE, UNAUDITED_EXECUTOR)

----------------------------------------------------
 Summary: 5 PASSED, 0 FAILED out of 5 tests.
----------------------------------------------------
```

All 5 tools passed offline verification without network access.

---

## 3. Handoff Instructions for TON-ARB-RESEARCH_17 (Online Executor)

TON-ARB-RESEARCH_17 has live network access to mainnet endpoints and will execute the tools built in this session to answer unresolved research questions.

### Recommended Handoff Steps:

1. **DeDust Pool Transaction Analysis (P0):**
   Run the analyzer against DeDust's TON/USD₮ pool (`EQA-X_yo3fzzbDbJ_0bzFWKqtRuZFIRa1sJsveZJ1YpViO3r`) to determine why the spread persists:
   ```bash
   npm run dedust:analyze -- --pool EQA-X_yo3fzzbDbJ_0bzFWKqtRuZFIRa1sJsveZJ1YpViO3r --limit 50
   ```
   Save the output and analyze whether trades are actively occurring, failing, or absent.

2. **Live Dual-DEX Simulation:**
   Run the matched quote simulator across 1, 10, and 100 TON trade sizes:
   ```bash
   npm run dex:simulate -- --amounts 1,10,100 --slippage 0.005
   ```

3. **Live Latency Benchmarking:**
   Benchmark response time percentiles (p50, p90, p95, p99) over 30 live samples:
   ```bash
   npm run latency:benchmark -- --samples 30 --delay-ms 200
   ```

4. **Live Executor Get-Method Verification:**
   Verify the live mainnet contract state of `EQBo5HJbBWZlOVuBpOPSiRNu18eHgq8XmoTbwdBlZpKflg3s`:
   ```bash
   npm run executor:verify -- --address EQBo5HJbBWZlOVuBpOPSiRNu18eHgq8XmoTbwdBlZpKflg3s
   ```

5. **Pre-Flight Safety Gate Run:**
   Pass the live simulation JSON output to the pre-flight safety gate:
   ```bash
   npm run safety:gate -- --input live_simulation.json
   ```

---

## 4. Priority Queue for TON-ARB-RESEARCH_17

1. **(P0) Investigate DeDust Pool Persistence:** Execute `dedust:analyze` on mainnet and analyze transaction history for pool `EQA-X_yo3fzzbDbJ_0bzFWKqtRuZFIRa1sJsveZJ1YpViO3r` to identify why the ~14% price discrepancy persists.
2. **(P0) Execute Live Dual-DEX Simulation:** Run `dex:simulate` to capture raw request/response artifacts for STON.fi and DeDust quotes.
3. **(P1) Gather Statistical Latency Benchmarks:** Execute `latency:benchmark` across 30+ samples to establish p50/p90/p95/p99 latency baselines.
4. **(P1) Document Raw Artifacts:** Record terminal logs and JSON outputs in `TON-ARB-RESEARCH_17.md` and update `README.md`.
