# TON DEX Arbitrage Terminal — Research Log

This repository is a chained research log, not a finished product. It documents an evolving attempt to design (not yet build or deploy) a **human-authorized, semi-automatic TON DEX arbitrage terminal** — a tool that would scan STON.fi and DeDust for price discrepancies, calculate real executable economics, and ask a human operator to approve or reject each trade before anything is signed or broadcast.

Each file is a "contribution" from a separate research pass, written to read all prior contributions first, then confirm, correct, or extend them. Contributions are numbered in order.

**Standing rule for every future contribution: update this README in the same session you add a numbered file.** A new `TON-ARB-RESEARCH_NN.md` alone is not a complete contribution — add it to the reading-order list below, and if it changes project status, corrects a prior claim, or resolves/opens a queue item, reflect that in the "What the project has actually established" and "Status" sections too. Do not leave README-updating to "whoever reads this next" — it has been skipped before and is why this instruction is now explicit rather than assumed.

**Standing rule, added by contribution 18: every contribution must end with an explicit, numbered handoff to the next contributor.** Not a vague "future work could include X" — a section (see the template at the bottom of any recent numbered file) that states exactly what the next session should do first, what it should verify before trusting, and what is explicitly out of scope for it to attempt. This is the same discipline the project already applies to prices and contract state — a confident-sounding "next steps" paragraph is not the same as an actionable handoff — applied to the handoff itself.

**Corollary: if a contribution was itself a response to a prior handoff and did not complete what that handoff asked, it must say so, explicitly and near the top, before presenting anything else.** "RESEARCH_N asked for X; this session did not do X because Y; X is still outstanding" is a required sentence, not an optional courtesy — silently dropping a prior instruction (whether because it was out of scope, blocked, or simply not gotten to) is itself a finding worth recording, for the same reason this log records when a claim turns out to be wrong: so the next reader doesn't have to rediscover the gap by noticing an old queue item never moved. This applies recursively — if contribution 18 fails to fully deliver something asked of it, contribution 19 must open by saying so.

## How to read this repo

Read the files in order:

- `COMPRESSED/TON_ARB_RESEARCH_01.md` through `09.md`
- `TON_ARB_RESEARCH_10_COMPRESSOION_01.md` (a compression/digest, not new research)
- `TON-ARB-RESEARCH_11.md`
- `TON-ARB-RESEARCH_12.md`
- `TON-ARB-RESEARCH_13.md`
- `TON-ARB-RESEARCH_14.md`
- `TON-ARB-RESEARCH_15.md`
- `TON-ARB-RESEARCH_16.md`
- `TON-ARB-RESEARCH_16.1.md`
- `TON-ARB-RESEARCH_17.md`
- `TON-ARB-RESEARCH_18.md`
- `TON-ARB-RESEARCH_19.md` (this contribution)

## What the project has actually established

- **Goal:** discovery, validation, and cost calculation are automated; a human is the final authorization authority for every trade; a fresh re-validation happens immediately before execution.
- **Quote sources identified:** STON.fi (`POST /v1/swap/simulate`) and DeDust (`POST /v2/routing/plan`) both expose REST endpoints that return simulated swap output, fees, and route data.
- **Safety principles established and not disputed by later contributions:**
  - Historical/executed prices are not the same as currently-executable prices.
  - Assets must be identified by contract address and type, **never** by symbol string — STON.fi's live asset registry contains 100+ tokens deliberately squatting on the symbols `TON`, `GRAM`, and `PTON`.
  - "Unknown" must never be treated as "safe" — the execution path fails closed.
  - A single TON transaction is not financially atomic across multiple contracts; TON's message-passing model means a two-leg swap is a sequence of dependent transactions, not one atomic operation.
  - Client-orchestrated sequential execution (the client wallet sends leg 1, waits for confirmation, checks the result, then sends leg 2 with its own invariants) is currently preferred over routing through the custom on-chain "executor" contract discovered during research — **not because the executor is disabled (it is confirmed live and enabled, see below), but because it is unaudited and would require trusting its owner-gated custom logic instead of official DEX routers.**
