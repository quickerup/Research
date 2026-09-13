# TON DEX Arbitrage Terminal — Compressed Research Digest

**AGENT_ID: TON_ARB_RESEARCH_10_COMPRESSOION_01**
**Compiled:** September 12, 2026
**Role of this document:** This is a *compression* pass, not a research contribution. It distills `TON_ARB_RESEARCH_01.md` through `TON_ARB_RESEARCH_09.md` (now archived in `COMPRESSED/`) into one current-state reference. Where the nine source files contain a chain of claim → correction → re-correction, this document states **only the final, most-recently-verified status** of each question, with a short note on how it got there. Full blow-by-blow reasoning, citations, and superseded claims remain in the archived originals — consult them if you need the historical trail, not this file.

---

## 1. What this project is

A research effort (not yet an implementation) to design a **human-authorized, semi-automatic TON blockchain DEX arbitrage terminal** (STON.fi ⇄ DeDust cross-pool spreads). Target workflow: the system continuously scans, finds the best currently-executable opportunity, computes full round-trip economics (fees, gas, slippage, safety margin), presents it to a human operator, requires explicit approval, re-validates immediately before broadcast, executes, verifies, and records the outcome. The machine never executes autonomously; the human is always the final authorizer. A large historical spread must never be presented as if it were a currently-executable price — "what happened" and "what can I execute now" are treated as different questions throughout.

Each session is invoked as a numbered agent (`TON_ARB_RESEARCH_NN`) that reads prior files and appends one new one. **Working discipline established late in the chain (RESEARCH-06 onward), now considered mandatory:** don't restate a hypothesis as FACT without a pasteable artifact (transaction hash, get-method output, VM trace). Two agents (RESEARCH-03, EXECUTION-04) violated this and produced confidently wrong conclusions that took three later agents to unwind.

---

## 2. Current ground truth, by subsystem

### 2.1 Executor contract — `EQBo5HJbBWZlOVuBpOPSiRNu18eHgq8XmoTbwdBlZpKflg3s`

**Status as of RESEARCH-09 (most current, empirically verified):**

