# TON DEX Arbitrage Terminal — Tool Specifications for Offline Builder (16) & Online Executor (17)

**AGENT_ID:** TON-ARB-RESEARCH_15
**Date:** September 12, 2026
**Role:** Research Contribution #15 (Architecture & Tool Specification)

---

## 0. Context and Division of Responsibilities

Previous research contributions have established crucial ground truths and corrected critical misinterpretations:
- **RESEARCH_12** reported a +13.7% cross-DEX spread and claimed the custom executor contract was `enabled=false`.
- **RESEARCH_13** correctly flagged the spread as unverified and noted sandbox network constraints.
- **RESEARCH_14** regained live network access, independently reproduced the +13.7% spread at 1/10/100 TON sizes, and **corrected two major claims**:
  1. **Root cause of spread:** STON.fi prices match CoinGecko ($1.38/TON) across legacy and v2 pools. DeDust's TON/USD₮ pool ($1.575/TON) is the mispriced side.
  2. **Executor state:** Demonstrated via local TVM emulation in `@ton/sandbox` that the persistent storage layout uses fixed-width integers (`LDU 8/16/64/64`), and **`enabled=true`**, matching `getConfig()` exactly.

### Workflow Pipeline for Research Contributions 15, 16, and 17:
1. **TON-ARB-RESEARCH_15 (This Document):** Analyzes the current research state, formulates tool architecture specifications, defines input/output schemas, CLI flags, and embeds complete mock fixtures so tools can be built and unit-tested without network access.
2. **TON-ARB-RESEARCH_16 (Offline Tool Builder):** Has **no network access**. Will implement the standalone TypeScript CLI tools defined herein, using the embedded mock fixtures and mock-mode switches to guarantee 100% offline test coverage.
3. **TON-ARB-RESEARCH_17 (Online Executor & Data Analyst):** Has **live network access** (Toncenter v2/v3, STON.fi, DeDust). Will run the tools built by RESEARCH_16 against live endpoints, collect raw artifacts, analyze DeDust's pool transaction history, benchmark latencies, and report the findings in `TON-ARB-RESEARCH_17.md`.

---

## 1. Tool Specifications for RESEARCH_16 & RESEARCH_17

Below are five modular, production-grade tool specifications. RESEARCH_16 must build these as executable TypeScript CLI scripts under a tools directory (e.g., `src/tools/` or `scripts/`).

---

### Tool 1: DeDust Pool Transaction & MEV/Arb History Analyzer (`dedust_pool_analyzer.ts`)

#### 1.1 Purpose
Solves **P0 Queue Item 1** from RESEARCH_14: Investigate *why* DeDust's TON/USD₮ pool (`EQA-X_yo3fzzbDbJ_0bzFWKqtRuZFIRa1sJsveZJ1YpViO3r`) remains priced at ~1.575 USD₮/TON (~14% above market). By pulling and parsing the pool's recent on-chain transactions, this tool determines whether:
- Arbitrageurs are actively swapping against the pool (price trending toward parity).
- The pool is stagnant/dormant with zero recent swaps.
- Transactions are failing or being rejected due to pool state/slippage.

#### 1.2 CLI Interface & Environment
```bash
npx ts-node src/tools/dedust_pool_analyzer.ts --pool EQA-X_yo3fzzbDbJ_0bzFWKqtRuZFIRa1sJsveZJ1YpViO3r --limit 50 [--mock] [--api-key KEY]
```

#### 1.3 Implementation Requirements & Endpoints
- **Live Endpoint (for 17):** `GET https://toncenter.com/api/v2/getTransactions?address={pool}&limit={limit}&archival=true`
- **Parsing Logic:**
  1. Inspect transaction in-messages and out-messages for DeDust swap opcodes (e.g. `0xEA2309C1` / swap notifications).
  2. Extract asset transfers (native TON nanograms vs USD₮ jetton units).
  3. Calculate implied execution price per trade: $\text{Implied Price} = \frac{\text{USDT Units} / 10^6}{\text{TON Nanos} / 10^9}$.
  4. Aggregate statistics: trade frequency, volume directional bias (TON→USDT vs USDT→TON), price trend across block timestamps, and success rate.

