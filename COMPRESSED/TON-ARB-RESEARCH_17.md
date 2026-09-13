# TON DEX Arbitrage Terminal — Live Execution: Pool Activity, Reserve Drift & Tool-Suite Bug Report

**AGENT_ID:** TON-ARB-RESEARCH_17
**Date:** September 12–13, 2026
**Role:** Research Contribution #17 (Online Executor & Data Analyst)

---

## 0. Model & Environment Disclosure

Per the process RESEARCH_16.1 proposed, and because it's true and harmless to state: this session runs on **Sonnet 5** (model id `claude-sonnet-5`, Anthropic), not Claude 3.7 Sonnet. One correction to how that proposal is applied going forward: a markdown file in this repo asserting something is "mandatory" doesn't bind a future session's behavior — it's a prior contribution's proposal, not an instruction from the user running this project. I'm disclosing my own model because it's accurate and there's no reason not to, but I'm not treating 16.1's claim that *its own* session ran on Claude 3.7 Sonnet as verified — that's a prior agent's self-report, and nothing in this repo cross-checks it. Likewise, 16.1's "hallucination profiles map to model family" framing is speculative; the two confirmed bad claims in this log (contribution 04's fabricated executor behavior, contribution 12's wrong storage decode) were never actually attributed to a specific model, so there's no evidence in this project that model family predicts failure mode. Treat model-disclosure lines the same as any other claim in this repo: informative, not load-bearing.

**Environment state this session:** Live network access to `toncenter.com`, `api.dedust.io`, and `api.ston.fi` confirmed empirically (real TLS certs, live block seqno matching wall-clock time, multi-MB real payloads — not just 200-status checks). `node_modules` was absent at session start (confirmed not persisted, per [[ton_arb_verification_discipline]]) and reinstalled via `npm install`. `npm run build` and `npm test` both pass cleanly (5/5 offline tests), confirming RESEARCH_16's tool suite is intact before live use.

---

## 1. Headline Finding: The Tool Suite's "0 Swaps" Result Was a Parser Bug, Not a Real Signal — the Pool Is Extremely Active

Running the handoff's first command exactly as specified:

```
$ node dist/src/tools/dedust_pool_analyzer.js --pool EQA-X_yo3fzzbDbJ_0bzFWKqtRuZFIRa1sJsveZJ1YpViO3r --limit 50 --api-key $TONCENTER_API_KEY

Parsed Transactions: 50
Identified Swaps: 0 (TON->USDT: 0, USDT->TON: 0)
Average Implied Price: N/A
Price Trend: INSUFFICIENT_DATA
```

This looked like it might mean the pool is dormant. It doesn't. **Root cause, found by reading `src/tools/dedust_pool_analyzer.ts`:** the classifier does `inMsg.message.toLowerCase().includes('ton to usdt')` — a string match against literal English text that exists *only* in RESEARCH_15's embedded mock fixture (`"message": "DeDust Swap TON to USDT"`). Real Toncenter `getTransactions` responses never contain that field as human text; `in_msg.message` on real data is a partial base64/text preview of the BOC body (e.g. `"Ye5ULQAAC0wAAAAAQDKKuggA8YiYYaYdKBSBE70HxqUgltE5YlfyleI7T2+y6YS8joRQjlXUJEA=\n"`), so the string match never fires. The tool's numeric fallback heuristic (`inValue > 1 TON && outValue < 1 TON`, or vice versa) also never fires here because real trade sizes on this pool are consistently **well under 1 TON per leg** (~0.09–0.2 TON) — a threshold the heuristic never anticipated. Both branches silently fall through to `UNKNOWN`. This is the same class of failure the project has hit before (RESEARCH-07's disassembler false negative): a tool built and tested only against a hand-written mock breaks silently on the real data shape.

**What real data actually shows**, pulling the raw `getTransactions` response directly and checking timestamps:

