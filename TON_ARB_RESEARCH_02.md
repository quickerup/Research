# TON DEX Arbitrage Terminal — Research Contribution

AGENT_ID: TON-ARB-RESEARCH-02

**Research date:** September 12, 2026

## Contribution scope

This contribution focuses on four architectural questions that materially affect the design: (1) what should count as authoritative executable state, (2) how live DEX quoting should be obtained and validated, (3) what TON message/transaction semantics imply for atomicity and safety, and (4) how to structure the low-latency discovery-to-execution path.

## 1. Principal conclusions

### FACT / EVIDENCE — TON has distinct indexed, direct, and streaming access layers

TON Center API v2 is documented as the **non-indexed access layer** over TON nodes/liteservers and supports smart-contract get-method calls, fee estimation, and transaction submission. API v3 is the **indexed access layer**, built from indexed node data in PostgreSQL and intended for historical/analytical queries. The TON documentation also exposes Streaming API v2 over SSE and WebSocket for low-latency updates. [1][2][3]

**Architectural implication:** The terminal should not collapse all TON Center endpoints into one generic “market data” source. It should explicitly model at least:

- `DIRECT_CHAIN_READ`: state/get-method reads whose purpose is current contract state.
- `INDEXED_HISTORY`: high-throughput/historical discovery and analytics.
- `STREAM`: event-driven awareness and trigger/invalidation signals.
- `DEX_QUOTE`: DEX-specific simulation or executable-route construction.

This separation maps directly to the document’s distinction between “what happened?” and “what can I execute now?”.

### FACT / EVIDENCE — TON Streaming exposes speculative and finality-aware states

The current TON Streaming API defines `pending`, `confirmed`, and `finalized` states for trace-based events. `pending` represents speculative/emulated results and can be invalidated; `confirmed` means inclusion in a candidate shard block; `finalized` means committed in the masterchain and no longer subject to update/invalidation. The streaming service can deliver these transitions and also emits `trace_invalidated` for speculative trace data. [4][5]

**RECOMMENDATION:** Use `pending`/`confirmed` stream data as **change detection**, not as the final source of truth for a balance-critical or execution-critical decision. The system should re-read the affected contract state or obtain a fresh DEX simulation before authorization and again immediately before broadcast.

### FACT / EVIDENCE — STON.fi exposes explicit swap simulation and current pool/router state

STON.fi’s current REST API includes `POST /v1/swap/simulate`, which is explicitly described as a swap simulation that calculates expected output, fees, and gas costs. The API also exposes pool/market/router data, while the SDK is intended to wrap the underlying contracts. STON.fi additionally documents its pool-level trading fee model as configurable, with a current documented default of 0.3% total and an allowed 0–1% range; therefore, the scanner must not hard-code a universal fee rate. [6][7][8]

**RECOMMENDATION:** For STON.fi, make the API/SDK simulation layer the primary quote candidate, with on-chain pool/router reads used for freshness checks, safety verification, fallback calculation, and contradiction detection.

### FACT / EVIDENCE — STON.fi v2 exposes a contract-level minimum-output and deadline mechanism

STON.fi v2 Router swap payloads include a `min_out` amount, refund and excess addresses, and a `deadline` timestamp. The Router sends swaps into the appropriate Pool. The Pool exposes an off-chain `get_pool_data` method containing current reserves, pool lock state, token wallet addresses, and LP fee. [9][10]

**RECOMMENDATION:** The minimum-output requirement should be treated as a **hard execution invariant**, not as a UI-only slippage setting. A transaction should be constructed so the DEX/router itself refuses execution when the realized result is worse than the machine-approved minimum.

### FACT / EVIDENCE — DeDust exposes directly queryable reserve, fee, and swap-estimation state

DeDust Pool contracts document get-methods for `get_assets`, `get_reserves`, `is_stable`, `get_trade_fee`, and `estimate_swap_out`. `estimate_swap_out` returns the expected output and the fee charged in the input asset. DeDust also distinguishes volatile constant-product pools from stable-swap pools, with different curve mathematics. [11][12]

**RECOMMENDATION:** DeDust should be integrated through a DEX-native quote adapter that can either call the documented pool estimation method or use a protocol/SDK calculation path fed from the freshest pool state. The adapter must retain the pool type and fee parameters as part of the quote identity.