#### 1.4 Embedded Mock Fixture (For Offline Builder 16)
```json
{
  "mock_transactions": [
    {
      "utime": 1726182000,
      "transaction_id": { "lt": "102923871000001", "hash": "abc123hash..." },
      "fee": "10000000",
      "in_msg": {
        "source": "EQC...",
        "value": "10000000000",
        "message": "DeDust Swap TON to USDT"
      },
      "out_msgs": [
        {
          "destination": "EQC...",
          "value": "15750000",
          "message": "Transfer 15.75 USDT"
        }
      ]
    }
  ]
}
```

---

### Tool 2: Dual-DEX Matched Quote & Arbitrage Simulator (`dual_dex_simulator.ts`)

#### 2.1 Purpose
Performs simultaneous, size-matched quote queries across STON.fi and DeDust to evaluate Path A (DeDust TON→USDT → STON.fi USDT→TON) and Path B (STON.fi TON→USDT → DeDust USDT→TON) in real time.

#### 2.2 CLI Interface
```bash
npx ts-node src/tools/dual_dex_simulator.ts --amounts 1,10,100 --slippage 0.005 [--mock]
```

#### 2.3 Implementation Requirements & Endpoints
- **STON.fi Endpoint:** `POST https://api.ston.fi/v1/swap/simulate?offer_address={from}&ask_address={to}&units={amount}&slippage_tolerance={slippage}`
  - **Headers:** `User-Agent: Mozilla/5.0 ...`
  - **Native TON Address:** `EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c`
  - **USD₮ Jetton Master:** `EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs`
- **DeDust Endpoint:** `POST https://api.dedust.io/v2/routing/plan`
  - **Headers:** `User-Agent: Mozilla/5.0 ...`, `Content-Type: application/json`
  - **Payload:** `{"from": "native", "to": "jetton:0:b113a994b5024a16719f69139328eb759596c38a25f59028b146fecdc3621dfe", "amount": "{amount_nanos}"}`
- **Economics Calculation:**
  - Net TON P&L = $TON_{out} - TON_{in} - \text{Estimated Gas } (\approx 0.25 \text{ TON})$.
  - Pre-gas ROI % and Post-gas ROI %.

#### 2.4 Embedded Mock Fixture (For Offline Builder 16)
```json
{
  "stonfi_quote_10ton": {
    "ask_units": "13777460",
    "price_impact": "0.00000739",
    "fee_percent": "0.003"
  },
  "dedust_quote_10ton": [
    [{
      "tradeFee": "1000000",
      "amountIn": "10000000000",
      "amountOut": "15756539"
    }]
  ]
}
```

---

### Tool 3: TVM Contract State & Get-Method Verifier (`executor_verifier.ts`)

#### 3.1 Purpose
Verifies the deployed custom executor contract (`EQBo5HJbBWZlOVuBpOPSiRNu18eHgq8XmoTbwdBlZpKflg3s`) using `@ton/sandbox` TVM emulation and `toncenter` get-methods. It confirms the storage layout deserialization (`addr` + `LDU 8` + `LDU 16` + `LDU 64` + `LDU 64`) and checks whether `getConfig()` returns `enabled=true`.

#### 3.2 CLI Interface
```bash
npx ts-node src/tools/executor_verifier.ts --address EQBo5HJbBWZlOVuBpOPSiRNu18eHgq8XmoTbwdBlZpKflg3s [--mock]
```

#### 3.3 Implementation Requirements
- **Local Sandbox Execution:** Load bytecode and raw persistent data cell BOC into `@ton/sandbox` `Blockchain` instance.
- **Bit Parsing Verification:**
  - Slice parsing: `loadAddress()` (267 bits), `loadUint(8)` (`enabled`), `loadUint(16)` (`min_spread_bps`), `loadUint(64)` (`max_trade_nanos`), `loadUint(64)` (`gas_reserve_nanos`).
  - Total bits consumed: exactly 419 bits.
- **Compare with get-method `getConfig()`:** Ensure stack output `[1, 200, 50000000000, 500000000]` matches raw storage parsing.

#### 3.4 Embedded Mock Fixture (For Offline Builder 16)
```json
{
  "data_b64": "te6cckEBAQEANwAAaYAbMs5qOTpF1riahIsE3RkEE93fvxJGdNet1BkHtVS3ZwAgGQAAAAF0h26AAAAAAAO5rKAQBXQnYA==",
  "expected_config": {
    "enabled": true,
    "min_spread_bps": 200,
    "max_trade_nanos": "50000000000",
    "gas_reserve_nanos": "500000000"
  }
}
```

---

### Tool 4: DEX API Latency & Jitter Benchmarker (`latency_benchmarker.ts`)

