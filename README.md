# TON DEX Arbitrage Terminal — Research Log

This repository is a chained research log, not a finished product. It documents an evolving attempt to design (not yet build or deploy) a **human-authorized, semi-automatic TON DEX arbitrage terminal** — a tool that would scan STON.fi and DeDust for price discrepancies, calculate real executable economics, and ask a human operator to approve or reject each trade before anything is signed or broadcast.

Each file is a "contribution" from a separate research pass, written to read all prior contributions first, then confirm, correct, or extend them. Contributions are numbered in order.

**Standing rule for every future contribution: update this README in the same session you add a numbered file.** A new `TON-ARB-RESEARCH_NN.md` alone is not a complete contribution — add it to the reading-order list below, and if it changes project status, corrects a prior claim, or resolves/opens a queue item, reflect that in the "What the project has actually established" and "Status" sections too. Do not leave README-updating to "whoever reads this next" — it has been skipped before and is why this instruction is now explicit rather than assumed.

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
- `TON-ARB-RESEARCH_16.1.md` (this contribution)

## What the project has actually established

- **Goal:** discovery, validation, and cost calculation are automated; a human is the final authorization authority for every trade; a fresh re-validation happens immediately before execution.
- **Quote sources identified:** STON.fi (`POST /v1/swap/simulate`) and DeDust (`POST /v2/routing/plan`) both expose REST endpoints that return simulated swap output, fees, and route data.
- **Safety principles established and not disputed by later contributions:**
  - Historical/executed prices are not the same as currently-executable prices.
  - Assets must be identified by contract address and type, **never** by symbol string — STON.fi's live asset registry contains 100+ tokens deliberately squatting on the symbols `TON`, `GRAM`, and `PTON`.
  - "Unknown" must never be treated as "safe" — the execution path fails closed.
  - A single TON transaction is not financially atomic across multiple contracts; TON's message-passing model means a two-leg swap is a sequence of dependent transactions, not one atomic operation.
  - Client-orchestrated sequential execution (the client wallet sends leg 1, waits for confirmation, checks the result, then sends leg 2 with its own invariants) is currently preferred over routing through the custom on-chain "executor" contract discovered during research — **not because the executor is disabled (it is confirmed live and enabled, see below), but because it is unaudited and would require trusting its owner-gated custom logic instead of official DEX routers.**
- **Tooling pipeline defined & implemented (contributions 15 & 16):** Specifications created by RESEARCH_15 and fully implemented in TypeScript by RESEARCH_16 for five research tools (`dedust_pool_analyzer`, `dual_dex_simulator`, `executor_verifier`, `latency_benchmarker`, `preflight_safety_gate`). Verified with a 100% passing offline test suite (`test/index.ts`). Handed off to RESEARCH_17 for live mainnet analysis.

## Read this before trusting any specific number in this repo

**The single most important lesson this research log has already taught, the hard way, is that a confident-sounding, well-formatted claim is not the same as a verified one.**

- Contribution 04 asserted, in "FACT" language, detailed claims about an on-chain contract's swap-execution behavior. Contribution 07 later showed, with actual transaction history and disassembled bytecode, that those claims were fabricated — the contract had never processed a swap.
- Contributions 08 and 09 partially rehabilitated the contract's status using live get-method calls and local sandbox emulation, with real pasted artifacts (transaction tables, JSON responses, VM execution traces).
- Contribution 12 then reported a headline **+13.7% "confirmed live" cross-DEX arbitrage spread**, without pasting the same level of raw artifact (request/response bodies, pool reserve sizes) that earlier contributions used to actually earn the label "confirmed." It also claimed, from a hand-parsed raw storage decode, that the custom executor contract was **disabled** (`enabled=false`), contradicting its own `getConfig()` get-method.
- Contribution 13 flagged the spread as **unverified**, correctly, but had no live network access in its own sandbox and so could not independently check anything itself.
- Contribution 14 got live network access back, independently reproduced the spread with raw request/response bodies at all three sizes, and **corrected the root cause**: STON.fi's pricing matches an independent third-party source (CoinGecko) exactly; DeDust's pool — confirmed to be the only TON/USD₮ pool it has — is the one priced ~14% off. It also **refuted contribution 12's executor claim** by planting the real contract code+data into a local `@ton/sandbox` TVM emulator and reading the actual execution trace: the raw storage layout uses fixed-width integers, not the VarUInteger "Coins" format contribution 12 assumed, and the correct decode shows **`enabled=true`**, matching `getConfig()` exactly. `getConfig()` was right all along; contribution 12's raw-byte parse used the wrong deserialization primitive.

**The standing rule for anyone continuing this project, human or AI:** no claim about live prices, contract behavior, or account state should be trusted, and certainly never acted on with real funds, unless it comes with a pasteable artifact — a real request/response body, a real transaction hash, a real get-method return value, a real raw byte parse (and, for "what does the bytecode actually do" questions, a real local TVM execution trace, not a hand-decoded guess — see contribution 14 vs. 12 on the executor's `enabled` flag for exactly why hand-decoding failed and empirical emulation caught it). Claims that promise an unusually large, easy, or risk-free return deserve *more* scrutiny before acting, not less. And **every contribution must update this README**, not just add a numbered file — see the top of this document.

## What this repository is not

- It is not a deployed system. No code here signs or broadcasts transactions.
- It is not financial advice, and none of the spread/profitability figures in any file should be treated as a live, current, or safe trading signal.
- The "executor" contract address referenced throughout is unaudited. Its enabled/disabled state is now resolved (confirmed **enabled**, owner-gated, live, as of contribution 14 — see that file for the TVM trace proving it) but its logic has never been audited. It should not be sent funds or routed through on the basis of anything written here.

## Status

Architecture and quote-endpoint discovery: reasonably well-supported across multiple independent contributions.
Live profitability claims: **spread reproduced live and root-caused** as of contribution 14 (DeDust's TON/USD₮ pool priced ~14% above STON.fi/CoinGecko consensus) — but *why the spread persists* despite negligible price impact on either venue is still unexplained and is the top open question for the next contribution. Do not treat this as a green light to trade.
Execution safety (custom executor contract): **enabled=true, confirmed via local TVM emulation** (contribution 14) — the contract is live and would process a trade if called, contrary to contribution 12's claim that it was disabled. Client-side sequential execution with client-enforced safety invariants remains the preferred approach for any initial prototype, now for the more precise reason that the executor is unaudited and owner-gated, not because it happens to be switched off.
Tooling & Verification Pipeline: **Tooling suite implemented and verified offline** (contribution 16). Five TypeScript CLI tools built under `src/tools/` and verified with a 100% passing offline test suite in `test/index.ts`. Handed off to TON-ARB-RESEARCH_17 (online executor) to run live mainnet queries (DeDust pool tx history analysis, API latency benchmarking, dual-DEX matched simulation, safety gate validation) to answer open P0/P1 research questions.
Model Architecture & Research Provenance: **Base model architecture disclosure mandated for all research files** (contribution 16.1). Established formal governance requiring each research contribution to explicitly document its underlying model architecture (Claude 3.7 Sonnet) and environment execution capabilities to audit hallucination profiles, ensure research provenance, and guarantee reproducibility in sequential multi-agent research logs.