### FACT / EVIDENCE — A TON transaction grouping does not imply financial atomicity across multiple recipients/contracts

TON transactions record state changes for individual contracts. In TON Connect, multiple outgoing messages can be grouped into one signed external request, but the documentation explicitly states that execution is **not atomic** across recipients: individual destination contracts can fail or bounce independently. [13][14]

**REJECTED — “One wallet transaction means the arbitrage is atomic.”**

That assumption is unsafe. The relevant question is whether the **DEX/executor contract flow itself** makes the full intended round trip contingent on all legs succeeding and on the final output invariant being satisfied. A single signed external message containing two swap messages is not sufficient.

### FACT / EVIDENCE — TON wallet freshness and replay protection provide a hard outer execution window

TON wallet documentation describes `valid_until` as a Unix timestamp checked by the wallet, together with `seqno` equality, to bound message lifetime and prevent replay. TON Connect similarly requires a `validUntil` deadline in transaction requests, and wallets reject expired requests. [15][16]

**RECOMMENDATION:** The execution pipeline should maintain two separate freshness domains:

1. **economic freshness** — the quote/market-state validity window;
2. **cryptographic/message freshness** — the signed-message `valid_until` window.

The latter must never be used as a substitute for the former. A message can still be cryptographically valid while its economic assumptions are obsolete.

## 2. Revised architecture

The existing hypothesis is materially correct, but the boundary between discovery and execution should be strengthened:

```text
             ┌─────────────────────────────┐
             │ HISTORICAL / INDEXED DATA   │
             │ API v3, DEX APIs, datasets   │
             └──────────────┬──────────────┘
                            │ candidate hints
             ┌──────────────▼──────────────┐
             │ LOW-LATENCY EVENT SIGNALS   │
             │ Streaming pending/confirmed │
             │ pool/account/action changes │
             └──────────────┬──────────────┘
                            │ invalidation / trigger
             ┌──────────────▼──────────────┐
             │ LOCAL MARKET-STATE CACHE    │
             │ pool state + versions/LT    │
             │ token registry + metadata   │
             └──────────────┬──────────────┘
                            │ shortlist
             ┌──────────────▼──────────────┐
             │ DEX-SPECIFIC QUOTE ADAPTERS │
             │ STON simulation             │
             │ DeDust estimate_swap_out    │
             │ Other DEX-native quoters    │
             └──────────────┬──────────────┘
                            │ executable quote
             ┌──────────────▼──────────────┐
             │ ROUTE + SIZE OPTIMIZER      │
             │ exact-in / exact-out        │
             │ discrete size probes         │
             │ route-aware economics       │
             └──────────────┬──────────────┘
                            │ economic candidate
             ┌──────────────▼──────────────┐
             │ SAFETY / CONSISTENCY GATE   │
             │ state freshness             │
             │ route identity              │
             │ token allowlist              │
             │ min-out / deadline          │
             │ wallet/executor health      │
             │ unknown => reject            │
             └──────────────┬──────────────┘
                            │ pass
             ┌──────────────▼──────────────┐
             │ HUMAN AUTHORIZATION         │
             └──────────────┬──────────────┘
                            │ approve
             ┌──────────────▼──────────────┐
             │ FINAL REQUOTE / REVALIDATE  │
             │ immediately before send    │
             └──────────────┬──────────────┘
                            │ pass
             ┌──────────────▼──────────────┐
             │ BUILD + SIGN + BROADCAST    │
             │ shortest possible path      │
             └──────────────┬──────────────┘
                            │ tx/trace
             ┌──────────────▼──────────────┐
             │ STREAMED VERIFICATION       │
             │ pending → confirmed → final │
             └──────────────┬──────────────┘
                            │
             ┌──────────────▼──────────────┐
             │ P&L / TELEMETRY / CALIBRATE │
             └─────────────────────────────┘
```

The important architectural addition is a **market-state cache with explicit state identity**, rather than merely a time-based cache.

## 3. State identity should outrank quote age

### RECOMMENDATION

Represent every executable quote with a tuple similar to:

```text
quote_id
source
source_timestamp
received_timestamp
pool/router identifiers
pool state identity
state LT / block reference where available
route identity
input amount
output amount
fee components
estimated gas
simulation method/version
expiry policy
```