- **Deployed and configured, real, non-trivial code.** Not placeholder/tutorial code (that was RESEARCH-07's conclusion; it was wrong).
- `getConfig()` (camelCase — method ID `93770`, present in the contract's advertised method table) is live and returns a sane 4-tuple: `enabled=true`, `min_spread_bps=200` (2.00%), `max_trade_nanos=50,000,000,000` (50 TON), `gas_reserve_nanos=500,000,000` (0.5 TON). Verified via direct `runGetMethod` call, `exit_code: 0`.
- **Lifetime transaction history is exactly 2 transactions, both from the same source address (presumed deployer/operator), both empty message bodies, both zero outgoing messages.** One is the deploy tx; the other is a 29 TON deposit. **No swap has ever been executed by this contract.** This finding (RESEARCH-07) is unchallenged by any later agent.
- The `recv_internal` dispatch has a **5-way top-level opcode switch**: `0x11223344`, `0x99887766`, `0xAABBCCDD`, `0xDEADBEEF`, and `0x7362D09C` (this fifth one was misidentified by RESEARCH-07/08 as absent; `0x55667788`, which RESEARCH-07/08 thought was a 6th sibling, is actually a second-level constant nested *inside* one of the other branches, not a top-level key).
- **Empirically confirmed via local `@ton/sandbox` TVM emulation of the real live code+data** (zero mainnet risk — see §4): the four non-`0x7362D09C` branches each end in a genuine `SDEQ` (slice-equal) comparison between the message sender's address and an owner/admin address stored in the contract's persistent data cell, followed by `THROWIFNOT 401`. Sending any of the four from an unauthorized address correctly throws exit code 401. Two of the four branches also unpack the same config tuple `getConfig()` returns, mid-handler, before the auth check — i.e., they read live policy, not stub values. The fifth (`0x7362D09C`) branch's first instructions are `SWAP; LDGRAMS` — it tries to parse a variable-length nanoTON amount from the message body (exit code 9, cell underflow, when tested with no payload — consistent with a real amount parameter, not a stub).
- **Conclusion: this is a real, owner-gated, partially-built executor that has never been operationally exercised.** Its dispatch logic is authentic and access-controlled, not fake — but what each authorized handler actually *does* once past the owner check is still unverified (blocked on static disassembly limitations, see §4).
- **The owner/admin address itself has not been identified or disclosed.** It can be read from the persistent data cell informationally (no signing required), but **no authorized/signed call should ever be constructed or sent without the user explicitly confirming they hold that key and want it exercised** — this is a hard boundary per project scope (see §5), not a research question.
- **Design decision still not made by any agent:** build/finish a custom conditional-sequencing executor (this contract, once its handlers are understood) vs. orchestrate both swap legs client-side as ordinary sequential wallet-signed messages directly against STON.fi's/DeDust's own router contracts, with all safety invariants (min-out, deadline, balance recheck) enforced client-side instead of on-chain. This is the single most consequential open architectural choice in the project.

**Why trust this over earlier claims in the chain:** EXECUTION-04 claimed (with no artifact) that the executor was fully reverse-engineered and "atomicity" was "locked." RESEARCH-06 correctly identified this had zero evidence behind it and downgraded it to hypothesis. RESEARCH-07 then got live tool access, ran real queries, and concluded the opposite extreme — "no executor exists, likely tutorial code" — but this was itself a false negative caused by testing only snake_case get-method names (`get_config`) when the real script uses camelCase (`getConfig`). RESEARCH-08 caught and fixed that specific gap. RESEARCH-09 then closed the remaining question (are the swap-dispatch branches real or dead code) using local sandbox emulation instead of static disassembly, after confirming static disassembly is unreliable for this contract (see §4). RESEARCH-09's account is the current, best-evidenced state.

### 2.2 STON.fi quote path

- **Live quote endpoint:** `POST /v1/swap/simulate` at host `api.ston.fi` (note: docs live at `docs.ston.fi`, API calls go to `api.ston.fi` — a distinction worth being precise about in client code). Returns expected output, fees, and a `gasParams` structure (`gasBudget`, `forwardGas`, `estimatedGasConsumption`). Confirmed via direct fetch (RESEARCH-06).
- **Fee model:** pool-level trading fee is configurable per-pool, documented default 0.3% total, allowed range 0–1%. Do not hard-code a universal fee rate.
- **v2 Router/Pool contracts:** swap payloads carry `min_out`, refund/excess addresses, and `deadline`. `get_pool_data` exposes reserves, lock state, token wallets, LP fee — usable for freshness/cross-checks against the API quote.
- **Native-asset/jetton identity — P0 safety rule (RESEARCH-07, confirmed live):** STON.fi's live `/v1/assets` registry shows the native asset's actual symbol field is now `"GRAM"` (not `"TON"`) with `kind: "Ton"`, `default_symbol: true`, canonical address `EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c`. **At least 111 other jetton entries in the same live registry squat on the symbols `TON`, `GRAM`, or `PTON`/`*TON`/`*GRAM` variants** (some clearly named to impersonate, e.g. `"display_name": "GRAM to the MOON"`). **Rule: never identify the native asset or any jetton by symbol/display_name string. Match natives on `kind == "Ton"` (or the canonical pseudo-address), and match any jetton on exact `contract_address` against a human-curated allowlist.** This is not hypothetical — it's the majority condition in live production data.
- **Item resolved and closed, do not re-open without new evidence (RESEARCH-08):** the existing prototype dashboard (`ton_arb_dashboard.d/pipeline.jq` / `render.jq`) was audited directly and does **not** have this vulnerability — all grouping/pricing keys are jetton master-contract addresses (or `null` for native), never symbol strings; `symbol` is used only for a display-label fallback in `render.jq`, after all pricing/ranking decisions are already made.
- **Symmetric-rigor gap flagged but not yet done (RESEARCH-09):** DeDust's quote path has now been live-tested and cross-checked against its own SDK source with real numbers (see 2.2 below); STON.fi's quote path has not been put through the same live-test-plus-source-cross-check rigor. Worth doing before trusting both sides of a spread calculation equally.

### 2.3 DeDust quote path

- **Resolved after three failed attempts (RESEARCH-06, 07, 08 all failed; RESEARCH-09 succeeded).** The correct, live, verified endpoint for pairwise swap quoting is:
  ```
  POST https://api.dedust.io/v2/routing/plan
  Body: {"from": "native" | "jetton:<workchain>:<hex_hash>", "to": <same shape>, "amount": "<string, nanounits>"}
  ```
  This is a **legacy API v2 namespace** endpoint (not the "Router v2" *product*-named `/v4/router/quote` three prior agents incorrectly assumed and chased — that path is real, observed live in DeDust's own frontend calls per a community Rust client's README, but its host/wire contract is still unconfirmed).
- **Live-verified twice on 2026-09-12**, including a real 1 TON → USD₮ quote against a genuinely liquid pool (~201,782 TON / ~317,826 USD₮ reserves): returned `amountOut: 1,573,509` raw units (≈1.5735 USD₮/TON) with `tradeFee: 1,000,000` nanoTON (0.1%), matching that pool's own documented fee — an internal consistency check that passed.
- **Separate, distinct host for pool discovery:** `https://mainnet.api.dedust.io/v4/api/<method-name>` (e.g. `/get_pools_allclassic`) — a different subdomain (`mainnet.api.dedust.io`, not `api.dedust.io`) using method-name-as-path calls. Confirmed live, returns real pool data.
- **What's still open, narrowly:** the newer UI-only `/v4/router/quote` aggregator's exact host/wire contract (possibly does multi-hop/split routing differently from the single-pool `/v2/routing/plan` result). Not needed for the project's current pairwise cross-DEX gap analysis — don't re-litigate this as blocking.
- The official `dedust-io/sdk` GitHub repo was fully grepped and **confirmed to contain no quote/router REST method at all** (only `getAccountAssets`, `getPools`, `getPoolTrades`, plus on-chain contract wrapper classes) — stop looking there for this.
- `MAINNET_API_URL = 'https://api.dedust.io'` is confirmed correct in SDK source (`src/constants.ts`); the earlier guessed full path (`/v1/router/quote`) was simply wrong.

### 2.4 TON chain-level facts (stable, unlikely to need re-verification soon)

- **Sub-second finality is live:** ~400ms block time (down from ~2.5s), ~1s finality (down from ~10s), via Catchain 2.0, effective April 9, 2026. Streaming API v2 delivers `pending`/`confirmed`/`finalized`/`trace_invalidated` events at 30–100ms latency. Confirmed via direct fetch of `docs.ton.org`, cross-checked twice (RESEARCH-03, RESEARCH-06) — solid.
- **No cross-contract atomicity by default.** A TON transaction is a state change for exactly one account processing exactly one message; a multi-leg operation is a *trace* of many independent transactions, each of which can bounce/fail independently. "One signed external message" ≠ "atomic financial operation." An executor contract can *approximate* atomicity only via its own conditional-sequencing logic (receive leg 1 output → check min-out → only then send leg 2 → refund/bounce on failure) — this is a design pattern to implement correctly, not a guarantee TON gives for free.
- **Bounce/refund is not guaranteed just because the contract intends one.** A bounce message is only generated if the original message had the bounce flag set *and* there's enough remaining `msg_value` after gas/forward-fee consumption to pay for it. If not, no bounce fires — but the shortfall isn't destroyed, it's absorbed into the **receiving contract's own balance** (confirmed against TON docs' own worked numeric example). **Actionable consequence:** before any execution, compute a worst-case gas buffer for the failure path so a refund is always affordable; and as a cheap, complementary leak-detection signal, monitor the executor's own on-chain balance before/after every attempt — an unexplained upward drift beyond expected dust is direct evidence a leg failed without a matching refund, faster than proving it via decompilation.
- **MEV/front-running risk is structurally lower than EVM** (no public mempool, async messaging, validators have limited reordering power) but not zero. Model it in the opportunity-ranking function as a **competition probability** (chance another bot captures the opportunity before human approval + broadcast completes), not as a direct cost line like on Ethereum. No empirical bot-census has been done yet (still queued).
- **TON's native currency was renamed Toncoin → Gram (GRAM) effective June 15, 2026** (community vote, 81.22% support, reviving the original 2018 whitepaper name). Asset-only rename — network name "The Open Network (TON)" is unchanged, balances/addresses/positions carry over 1:1, no migration needed. The low-level TL-B type was already called `Grams` in TON's protocol source pre-rename, so ABI/wire-format compatibility isn't affected — but **display strings, symbol fields, and UI literals across this whole research corpus (RESEARCH-01 through EXECUTION-04) hardcode "TON" and must not**; treat the native-asset display symbol as a runtime-configurable value sourced from whatever the live quote API returns, never a literal in code or prompts. See §2.2 for the related, more severe symbol-collision safety rule this rename exposed.
- **Gas is fully deterministic**, not merely "estimated with a safety margin." Compute fees follow a published closed-form formula (flat rate up to a limit, then linear); forward fees are a lump price plus per-cell/per-bit charges on serialized message size, both from published, governance-controlled network config. Both STON.fi's `gasParams` and DeDust's `network_fee` field surface computed values directly. Reserve only a small buffer for data-dependent branches inside the executor's own compute phase, not for network-level uncertainty.

---

## 3. Architecture (current best hypothesis, materially unchanged in shape since RESEARCH-02, refined in detail since)

```text
HISTORICAL / INDEXED DATA  (TON Center v3, DEX APIs — discovery only, never execution-eligible)
        ↓ candidate hints
LOW-LATENCY EVENT SIGNALS  (TON Streaming API v2, 30–100ms; pending/confirmed/finalized)
        ↓ invalidation / trigger — used as a cache-invalidation bus, not a source of truth
LOCAL MARKET-STATE CACHE   (pool state keyed by state identity — LT/state-hash, not wall-clock TTL)
        ↓ shortlist
DEX-NATIVE QUOTE ADAPTERS  (STON.fi POST /v1/swap/simulate @ api.ston.fi
                             DeDust   POST /v2/routing/plan @ api.dedust.io)
        ↓ two executable quotes
SPREAD EVALUATION + SIZE OPTIMIZATION + FULL COST MODEL
   (adaptive discrete quote grid for size; incremental-cashflow accounting — never
    double-subtract a fee/slippage already embedded in a quote's output)
        ↓ economic candidate
SAFETY / CONSISTENCY GATE
   - state freshness (state-identity match, not just quote age)
   - route identity, token identity (contract-address/kind matching ONLY — never symbol strings)
   - executor semantics — PARTIALLY VERIFIED (see §2.1); do not assume atomicity beyond what's proven
   - min-out as a hard, contract-enforced invariant, not a UI setting
   - worst-case failure-path gas buffer (guarantee refund affordability)
   - executor balance-drift monitoring (leak detection)
   - unknown => reject (fail closed; "unknown" is never treated as "safe")
        ↓ pass
HUMAN AUTHORIZATION  (Live-Streaming Prompt — see below, not a static y/N prompt)
        ↓ approve
FINAL RE-QUOTE / REVALIDATE, both legs, immediately before send
        ↓ pass
BUILD + SIGN + BROADCAST
        ↓ tx/trace
STREAMED VERIFICATION (pending → confirmed → finalized)
        ↓
P&L / TELEMETRY / CALIBRATION → back to scanning
```

**Key refinements worth preserving explicitly:**

- **Quotes should be invalidated on state-identity change, not merely time-to-live.** A tuple like `(pool state LT/hash, route identity, simulation method/version)` catches staleness a pure TTL would miss, and avoids false invalidation of a quote whose priced state hasn't actually moved.
- **Don't double-count costs.** Store `quoted_output_raw`, `protocol_fee_embedded`, `explicit_router_fee`, `network_fee_estimate`, `price_impact_reference` (informational), `minimum_output` (execution guard), and `safety_buffer` as distinct fields, then derive net profit from incremental cash flows — not from independently-estimated percentages that may already overlap inside the quote.
- **Trade-size optimization:** use a coarse-to-fine discrete quote grid (e.g. 0.1x/0.2x/0.4x/0.6x/0.8x/1.0x of a liquidity-derived ceiling, then refine around the best point) rather than continuous numerical optimization first. Works across heterogeneous AMM curve types without needing an analytic inverse, and its cost is directly measurable against the human decision-latency budget.
- **The static CLI "Execute this trade? [y/N]" prompt from RESEARCH-01 is likely inadequate on a 400ms-block chain.** A ~1.5–3.0s human reaction time spans ~4–7 blocks; a quote frozen at prompt-display time is likely stale by the time of approval. RESEARCH-05's proposed fix — a "Live-Streaming Prompt" that keeps re-polling both DEX quotes in the background (~500ms cadence) while armed, auto-aborts with a "CANDIDATE DECAYED" warning if net profit goes negative before approval, and uses the freshest background quote (rather than a separately-fetched "final requote") as the actual `min_out` basis at the moment of approval — is a reasonable design response to this, though it has not been benchmarked or implemented. Requests to both DEX quote APIs must be issued concurrently, not sequentially (sequential ~150–300ms-each calls can consume most of a block time in network I/O alone).
- **Failure/condition model:** use a three-valued internal state (`PASS` / `FAIL` / `UNKNOWN`), and always map external ambiguity (API timeout, source disagreement, disconnect with no fresh state) to `UNKNOWN → execution blocked`, never to an implicit pass.

---

## 4. Verification methodology established in this project (durable, reusable)

Two hard-won methods, both preserved in long-term memory ([[ton-arb-verification-discipline]]) and restated here for completeness:

1. **Static TVM disassembly is unreliable for this project's contracts.** Two independently-maintained JS disassemblers (`tvm-disassembler`, `@scaleton/tvm-disassembler`) both fail on the same real opcode (`0xFA48`-prefixed, standard message-parsing boilerplate) in the executor's code — one fails loudly, the other silently loops emitting undecoded garbage (confirmed with an added watchdog). **Hand-decoding raw opcode bytes from memory to route around a disassembler failure is exactly what produced RESEARCH-07's confidently-wrong "no executor exists" conclusion. Do not do this.**
2. **Preferred method: empirical testing via `@ton/sandbox` local TVM emulation.** Fetch a contract's real code+data+balance via `toncenter` (`getAddressInformation`), then in a scratch Node project (`npm install @ton/core @ton/sandbox`): `createShardAccount({address, code, data, balance})` + `blockchain.setShardAccount()` plants the **real live contract** into a fully local, offline emulator. Send synthetic internal messages, read `tx.description.computePhase.exitCode` and `tx.vmLogs` (set `blockchain.verbosity = {vmLogs: 'vm_logs_full', print: false}` for full traces without console spam). This is a local fork/replay of already-public on-chain state — no signing, no broadcast, no funds at risk. **Reach for this before trusting disassembler output or reasoning from memory of TVM opcode semantics, for any "what does this contract's code actually do" question in this project.** Caveat: `node_modules` are not persisted between sessions — reinstall each time.

A third, smaller lesson: **when guessing an external service's REST API host/path, prefer reading a community open-source API client's actual source/README over pattern-matching a product name.** Three agents wasted effort assuming DeDust's "Router v2" product name implied a `/v2/router/...` or `/v4/router/...` URL path; the real working endpoint was found only by reading a third-party Rust client's README, and turned out to live under an unrelated legacy `/v2/routing/plan` namespace.

---

## 5. Scope boundary (unchanged, load-bearing)

This project is **research and analysis only**: read-only chain queries, reading local scripts, web/SDK lookups, and local sandbox emulation of already-public state. **No deploying contracts, signing transactions, or moving funds.** The `.env` API key present is read-only. If a future research step would require constructing or sending an authorized/signed call (e.g., to test the executor's owner-gated handlers with real authorization), or any other fund-moving/deploying action, **that is a decision point to surface to the user explicitly** — never to execute merely because a prior agent's queue listed it as "the next step." This applies even to actions that would otherwise be zero-risk (e.g., a sandbox-only test) if they would require possessing or using real key material.

---

## 6. Current priority research queue (carried forward from RESEARCH-09, unresolved as of this compression)

1. Re-run the live cross-DEX gap analysis (the project's original goal since RESEARCH-02) using the now-confirmed `POST https://api.dedust.io/v2/routing/plan` for DeDust and STON.fi's `/v1/swap/simulate` for the other leg, at matched timestamps and a specific trade size.
2. Apply the same live-test-plus-source-cross-check rigor to STON.fi's quote path that was just applied to DeDust's — determine whether it deserves equal confidence.
3. Read (informationally only — no signing) the executor's stored owner/admin address from its persistent data cell, to establish whether it's a known/expected address. Do not construct or send an authorized call without the user explicitly confirming key custody and intent (see §5).
4. Static disassembly of the executor's post-authorization logic (what each of the five real handlers does once the owner check passes) remains blocked on the `0xFA48` disassembler-tooling gap (§4). A sandbox test using a message actually signed by the real owner would be the fastest unblock, contingent on item 3.
5. Decide the still-open design question: finish/audit the existing partially-built executor vs. client-orchestrated sequential swaps with client-side safety invariants. RESEARCH-09's finding (real, access-controlled, config-aware handlers) makes "finish the existing contract" a somewhat more credible option than earlier agents believed, contingent entirely on item 3.
6. Still untouched since RESEARCH-02/03: STON.fi-vs-DeDust quote-latency benchmarking (p50/p95/p99), streaming-API lag measurement against a specific pool, and a competition/MEV-bot census (24–72h monitoring of external messages to both DEXes' routers).
7. **Closed, do not re-open without new evidence:** the prototype dashboard's symbol-matching safety (audited safe, RESEARCH-08, §2.2 above).

---

## 7. Index of archived source material

The full, unabridged research chain (all reasoning, every superseded claim, every citation) is preserved in `COMPRESSED/`:

| File | Agent | One-line contribution |
|---|---|---|
| `TON_ARB_RESEARCH_01.md` | RESEARCH-01 | Founding brief: goals, workflow, prototype dashboard description, architecture hypothesis, research taxonomy (FACT/EVIDENCE/HYPOTHESIS/etc.) |
| `TON_ARB_RESEARCH_02.md` | RESEARCH-02 | TON API layering, STON.fi/DeDust quote+safety mechanisms (cited), atomicity rejection, state-identity concept, cost double-counting warning |
| `TON_ARB_RESEARCH_03.md` | RESEARCH-03 | DeDust hosted quote API claim (later corrected), executor urgency flagged, 400ms/sub-second finality confirmed, gas determinism, MEV structural analysis |
| `TON_ARB_RESEARCH_04.md` | EXECUTION-04 | Claimed executor "reverse-engineered" with no artifact — **later falsified by RESEARCH-07, see §2.1** |
| `TON_ARB_RESEARCH_05.md` | RESEARCH-05 | Gas-exhaustion/stuck-asset risk; Live-Streaming Prompt UI proposal; concurrent-quote requirement |
| `TON_ARB_RESEARCH_06.md` | RESEARCH-06 | Audited EXECUTION-04's claims as evidence-free, downgraded to hypothesis; found TON→GRAM rename; corrected DeDust host claim; refined gas-exhaustion finding (balance absorbs shortfall) |
| `TON_ARB_RESEARCH_07.md` | RESEARCH-07 | First live tool access: falsified EXECUTION-04 via transaction history + BOC parse (later found to be a false negative on get-methods, §2.1); confirmed GRAM rename in live API + symbol-collision risk |
| `TON_ARB_RESEARCH_08.md` | RESEARCH-08 | Corrected RESEARCH-07's false negative (camelCase `getConfig` works); audited dashboard as symbol-safe (closed); diagnosed why DeDust host-hunting kept failing |
| `TON_ARB_RESEARCH_09.md` | RESEARCH-09 | Resolved executor dispatch via `@ton/sandbox` emulation (real, owner-gated handlers); resolved DeDust quote endpoint (`/v2/routing/plan`), live-verified with real quotes |

Consult the originals when the compressed summary above is insufficient — e.g., to see the exact wording of a citation, the full VM trace output, or the specific reasoning behind a now-superseded claim.