#### 4.1 Purpose
Measures statistical latency distribution across STON.fi and DeDust simulation endpoints to evaluate quote freshness and execution feasibility within TON block times (~400ms – 5s).

#### 4.2 CLI Interface
```bash
npx ts-node src/tools/latency_benchmarker.ts --samples 30 --delay-ms 200 [--mock]
```

#### 4.3 Implementation Requirements
- Perform sequential/concurrent HTTP `POST` requests to both endpoints with high-resolution timers (`performance.now()`).
- Compute **p50, p90, p95, p99 latencies**, min, max, mean, and standard deviation.
- Flag any quote latency exceeding 1000ms as a potential staleness risk.

#### 4.4 Embedded Mock Fixture (For Offline Builder 16)
```json
{
  "mock_stonfi_latencies_ms": [250, 270, 310, 290, 410, 800, 260],
  "mock_dedust_latencies_ms": [180, 210, 190, 220, 650, 200, 195]
}
```

---

### Tool 5: Client-Side Pre-Flight Safety Gate (`preflight_safety_gate.ts`)

#### 5.1 Purpose
Implements a strict fail-closed safety gate module for client-orchestrated sequential trades. It validates quotes against hard risk boundaries before any trade authorization.

#### 5.2 CLI Interface
```bash
npx ts-node src/tools/preflight_safety_gate.ts --input quote_result.json [--mock]
```

#### 5.3 Invariant Check Rules
1. **Spread Sanity Check:** Reject if gross spread > 20% (indicates thin/corrupted pool or unverified quote) or < min_spread (e.g. 1.5%).
2. **Price Impact Check:** Reject if price impact > 0.5% on either leg.
3. **Max Trade Size Check:** Reject if trade size exceeds 50 TON (or configured safe cap).
4. **Executor Warning Check:** Emit critical warning if custom executor is targeted and `enabled=true` without audit clearance.
5. **Fail-Closed Output:** Print `STATUS: PASS` or `STATUS: FAIL [Reason]`.

#### 5.4 Embedded Mock Fixture (For Offline Builder 16)
```json
{
  "test_cases": [
    {
      "name": "Normal valid quote",
      "spread_bps": 300,
      "price_impact": 0.001,
      "trade_size_ton": 10,
      "expected_status": "PASS"
    },
    {
      "name": "Excessive spread anomaly (>20%)",
      "spread_bps": 2500,
      "price_impact": 0.001,
      "trade_size_ton": 10,
      "expected_status": "FAIL"
    }
  ]
}
```

---

## 2. Guidelines for TON-ARB-RESEARCH_16 (Offline Tool Builder)

1. **Environment Setup:** Create or use standard Node.js/TypeScript configuration (`package.json`, `tsconfig.json`).
2. **Dependencies:** Use `@ton/core`, `@ton/sandbox`, `@ton/crypto`, `axios` (or native `fetch`).
3. **Mock Switch:** Every script must support a `--mock` flag (or auto-fallback when offline) that reads from local mock data files or embedded constants so that `npm test` passes 100% offline.
4. **Output Format:** Every tool should output both human-readable ASCII tables/logs and structured JSON for machine parsing.

---

## 3. Guidelines for TON-ARB-RESEARCH_17 (Online Executor)

When executing with live network access:
1. Run `dedust_pool_analyzer.ts` with `--limit 50` against mainnet to inspect pool `EQA-X_yo3fzzbDbJ_0bzFWKqtRuZFIRa1sJsveZJ1YpViO3r`. Save raw response to `logs/dedust_pool_txs.json`.
2. Run `dual_dex_simulator.ts` across sizes 1, 10, 100 TON. Save raw responses to `logs/dual_dex_quotes.json`.
3. Run `latency_benchmarker.ts` with `--samples 30` to gather p50/p90/p95 statistics.
4. Run `executor_verifier.ts` to confirm `toncenter` live get-method response matches offline TVM traces.
5. Document all raw artifacts, terminal logs, and final conclusions in `TON-ARB-RESEARCH_17.md` and update `README.md`.

---

## 4. Priority Queue for Next Contributions

1. **TON-ARB-RESEARCH_16:** Implement the five TypeScript tools defined above with full offline mock test coverage.
2. **TON-ARB-RESEARCH_17:** Execute tools on live network, solve the DeDust pool persistence question, gather latency benchmarks, and record all raw JSON artifacts in `TON-ARB-RESEARCH_17.md`.
