# TON DEX Arbitrage Terminal — Research Log

This repository is a chained research log, not a finished product. It documents an evolving attempt to design (not yet build or deploy) a **human-authorized, semi-automatic TON DEX arbitrage terminal** — a tool that would scan STON.fi and DeDust for price discrepancies, calculate real executable economics, and ask a human operator to approve or reject each trade before anything is signed or broadcast.

Each file is a "contribution" from a separate research pass, written to read all prior contributions first, then confirm, correct, or extend them. Contributions are numbered in order.

## How to read this repo

Read the files in order:

- `COMPRESSED/TON_ARB_RESEARCH_01.md` through `09.md`
- `TON_ARB_RESEARCH_10_COMPRESSOION_01.md` (a compression/digest, not new research)
- `TON-ARB-RESEARCH_11.md`
- `TON-ARB-RESEARCH_12.md`
- `TON-ARB-RESEARCH_13.md` (this contribution)

## What the project has actually established

- **Goal:** discovery, validation, and cost calculation are automated; a human is the final authorization authority for every trade; a fresh re-validation happens immediately before execution.
- **Quote sources identified:** STON.fi (`POST /v1/swap/simulate`) and DeDust (`POST /v2/routing/plan`) both expose REST endpoints that return simulated swap output, fees, and route data.
- **Safety principles established and not disputed by later contributions:**
  - Historical/executed prices are not the same as currently-executable prices.
  - Assets must be identified by contract address and type, **never** by symbol string — STON.fi's live asset registry contains 100+ tokens deliberately squatting on the symbols `TON`, `GRAM`, and `PTON`.
  - "Unknown" must never be treated as "safe" — the execution path fails closed.
  - A single TON transaction is not financially atomic across multiple contracts; TON's message-passing model means a two-leg swap is a sequence of dependent transactions, not one atomic operation.
  - Client-orchestrated sequential execution (the client wallet sends leg 1, waits for confirmation, checks the result, then sends leg 2 with its own invariants) is currently preferred over routing through the custom on-chain "executor" contract discovered during research, because the executor's real behavior, ownership, and enabled/disabled state have not been consistently or verifiably established across contributions.

## Read this before trusting any specific number in this repo

**The single most important lesson this research log has already taught, the hard way, is that a confident-sounding, well-formatted claim is not the same as a verified one.**

- Contribution 04 asserted, in "FACT" language, detailed claims about an on-chain contract's swap-execution behavior. Contribution 07 later showed, with actual transaction history and disassembled bytecode, that those claims were fabricated — the contract had never processed a swap.
- Contributions 08 and 09 partially rehabilitated the contract's status using live get-method calls and local sandbox emulation, with real pasted artifacts (transaction tables, JSON responses, VM execution traces).
- Contribution 12 then reported a headline **+13.7% "confirmed live" cross-DEX arbitrage spread**, without pasting the same level of raw artifact (request/response bodies, pool reserve sizes) that earlier contributions used to actually earn the label "confirmed."
- Contribution 13 flags that result as **unverified**: a double-digit-percent spread that stays constant across 1/10/100 TON trade sizes is not how competitive, liquid markets behave, and is more consistent with a thin or distorted pool than a genuine standing opportunity. It has not been independently reproduced.

**The standing rule for anyone continuing this project, human or AI:** no claim about live prices, contract behavior, or account state should be trusted, and certainly never acted on with real funds, unless it comes with a pasteable artifact — a real request/response body, a real transaction hash, a real get-method return value, a real raw byte parse — not just a confident description of one. Claims that promise an unusually large, easy, or risk-free return deserve *more* scrutiny before acting, not less.

## What this repository is not

- It is not a deployed system. No code here signs or broadcasts transactions.
- It is not financial advice, and none of the spread/profitability figures in any file should be treated as a live, current, or safe trading signal.
- The "executor" contract address referenced throughout is unaudited and its current enabled/disabled state and ownership are disputed between contributions. It should not be sent funds or routed through on the basis of anything written here.

## Status

Architecture and quote-endpoint discovery: reasonably well-supported across multiple independent contributions.
Live profitability claims (contribution 12): unverified, pending independent reproduction (see contribution 13).
Execution safety (custom executor contract): unresolved; client-side sequential execution with client-enforced safety invariants is the currently preferred approach for any initial prototype.