The system should invalidate a quote whenever any **relevant state identity** changes, even if the quote is only milliseconds old.

### FACT / EVIDENCE

TON’s low-level model supports block identifiers and proof-backed state retrieval, and `runSmcMethod` is described as a liteserver operation that executes against blockchain state. [17][18]

### HYPOTHESIS

For AMM arbitrage, a compact per-pool version such as `(last observed LT, reserve hash/state hash, router/pool code version)` may outperform pure TTL invalidation because a quote becomes invalid when the priced pool state changes, not simply when wall-clock time advances.

**MEASUREMENT NEEDED:** quantify the false-negative rate of TTL-only invalidation versus state-version invalidation under live trading activity.

## 4. Executable quote source hierarchy

### Tier A — DEX-native simulation / quoter

Preferred because it is closest to the protocol’s actual swap math and route semantics. STON.fi explicitly provides simulation; DeDust pool contracts explicitly provide `estimate_swap_out`. [6][11]

### Tier B — direct on-chain state + local exact math

Preferred fallback and independently useful as a cross-check. For constant-product pools, reserve-based pricing can be deterministic when the protocol’s exact fee treatment is known. For stable/weighted variants, the DEX-specific curve must be implemented exactly.

### Tier C — indexer / router API quote

Useful when it includes current routing and simulation, but should carry an explicit freshness/source-confidence field. API data is not automatically equivalent to canonical on-chain state.

### Tier D — historical realized swaps

Discovery only. Never execution-eligible without a fresh executable quote.

## 5. Important correction: “price impact” should not be separately subtracted when already embedded

A common implementation error is:

```text
quote output already reflects AMM curve + fee
                 ↓
subtract fee again
subtract price impact again
subtract slippage again
```

That can double-count economic costs.

### RECOMMENDATION

Store economics using distinct fields:

```text
quoted_output_raw
protocol_fee_embedded
explicit_router_fee
explicit_referral_fee
network_fee_estimate
forwarding_fee_estimate
price_impact_reference   # informational / risk metric
minimum_output            # execution guard
safety_buffer              # required extra economic headroom
```

Then calculate expected net from **incremental cash flows**, not from independent percentages that may overlap.

`slippage tolerance` is a protection parameter, not inherently an economic cost. It becomes an economic loss only to the extent the expected realized execution is below the ideal reference price.

## 6. Trade-size optimization recommendation

### RECOMMENDATION

Do not use continuous numerical optimization first. A practical initial optimizer should use a **coarse-to-fine discrete quote grid**:

```text
candidate sizes:
0.1x, 0.2x, 0.4x, 0.6x, 0.8x, 1.0x of a liquidity/capital-derived ceiling
                   ↓
retain locally profitable region
                   ↓
refine around best size with smaller increments
```

This has three advantages:

1. each point can be evaluated through the same authoritative quote adapter;
2. it works across heterogeneous DEX curve types without requiring analytic inversion;
3. it creates directly measurable latency/accuracy tradeoffs.

### HYPOTHESIS

For a single AMM-to-AMM round trip, net profit will usually be sufficiently smooth over the feasible interval that a small adaptive grid will locate the economically useful region without expensive global optimization.

**MEASUREMENT NEEDED:** benchmark quote count versus profit loss on live/historical replayed pool states. The objective is not the mathematically exact optimum; it is the best profit-size estimate within the human decision latency budget.

## 7. Human-in-the-loop latency: the dominant unknown may be decision latency, not RPC

TON documentation demonstrates that chain inclusion/finality can be rapid and that streaming reduces UI delay substantially versus polling. [19]

But a human authorization step introduces an unavoidable, strategy-specific `T1 - T0` interval that can exceed network and quote-computation latency by a large margin.

### RECOMMENDATION

The system should measure the full opportunity survival curve:

```text
opportunity detected
      ↓
quote valid
      ↓
human prompt displayed
      ↓
human approval
      ↓
final quote still profitable?
      ↓
broadcast
```

Telemetry should produce:

- survival probability after 0.5 s;
- survival after 1 s;
- survival after 2 s;
- survival after 5 s;
- survival after 10 s;
- expected-net distribution conditional on approval delay.