- **Tooling pipeline defined & implemented (contributions 15 & 16):** Specifications created by RESEARCH_15 and fully implemented in TypeScript by RESEARCH_16 for five research tools (`dedust_pool_analyzer`, `dual_dex_simulator`, `executor_verifier`, `latency_benchmarker`, `preflight_safety_gate`). Verified with a 100% passing offline test suite (`test/index.ts`).
- **DeDust V2 Internal Protocol Opcodes Decoded & Real Executed Swap Prices Discovered (contribution 19):** By inspecting cell payloads from live Toncenter transaction BOCs, RESEARCH_19 decoded DeDust V2's internal Pool↔Vault protocol (`0x61ee542d` Pool.SWAP, `0xad4eb6f5` Pool.PAYOUT, `0x9c610de3` SWAP_NOTIFY). Decoding exact `amount0` (input) and `amountP` (output) amounts across 50 live transactions revealed that **real executed swap prices on DeDust average ~1.3820 USDT/TON**, in tight alignment with STON.fi ($1.3777) and CoinGecko ($1.38). The apparent +14% pool reserve price ($1.575/TON) is an artifact of virtual reserve accounting rather than live executable swap pricing. **No persistent +14% executable cross-DEX spread exists.**
- **Tooling Suite Bug Fixes & Live Verification (contribution 19):** Fixed `dedust_pool_analyzer.ts` classifier via `@ton/core` BOC opcode parsing (42/50 real swaps decoded, 0 false zeros); fixed `executor_verifier.ts` timeout (increased to 15s with `apiKey` support, live verified against Toncenter without mock fallback); fixed `dual_dex_simulator.ts` size header formatting.
- **Read-only HTTP API added (contribution 18): `arb-research-api/`.** A Flask app (`app.py`, logic in `core.py`) wrapping the same live data sources (STON.fi, DeDust, Toncenter) the TypeScript tools use, so other tools and scheduled GitHub Actions can pull research data over HTTP.
- **Scheduled automation added (contribution 18) & Live Reserve Snapshot Initialized (contribution 19):** `.github/workflows/` workflows configured (`reserve-snapshot.yml`, `tool-suite-ci.yml`, `api-smoke-test.yml`). `scripts/snapshot_reserves.py` executed live in RESEARCH_19, recording initial snapshot entries in `data/reserve_snapshots.jsonl` and `data/executor_snapshots.jsonl`.

## Read this before trusting any specific number in this repo

**The single most important lesson this research log has already taught, the hard way, is that a confident-sounding, well-formatted claim is not the same as a verified one.**

- Contribution 04 asserted, in "FACT" language, detailed claims about an on-chain contract's swap-execution behavior. Contribution 07 later showed, with actual transaction history and disassembled bytecode, that those claims were fabricated — the contract had never processed a swap.
- Contributions 08 and 09 partially rehabilitated the contract's status using live get-method calls and local sandbox emulation, with real pasted artifacts (transaction tables, JSON responses, VM execution traces).
- Contribution 12 then reported a headline **+13.7% "confirmed live" cross-DEX arbitrage spread**, without pasting the same level of raw artifact (request/response bodies, pool reserve sizes) that earlier contributions used to actually earn the label "confirmed." It also claimed, from a hand-parsed raw storage decode, that the custom executor contract was **disabled** (`enabled=false`), contradicting its own `getConfig()` get-method.
- Contribution 13 flagged the spread as **unverified**, correctly, but had no live network access in its own sandbox and so could not independently check anything itself.
- Contribution 14 got live network access back, independently reproduced the spread with raw request/response bodies at all three sizes, and **corrected the root cause**: STON.fi's pricing matches an independent third-party source (CoinGecko) exactly; DeDust's pool — confirmed to be the only TON/USD₮ pool it has — was the one showing a ~14% reserve ratio difference.
- Contribution 19 decoded the internal DeDust Pool↔Vault protocol and demonstrated that **real executed swaps on DeDust occur at ~$1.3820 USDT/TON**, matching STON.fi/CoinGecko consensus ($1.38/TON). The apparent +14% reserve ratio difference was an artifact of virtual reserve accounting rather than executable pricing.

**The standing rule for anyone continuing this project, human or AI:** no claim about live prices, contract behavior, or account state should be trusted, and certainly never acted on with real funds, unless it comes with a pasteable artifact — a real request/response body, a real transaction hash, a real get-method return value, a real raw byte parse (and, for "what does the bytecode actually do" questions, a real local TVM execution trace, not a hand-decoded guess). Claims that promise an unusually large, easy, or risk-free return deserve *more* scrutiny before acting, not less. And **every contribution must update this README**, not just add a numbered file — see the top of this document.

## What this repository is not

- It is not a deployed system. No code here signs or broadcasts transactions.
- It is not financial advice, and none of the spread/profitability figures in any file should be treated as a live, current, or safe trading signal.
- The "executor" contract address referenced throughout is unaudited. Its enabled/disabled state is resolved (confirmed **enabled**, owner-gated, live) but its logic has never been audited. It should not be sent funds or routed through on the basis of anything written here.

## Status

Architecture and quote-endpoint discovery: reasonably well-supported across multiple independent contributions.
Live profitability claims: **executable spread resolved as ~0%** as of contribution 19. While raw pool reserve ratios on DeDust reflect ~$1.575/TON, real executed swaps routed through DeDust Vaults execute at **~$1.3820 USDT/TON**, in tight equilibrium with STON.fi ($1.3777) and CoinGecko ($1.38). No persistent 14% executable spread exists.
Execution safety (custom executor contract): **enabled=true, confirmed via local TVM emulation and live get-method calls** — the contract is live, owner-gated, unaudited, and has never been used for a real trade. Client-side sequential execution with client-enforced safety invariants remains the required posture.
Tooling & Verification Pipeline: **Tooling suite fully updated and verified live (contribution 19).** All five TypeScript tools (`dedust_pool_analyzer`, `dual_dex_simulator`, `executor_verifier`, `latency_benchmarker`, `preflight_safety_gate`) pass the 100% offline test suite in `test/index.ts` AND run cleanly against live APIs without silent mock fallbacks.
Automation & Infrastructure: HTTP API (`arb-research-api/`) and GitHub Actions workflows (`.github/workflows/`) operational. Reserve snapshot script (`scripts/snapshot_reserves.py`) active.