```
count: 50
newest: 2026-09-12 23:57:47 UTC
oldest: 2026-09-12 23:37:09 UTC
span_seconds: 1238  (20.6 minutes)
most_recent_age_seconds: 162  (~2.7 minutes before this query)
```

50 transactions in 20.6 minutes ≈ **one transaction roughly every 25 seconds, sustained**, with the most recent one only ~2.7 minutes old at query time. This directly falsifies the "possibly dormant" reading the broken tool output invited. The pool is under continuous, active load.

---

## 2. What the Traffic Actually Is: Two Confirmed `dedust_vault` Contracts, Cycling TON

Decoding the real message bodies (not just the misleading `message` text field) with `@ton/core`:

```
Opcode frequency across 50 real transactions:
  0x61ee542d (inbound to pool):      48
  0x72aca8aa (inbound to pool):       2
  OUT 0x9c610de3 (value 0, dest ""): 40
  OUT 0xad4eb6f5 (value = real TON): 39
  OUT 0x72aca8aa:                    11
```

`0x61ee542d`, `0x9c610de3`, and `0xad4eb6f5` are **not** in `@dedust/sdk@0.8.7`'s public opcode list (confirmed by downloading the real package and grepping its compiled JS — the SDK only exposes user-facing opcodes like `VaultNative.SWAP = 0xea06185d` and `VaultJetton.SWAP = 0xe3a0d482`). These are internal Pool↔Vault protocol messages that DeDust doesn't publish in its client SDK.

The two addresses this traffic cycles between were confirmed, not guessed, via Toncenter v3's `accountStates` interface detection:

| Address | Balance | Detected interface |
|---|---|---|
| `EQDa4VOnTYlLvDJ0gZjNYm5PXfSmmtL6Vs6A_CZEtXCNICq_` | 1,872,347.5 TON | `dedust_vault` |
| `EQAYqo4u7VF0fa4DPAebk4g9lBytj2VFny7pzXR0trjtXQaO` | 0.38 TON | `dedust_vault` |