This determines whether optimizing a 50 ms quote path actually matters for the human-authorized product, or whether the binding constraint is operator reaction time.

### HYPOTHESIS

For a human-authorized system, the architecture should optimize for **rapid revalidation and robust opportunity presentation**, not merely minimum machine-only scan latency. A technically faster scanner that generates fragile alerts may perform worse than a slightly slower scanner with a high conversion rate from alert to executable trade.

## 8. Streaming should be treated as an invalidation bus

The strongest use of the TON Streaming API is not “replace all polling.” It is:

```text
stream event
   ↓
identify affected pools / routes
   ↓
invalidate cached quotes
   ↓
re-quote only affected candidates
```

This reduces unnecessary full-universe quote work.

### FACT / EVIDENCE

The Streaming API supports `transactions`, `actions`, `trace`, `account_state_change`, and `jettons_change`, and supports subscriptions over WebSocket or SSE. [4][5]

### RECOMMENDATION

Prefer WebSocket for the persistent scanner because TON documents it as the preferred streaming interface for persistent and bidirectional dynamic subscriptions; retain SSE as a simpler fallback. [5]

The scanner should maintain an explicit mapping:

```text
observed state event
→ affected account/pool/router
→ affected asset pair
→ affected route set
→ quote cache keys to invalidate
```

## 9. Failure policy refinement

### RECOMMENDATION

Use a three-valued state model internally:

```text
PASS
FAIL
UNKNOWN
```

Map external conditions into that model before deciding execution.

Examples:

| Condition | Internal state | Execution effect |
|---|---|---|
| Fresh direct pool state | PASS | eligible for downstream checks |
| Indexed quote only | UNKNOWN | discovery-only unless explicitly elevated |
| DEX API timeout | UNKNOWN | reject execution |
| State contradiction | UNKNOWN/FAIL | reject execution |
| Pool locked | FAIL | reject |
| min_out invariant satisfied in contract path | PASS | continue |
| Unknown token master | FAIL | reject |
| Executor contract version mismatch | FAIL | reject |
| Wallet seqno changed | FAIL | rebuild/revalidate |
| Quote age within TTL but relevant pool LT changed | FAIL | re-quote |
| Streaming disconnect with no fresh state | UNKNOWN | scanning may continue; execution blocked |

This preserves the earlier fail-closed principle but makes it implementable rather than merely conceptual.

## 10. Executor research status

The executor address recorded by earlier work must remain **untrusted until reverse-engineered and tested**. This contribution does not establish what that deployed contract does.

### RECOMMENDATION

Before any real-capital integration, inspect the executor using:

1. deployed code and data;
2. verified source, when available;
3. get-methods;
4. recent successful and failed traces;
5. upgrade/admin paths;
6. route encoding;
7. min-output enforcement;
8. failure/refund behavior;
9. multi-leg atomicity.

The research should prove an invariant such as:

```text
if final_output < approved_min_output:
    no economically harmful partial success may remain
```

or else explicitly document why that invariant cannot be guaranteed and redesign the execution strategy accordingly.

## 11. New test plan

### Benchmarks

Measure separately:

- indexed discovery latency;
- streaming event latency;
- direct get-method latency;
- STON simulation latency;
- DeDust estimate latency;
- multi-size quote batch latency;
- route selection latency;
- transaction-building latency;
- signing latency;
- broadcast acknowledgment latency;
- pending→confirmed→finalized observation latency.

### Replay harness

Build a deterministic replay runner that consumes real historical pool-state transitions and asks:

```text
At state S_t,
what would the current quote adapter have returned for size q?
Would the round trip have remained profitable after costs?
Would the opportunity have survived a simulated operator delay d?
```

Run delays across a distribution, not just fixed assumptions.

### Safety harness

For every supported DEX/route type, maintain fixtures covering:

- normal profitable trade;
- stale quote;
- pool state changed;
- pool locked;
- minimum output violated;
- token mismatch;
- insufficient balance;
- insufficient gas;
- route disappeared;
- contract version changed;
- bounced leg;
- partial downstream failure;
- successful round trip;
- ambiguous verification state.

## 12. Highest-value unresolved questions for the next agent