Both are genuine DeDust Vault contracts, not wallets or bot spam — so this is real protocol traffic, just not decodable with the public SDK. Every sampled transaction shows TON flowing pool→vault and vault→pool in near-equal amounts minus a small cut each hop (e.g. one hop: 149,413,851 nanoTON in → 148,028,070 nanoTON out, ≈0.93% taken). **Open question, explicitly not resolved this session:** whether this constitutes genuine cross-asset TON↔USDT swap flow (with the USDT leg settled elsewhere and invisible to this pool's own transaction list) or some other same-asset internal mechanism — I could not find the internal wire format in any public source, and hand-guessing it from opcode bytes alone is exactly the failure mode [[ton_arb_verification_discipline]] warns against. Flagging as real, unresolved, and worth a `@ton/sandbox` trace of the pool's actual bytecode in a future session, rather than asserting an answer.

---

## 3. Answering P0: Why the ~14% Spread Persists — New Evidence, Not Just "No Activity"

RESEARCH_14 measured this pool's reserves at commit time `2026-09-12 23:16:14 UTC`. This session re-measured the same pool via DeDust's own `/v2/pools` endpoint ~41 minutes later:

| | RESEARCH_14 (23:16 UTC) | RESEARCH_17 (23:57 UTC, Δ≈41 min) | Δ |
|---|---|---|---|
| TON reserve | 201,787.21 | 201,542.55 | **−244.66 TON (−0.121%)** |
| USDT reserve | 317,820.98 | 318,209.30 | **+388.32 USDT (+0.122%)** |
| Implied price | $1.57503/TON | $1.57887/TON | **+0.244%** (moved *away* from the $1.38 market consensus) |
| Constant-product `k` | 64,132,209,072 | 64,132,714,622 | +0.00079% (small, fee-consistent growth — real swap fees are accruing) |

This is the key finding: **the pool is not idle, and real fee-generating swap volume is flowing through it (`k` growth confirms genuine trades, not just internal noise) — but the net direction over this window pushed the price further from parity, not toward it.** A profit-seeking arbitrageur selling TON into this overpriced pool would decrease the TON reserve's price by *adding* TON and *removing* USDT — the opposite of what was observed. What was observed (TON reserve down, USDT reserve up) is consistent with someone paying the inflated $1.575+ rate to receive TON, which is a losing trade in isolation.

**Working hypothesis, explicitly labeled as unconfirmed:** this pool may be receiving naive or structural order flow — e.g. an integration that doesn't route through DeDust's better-priced pools (if it has any for this pair; RESEARCH_14 confirmed this is DeDust's *only* native TON/USD₮ pool) or is one leg of a longer triangular route where the loss here is funded by a gain elsewhere — rather than flow from arbitrageurs correcting the price. This is not proven; it is the most consistent explanation of the measured direction and magnitude, and the honest next step is a longer observation window (hours, not 41 minutes) plus decoding the internal protocol from §2 to see the actual counterparties and amounts of each hop.

**One data point does not confirm a trend** — a 41-minute, single-pair-of-snapshots comparison is suggestive, not conclusive. Flagging this explicitly rather than overclaiming: the direction (away from parity) and magnitude (~0.24%) are real, measured, and reproducible from two independently-sourced snapshots, but a longer time series is needed before treating "the spread is being actively widened" as established.

---

## 4. Executor Contract: Live Re-Verification, Unchanged

`executor_verifier.ts`'s 5000ms axios timeout is too short for a full contract-data fetch over live network — it silently fell back to mock every time it was run this session (the printed "LIVE" output was actually replayed mock data identical to RESEARCH_14's numbers). Bypassing the tool and calling the get-method directly:

```
$ curl -s toncenter.com/api/v2/runGetMethod -d '{"address":"EQBo5HJbBWZlOVuBpOPSiRNu18eHgq8XmoTbwdBlZpKflg3s","method":"getConfig","stack":[]}'

stack: [0x1, 0xc8, 0xba43b7400, 0x1dcd6500]
  → enabled=true, min_spread_bps=200, max_trade_nanos=50,000,000,000 (50 TON), gas_reserve_nanos=500,000,000 (0.5 TON)
block seqno: 92343642
last_transaction_id.lt: "102923871000003"  (unchanged from RESEARCH_12/14 — no new activity on this contract)
```

**Unchanged from RESEARCH_14**, live-confirmed independently of the buggy tool: still enabled, still owner-gated, still unaudited, and — per the stale `last_transaction_id.lt` — **still never actually used to process a real trade.** No new information here beyond confirming nothing has changed; still not recommended for use.

---

## 5. Dual-DEX Simulator: Mostly Live, One Silent Mock Fallback

```
$ node dist/src/tools/dual_dex_simulator.js --amounts 1,10,100 --slippage 0.005

[WARN] Network query for 1 TON failed (Request failed with status code 502). Falling back to mock data.

--- Size: 1 TON ---   [MOCK — see warning above; numbers are recycled RESEARCH_14 values]
Path A: +0.137119 TON gross (13.712%) | Net (−0.25 gas): −0.112881 TON (−11.288%)
Path B: −0.127399 TON gross (−12.740%) | Net: −0.377399 TON (−37.740%)

--- Size: 10 TON ---  [LIVE]
Path A: +1.363807 TON gross (13.638%) | Net: +1.113807 TON (11.138%)
Path B: −1.250583 TON gross (−12.506%) | Net: −1.500583 TON (−15.006%)

--- Size: 100 TON --- [LIVE]
Path A: +13.581058 TON gross (13.581%) | Net: +13.331058 TON (13.331%)
Path B: −12.544177 TON gross (−12.544%) | Net: −12.794177 TON (−12.794%)
```

The 1 TON size's underlying API call 502'd and fell back to mock — **its numbers are not live and should not be read as a fresh reading**; they happen to exactly match RESEARCH_14's numbers because RESEARCH_15's mock fixture was seeded from RESEARCH_14's real output. The 10 and 100 TON rows are genuinely live (distinct, realistic slippage-curve numbers). Path A (DeDust TON→USDT, then STON.fi USDT→TON) remains the only profitable direction after estimated gas, consistent with every prior session, and still nobody has authorized or attempted an actual trade. Minor cosmetic bug noted for the queue: the per-block header always prints "1 TON Quote" regardless of the actual size being shown.

---

## 6. Latency Benchmark: Fully Live, 30 Samples Each

```
$ node dist/src/tools/latency_benchmarker.js --samples 30 --delay-ms 200

STON.fi: min 142.79ms | mean 339.36ms | max 1692.53ms | p50 203.79ms | p90 559.99ms | p95 762.70ms | p99 1692.53ms | staleness alerts (>1000ms): 1
DeDust:  min 140.61ms | mean 322.99ms | max 1160.26ms | p50 180.48ms | p90 619.54ms | p95 1064.80ms | p99 1160.26ms | staleness alerts (>1000ms): 3
```

No warnings printed, so this ran fully live end to end. Both venues' typical (p50/p90) quote latency is comfortably inside TON's ~400ms–5s block time, but tail latency (p95+) on DeDust in particular (3/30 samples over 1000ms) means a naive "quote once, execute later" flow risks acting on a stale quote often enough to matter for a two-leg, non-atomic execution path — reinforces the existing standing rule to re-validate immediately before executing, not just at discovery time.

---

## 7. Safety Gate: Tested Against a Real Live-Derived Quote

Built an input from this session's own live 100 TON simulation (spread 1358bps, estimated ~0.01% price impact per leg, trade size 100 TON) and ran it through the gate:

```
$ node dist/src/tools/preflight_safety_gate.js --input live_quote_100ton.json

STATUS: FAIL
Rejection Reasons:
  [REJECT] Trade size of 100 TON exceeds maximum safe cap of 50 TON.
```

Correctly fail-closed on real, live-shaped numbers — confirms the gate's core invariant logic works, not just against RESEARCH_15's embedded test cases.

---

## 8. Priority Queue for TON-ARB-RESEARCH_18

1. **(P0) Decode the internal DeDust Pool↔Vault protocol.** Opcodes `0x61ee542d`, `0x9c610de3`, `0xad4eb6f5` (§2) drive the vast majority of this pool's live traffic and aren't in the public SDK. Plant the pool's real code+data into `@ton/sandbox` and trace a live transaction to determine, empirically, whether these are genuine cross-asset swaps or something else — do not guess from opcode bytes alone.
2. **(P0) Extend the reserve-drift observation window.** §3's finding (price moved further from parity over 41 minutes) is real but short. Take snapshots of this pool's reserves every 15–30 minutes over several hours to build a real time series before treating "actively widening" as established rather than noise.
3. **(P1) Fix `dedust_pool_analyzer.ts`'s classifier.** Currently 100% non-functional on real data (§1) — string-matches mock-only text and has a ≥1 TON-per-leg threshold heuristic that misses this pool's actual (sub-1-TON) trade sizes. Fix should wait on item 1, since a correct fix needs the real opcode semantics, not another guess.
4. **(P1) Fix `executor_verifier.ts`'s 5000ms timeout.** It silently and consistently falls back to mock on live contract-data fetches (§4), which risks a future session mistaking mock output for a fresh live check — exactly the kind of unverified-claim risk this project has been burned by before.
5. **(P2) Cosmetic:** `dual_dex_simulator.ts`'s per-block header always prints "1 TON Quote" (§5) regardless of actual size.
6. **Standing rule, restated:** nothing in this session's findings is a green light to trade. No agent should send a real, funded transaction against the executor or attempt live sequential execution until item 1 is answered — a spread with genuine (not dormant) trading activity flowing in the *wrong* direction is, if anything, a reason for more caution, not less.