1. **Executor semantics:** Is the existing executor actually atomic across the desired two-leg route, and what exact failure/refund guarantees does it enforce?
2. **STON quote fidelity:** Does `POST /v1/swap/simulate` exactly represent all costs needed for a cross-DEX economic model, or are forwarding/referral/network components external to its output?
3. **DeDust route construction:** What exact contract-level swap parameters and output-protection semantics are available for production routing, and how do they differ among pool types?
4. **State identity:** Which LT/block/state identifiers can be used most cheaply to invalidate cached quotes without forcing a full fresh read of every pool?
5. **Opportunity survival:** For a human-authorized terminal, what fraction of positive-net candidates survives realistic operator delays?
6. **Self-hosting:** Does a dedicated liteserver/indexer deployment materially reduce quote and state-read tail latency enough to justify the operational burden?
7. **Cross-DEX atomicity:** Can the complete arbitrage be guaranteed inside one purpose-built executor contract, or should the product explicitly constrain itself to routes whose failure mode is economically bounded?

## Bottom-line architecture recommendation

The best practical architecture supported by current evidence is **event-driven, state-aware, DEX-native quoting with a hard fail-closed execution gate**:

- Use indexed APIs/history to discover and maintain the market universe.
- Use TON Streaming as a low-latency trigger and cache-invalidation mechanism.
- Maintain local normalized pool/router state with explicit state identity.
- Use DEX-native simulations/estimators as the primary executable quote layer.
- Reconcile quotes against direct chain state where material.
- Optimize size by adaptive quote grids rather than fixed notionals.
- Treat minimum-output/deadline protections as contract-level safety invariants.
- Require final re-quote after human approval.
- Never equate a fresh timestamp with fresh market state.
- Never equate a single TON transaction with atomic multi-leg financial execution.
- Record every stage transition so the system can empirically learn where opportunity value is lost.

The major architectural principle remains intact but is sharpened:

> **Discovery may be approximate; execution eligibility must be state-specific, route-specific, size-specific, cost-complete, and independently revalidated immediately before broadcast.**

## Sources

[1] TON Docs, “TON Center API v2 overview.” https://docs.ton.org/api/v2/overview

[2] TON Docs, “TON Center API v3 overview.” https://docs.ton.org/api/v3/overview

[3] TON Docs, “APIs overview.” https://docs.ton.org/api/overview

[4] TON Docs, “Streaming API: Server-Sent Events.” https://docs.ton.org/api/streaming/sse

[5] TON Docs, “Streaming API: WebSocket” and “Streaming API overview.” https://docs.ton.org/api/streaming/wss ; https://docs.ton.org/api/streaming/overview

[6] STON.fi, “API Reference.” https://docs.ston.fi/developer-section/dex/api/reference

[7] STON.fi, “Fees.” https://docs.ston.fi/developer-section/dex/fees

[8] STON.fi, “SDK / API repositories and documentation.” https://github.com/ston-fi/sdk ; https://github.com/ston-fi/api

[9] STON.fi, “Router (v2).” https://docs.ston.fi/developer-section/dex/smart-contracts/v2/router

[10] STON.fi, “Pool (v2).” https://docs.ston.fi/developer-section/dex/smart-contracts/v2/pool

[11] DeDust Docs, “Pool.” https://docs.dedust.io/reference/pool

[12] DeDust Docs, “Concepts” and “Swaps.” https://docs.dedust.io/docs/concepts ; https://docs.dedust.io/docs/swaps

[13] TON Docs, “@tonconnect/sdk reference.” https://docs.ton.org/applications/ton-connect/api-reference/sdk

[14] TON Docs, “Messages and transactions overview.” https://docs.ton.org/foundations/messages/overview

[15] TON Docs, “How TON wallets work.” https://docs.ton.org/contracts/standard/wallets/how-it-works

[16] TON Docs, “How to send a transaction with TON Connect.” https://docs.ton.org/applications/ton-connect/how-to/send-transaction

[17] TON Docs, “Get methods.” https://docs.ton.org/tvm/get-method

[18] TON Docs, “Liteserver proof verification.” https://docs.ton.org/foundations/proofs/verifying-liteserver-proofs

[19] TON Docs, “How to adopt sub-second finality.” https://docs.ton.org/subsecond
