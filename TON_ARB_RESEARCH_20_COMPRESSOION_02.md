# TON DEX Arbitrage Terminal — Compressed Research Digest (v2)

**AGENT_ID: TON_ARB_RESEARCH_20_COMPRESSOION_02**
**Compiled:** September 13, 2026
**Role of this document:** This is a *compression* pass, not a research contribution — it does not add new findings of its own. It distills the entire chain to date — `TON_ARB_RESEARCH_01.md` through `TON-ARB-RESEARCH_19.md`, including the prior digest `TON_ARB_RESEARCH_10_COMPRESSOION_01.md` — into one current-state reference. All of those source files are now archived in `COMPRESSED/`. Where the source files contain a chain of claim → correction → re-correction, this document states **only the final, most-recently-verified status** of each question, with a short note on how it got there. Full blow-by-blow reasoning, raw request/response bodies, VM traces, and superseded claims remain in the archived originals — consult them, not this file, for that detail.

**Note on this document's own timeline:** this compression was originally drafted against contributions 01–18, before contribution 19 (which resolved the project's central open question — see §2.4) was merged into the project's `master` branch from a separate, concurrently-running session. It was revised in place to fold contribution 19 in before being finalized, rather than shipping a digest whose headline conclusion was already stale. The one exception: §2.4 below also raises a reconciliation question about contribution 19's finding that no prior contribution (19 included) has answered — flagged, not resolved, per this project's own verification discipline (§4–§5).

This document **supersedes** `TON_ARB_RESEARCH_10_COMPRESSOION_01.md` as the project's single current-state reference. That file is not deleted — it is archived alongside the numbered contributions it used to sit above, since its content (compressed research 01–09) is now folded into §2–§4 below alongside contributions 11–18.

---

## 1. What this project is

A research effort (not yet an implementation) to design a **human-authorized, semi-automatic TON blockchain DEX arbitrage terminal** (STON.fi ⇄ DeDust cross-pool spreads). Target workflow: the system continuously scans, finds the best currently-executable opportunity, computes full round-trip economics (fees, gas, slippage, safety margin), presents it to a human operator, requires explicit approval, re-validates immediately before broadcast, executes, verifies, and records the outcome. The machine never executes autonomously; the human is always the final authorizer. A large historical spread must never be presented as if it were a currently-executable price — "what happened" and "what can I execute now" are treated as different questions throughout.

Each session is invoked as a numbered agent (`TON_ARB_RESEARCH_NN` / `TON-ARB-RESEARCH_NN`) that reads prior files and appends one new one. **Working discipline, mandatory since early in the chain and restated by every later contribution:** don't restate a hypothesis as FACT without a pasteable artifact (raw request/response body, transaction hash, get-method output, VM trace). Multiple agents have violated this and produced confidently wrong conclusions that took later agents to unwind — see §5.

**Process rules added by contributions 17–18, still standing:**
- Every contribution should disclose its base model, environment state (live network access? sandbox emulation? mock mode?) — informative only, never treated as an audit trail (§5.4).
- Every contribution must update `README.md` in the same session, not just add a numbered file.
- Every contribution must end with an explicit, numbered handoff to the next contributor — not a vague "future work" gesture.
- If a contribution was itself answering a prior handoff and did not complete it, it must say so explicitly, near the top, before presenting anything else.

---

## 2. Current ground truth, by subsystem

### 2.1 Executor contract — `EQBo5HJbBWZlOVuBpOPSiRNu18eHgq8XmoTbwdBlZpKflg3s`

**Status as of RESEARCH_18 (most current, empirically verified):**

- **Deployed, real, non-trivial, owner-gated code** — confirmed real and access-controlled since RESEARCH-09, not placeholder/tutorial code (RESEARCH-07's original "no executor exists" conclusion was itself a false negative from testing the wrong get-method casing; see §5).
- **`getConfig()` (method ID `93770`) is settled ground truth: `enabled=true`, `min_spread_bps=200` (2.00%), `max_trade_nanos=50,000,000,000` (50 TON), `gas_reserve_nanos=500,000,000` (0.5 TON).** This was **disputed mid-chain and then resolved**:
  - RESEARCH_12 hand-parsed the raw persistent-data cell using the wrong TL-B primitive (`loadCoins()` / VarUInteger16) and got `enabled=false, min_spread_bps=513, max_trade_nanos=1,600,000,000,000, gas_reserve_nanos=0` — internally inconsistent (left 55 of 419 bits unaccounted for) and, critically, **wrong in the dangerous direction** (told readers the executor was safely inert when it was not).
  - RESEARCH_13 (no live network access that session) correctly flagged this as unverified rather than restating it.
  - RESEARCH_14 planted the contract's real code+data into a local `@ton/sandbox` and read the actual execution trace: the true storage layout is `loadAddress()` (267 bits) + `LDU 8` + `LDU 16` + `LDU 64` + `LDU 64`, consuming **exactly 419 bits**, and matches `getConfig()`'s live stack output byte-for-byte. `getConfig()` was right all along — RESEARCH_12's raw-byte decode used the wrong deserialization primitive.
  - RESEARCH_17 independently re-confirmed this unchanged via a direct live `runGetMethod` call (bypassing the project's own buggy `executor_verifier.ts`, see §2.4): identical stack `[0x1, 0xc8, 0xba43b7400, 0x1dcd6500]`.
- **Owner address:** `EQDZlnNRydIutcTUJFgm6Mggnu79-JIzpr1uoMg9qqW7OBPM` (read from the persistent data cell, informational only — no signing). Confirmed active, deployed code, balance ~0.828 TON as of RESEARCH_12, unchanged through RESEARCH_14. **Never re-checked in a later contribution — treat its current balance/state as stale if much time has passed.**
- **5-way top-level opcode dispatch** in `recv_internal`: `0x11223344`, `0x99887766`, `0xAABBCCDD`, `0xDEADBEEF`, `0x7362D09C`. Four of the five end in a genuine `SDEQ` (slice-equal) sender-vs-owner check followed by `THROWIFNOT 401`; two of those also unpack the live config tuple mid-handler. The fifth (`0x7362D09C`) starts with `SWAP; LDGRAMS`, consistent with parsing a real variable-amount parameter (RESEARCH-09, unchanged since).
- **Transaction history:** as of RESEARCH-09 through RESEARCH_17, lifetime history was exactly 2 transactions (deploy + a 29 TON deposit), both from the owner address, and `last_transaction_id.lt` was stable at `102923871000003` across RESEARCH_12/14/17 — i.e. **the executor has never actually processed a trade.**
  - **Unresolved discrepancy this compression is flagging, not resolving:** RESEARCH_18's `arb-research-api` §2 example output for `GET /executor/status` shows `last_transaction_lt=103104091000005` — a *different*, later LT than RESEARCH_17's `102923871000003`, with no comment anywhere in RESEARCH_18 acknowledging a change. Either the executor received a new transaction between contributions 17 and 18 (which would be the first activity on this contract since its original deploy+deposit, and worth understanding — who sent it, what opcode, did it succeed), or one of the two quoted values is a transcription/formatting artifact. **Next contributor should re-check this live before assuming either number is current** — this is exactly the kind of unflagged discrepancy the project's own verification discipline (§5) says should never be silently inherited.
- **Conclusion, unchanged since RESEARCH-09/14/17:** a real, owner-gated, partially-built executor, confirmed live and enabled, that has (almost certainly, pending the item above) never been operationally exercised for a swap. **Still unaudited. Still not recommended for use.**
- **Design decision still not made by any contribution:** finish/audit this executor vs. client-orchestrated sequential swaps. Every contribution from RESEARCH_12 through RESEARCH_18 that has taken a position has recommended client-side sequential execution for any initial prototype — see §3.

### 2.2 STON.fi quote path

- **Live endpoint, exact wire format corrected by RESEARCH_14:** `POST https://api.ston.fi/v1/swap/simulate` takes **query-string parameters**, not a JSON body — `?offer_address=...&ask_address=...&units=...&slippage_tolerance=...`. A JSON body on the same endpoint returns `400 Failed to deserialize query string`. (RESEARCH-06 and RESEARCH_12 both used this endpoint successfully but never documented which wire format worked; RESEARCH_14 pinned it down after wasting calls on the JSON-body form.)
- **Native asset:** `kind: "Ton"`, symbol field `"GRAM"` (not `"TON"`, per the TON→GRAM rename — see §2.4), canonical pseudo-address `EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c`.
- **USD₮ jetton master, confirmed genuine (not a decoy):** `EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs` — `priority:100`, `default_symbol:true`, tagged `asset:essential`/`asset:popular`, `third_party_usd_price: 0.9998` (correctly pegged). Identical contract address used on both STON.fi and DeDust's own pool metadata (`"Tether USD"/"USDT"`) for every quote in this corpus. A targeted scan of the (as of RESEARCH_14) 38,906-entry asset list found dozens of unrelated scam jettons symbol-squatting `PTON` (`PTONSKI`, `TRUMPTON`, `PUMPTON`, `KEEPTON`, etc.) — confirms, at larger scale, RESEARCH-07's original finding that 100+ tokens squat on `TON`/`GRAM`/`PTON`-like symbols. **Rule, unchanged: match natives on `kind=="Ton"`, jettons on exact contract address against a curated allowlist — never on symbol/display_name.**
- **Two relevant USD₮ pools, both correctly priced against an independent reference:**
  - Legacy pTON v1 pool `EQD8TJ8xEWB1SpnRE4d89YO3jl0W0EiBnNS4IBaHaUmdfizE`: reserves ≈2,572,361 USD₮ / 1,861,480 TON → **$1.3819/TON**, `$5.14M` TVL, `$137,985`/24h volume.
  - Current-gen v2 pool `EQCGScrZe1xbyWqWDvdI6mzP-GAcAWFv6ZXuaJOuSqemxku4`: reserves ≈2,501,328 USD₮ / 1,806,615 TON → **$1.3846/TON**, `$861,727`/24h volume (6× the legacy pool's) — this is the pool STON.fi's own router actually fills through.
  - Both agree with STON.fi's own published `dex_usd_price` (**$1.38**) and with CoinGecko's independent price for `the-open-network` (**$1.38**, exact match). **STON.fi's pricing is correct; it is not the mispriced side of the spread** (see §2.5 — this corrects RESEARCH_12's original attribution).
- **Fee:** ~0.3% observed (`fee_percent ≈ 0.003004563`); documented default 0.3%, allowed range 0–1% — don't hard-code a universal rate.
- **Latency, best current measurement (RESEARCH_17, 30 live samples, superseding RESEARCH_12's unsourced "200–380ms" and RESEARCH_14's own n=5 sample):** min 142.79ms, mean 339.36ms, p50 203.79ms, p90 559.99ms, p95 762.70ms, p99 1692.53ms, max 1692.53ms; 1/30 samples over the 1000ms staleness threshold.

### 2.3 DeDust quote path

- **Live, verified endpoint:** `POST https://api.dedust.io/v2/routing/plan`, body `{"from": "native" | "jetton:<workchain>:<hex_hash>", "to": <same shape>, "amount": "<string, nanounits>"}`. This is a legacy API v2 namespace endpoint, not the UI-only `/v4/router/quote` aggregator three early agents incorrectly chased (that path exists but its wire contract was never confirmed and is not needed for pairwise cross-DEX analysis — don't re-litigate).
- **Separate pool-discovery host:** `https://mainnet.api.dedust.io/v4/api/<method-name>` (different subdomain, method-name-as-path).
- The official `dedust-io/sdk` GitHub repo contains **no** quote/router REST method — confirmed by full grep; don't look there for quoting.
- **The only native TON/USD₮ pool DeDust has:** `EQA-X_yo3fzzbDbJ_0bzFWKqtRuZFIRa1sJsveZJ1YpViO3r` (confirmed via a full scan of DeDust's 52,324-pool listing, RESEARCH_14). This is the pool behind the project's headline spread (§2.5).
- **Fee:** 0.1%, confirmed via `tradeFee` field matching the pool's documented rate.
- **Latency (RESEARCH_17, 30 live samples):** min 140.61ms, mean 322.99ms, p50 180.48ms, p90 619.54ms, p95 1064.80ms, p99 1160.26ms; **3/30 samples over 1000ms** — worse tail latency than STON.fi, relevant to the "quote may be stale by the time of human approval" design concern (§3).
- **Pool activity — corrected mid-chain, now settled:** RESEARCH_16's `dedust_pool_analyzer.ts` initially reported "0 swaps / INSUFFICIENT_DATA" against this pool, which read as "the pool might be dormant." RESEARCH_17 found this was a **tool bug, not a real signal** (§2.4) — decoding the real transaction bodies directly showed **50 transactions in 20.6 minutes, ≈1 every 25 seconds, sustained, most recent only ~2.7 minutes old at query time.** The pool is under continuous, active load.
- **What the traffic is — decoded by contribution 19, resolving contribution 17's open question:** internal DeDust V2 Pool↔Vault wire protocol, not present in `@dedust/sdk@0.8.7`'s public opcode list (confirmed by grepping the real installed package). Traffic cycles between two confirmed `dedust_vault`-interface addresses (`EQDa4VOnTYlLvDJ0gZjNYm5PXfSmmtL6Vs6A_CZEtXCNICq_`, native-TON vault, balance ~1.87M TON; `EQAYqo4u7VF0fa4DPAebk4g9lBytj2VFny7pzXR0trjtXQaO`, USD₮ jetton vault, balance 0.38 TON). RESEARCH_19 unpacked the cell payloads with `@ton/core` and mapped three opcodes: **`0x61ee542d` (`Pool.SWAP`)** — inbound from a Vault to the Pool, carrying `op`, `query_id`, `amount0`/`amount1` (`Coins`); which vault sent it (native vs. jetton) tells you the swap direction. **`0xad4eb6f5` (`Pool.PAYOUT`)** — outbound from the Pool to the destination Vault, carrying `op`, `query_id`, `amountP` (`Coins`), the exact output amount dispatched. **`0x9c610de3`** — an internal swap notification (query ID/referral routing detail). This is genuine cross-asset swap settlement, not spam or a same-asset internal mechanism — the open question from contribution 17 is resolved.

### 2.4 Cross-DEX spread — RESOLVED as of contribution 19: no persistent executable spread, but with one reconciliation gap this compression is flagging

This is the project's single biggest status change since the prior digest, and the section most worth reading carefully.

- **What was believed through contribution 18:** buying USD₮ on DeDust and selling it on STON.fi ("Path A") nets **≈+13.6–13.8% gross** (≈+11–13% after estimated gas); the reverse ("Path B") nets **≈−12.5% to −12.8%**. This was reproduced independently across three sessions (12, 14, 17) with raw request/response bodies from DeDust's own `POST /v2/routing/plan` quote endpoint and STON.fi's `/v1/swap/simulate`, at matched sizes, with normal price drift between sessions — not a data-entry error. RESEARCH_14 additionally corrected the *root cause* attribution: DeDust's pool (not STON.fi's, as RESEARCH_12 first guessed) is the side priced away from the independent CoinGecko/STON.fi consensus of $1.38/TON.
- **RESEARCH_19's correction: that reserve-ratio-implied price was never the real executable price.** Instead of quoting the API again, RESEARCH_19 decoded the pool's real internal traffic (§2.3) and read the exact `amount0`/`amountP` fields — the genuine input and output amounts — off real `Pool.SWAP`/`Pool.PAYOUT` message pairs from live transaction BOCs. Across 50 real transactions, the implied per-trade prices it found (six examples quoted, e.g. 562.40 USD₮→406.26 TON, 35.47 TON→48.90 USD₮) average **≈1.3820 USD₮/TON** — matching STON.fi (~$1.3777) and CoinGecko ($1.38) closely, not DeDust's own quoted/reserve-ratio price of ~$1.575–1.579. RESEARCH_19's conclusion: the ~14% figure was an artifact of computing price from raw constant-product reserve ratios (what contributions 12/14/17 did) rather than from what a real settled trade actually receives, and **no persistent, executable +14% cross-DEX spread exists.**
- **What this compression is flagging, not resolving, because no contribution has addressed it:** RESEARCH_19's real-executed-price finding and the project's own, separately well-verified finding that `POST /v2/routing/plan` — the API this entire project's architecture (§3) is built around calling to *get* an executable quote before trading — **repeatedly and consistently returned ~$1.575–1.579/TON for this exact pool, live, with full raw request/response bodies, across three independent sessions (12, 14, 17)** are in direct tension, and **no contribution has reconciled them.** RESEARCH_19 did not test the thing that would resolve this directly: call `/v2/routing/plan` for a quote, execute (or trace in `@ton/sandbox`) the trade that quote describes, and check whether the amount actually received matches the quoted ~1.575 rate or the ~1.382 rate its opcode-decode found in *other* parties' historical trades. Two explanations are both consistent with everything measured so far, and this corpus cannot currently distinguish them:
  1. **RESEARCH_19 is right and the quote API is simply not representative of settlement** (e.g. it prices against nominal/virtual reserves while the vault-level swap logic nets against a different effective price) — in which case this project's entire DeDust-side quoting logic (§3's "DEX-NATIVE QUOTE ADAPTERS" stage) has been reading the wrong number for this pool the whole time, a bug more consequential than any single spread calculation, and every past dual-DEX simulation in this repo (contributions 12, 14, 17) overstates DeDust-side output for this pair.
  2. **The historical trades RESEARCH_19 sampled are not representative of what a *new* quote-then-execute right now would receive** (e.g. they predate a subsequent price move, or represent trades through a different routing path than `/v2/routing/plan` uses) — in which case the ~14% reserve-ratio-implied price may still be closer to what a fresh trade would actually pay, and RESEARCH_19's "no spread exists" conclusion would be the one that needs walking back.
  - Per this project's own standing rule (§4, lesson 4: numbers this good/this resolved deserve *more* scrutiny, not less), **treat "no persistent spread exists" as RESEARCH_19's claim, not yet as independently reproduced project consensus**, until a future contribution runs the quote-then-trace-the-real-settlement test described above and pastes the result. This is now the single most important open item (§6, item 1).
- **Independent of which explanation is correct, the standing safety conclusion is unchanged:** nothing in this corpus, before or after contribution 19, has recommended or authorized sizing or sending a real funded transaction against this pair. If anything, an unreconciled gap between a DEX's own quote API and what its trades actually settle at is a reason for more caution about trusting that API's quotes generally, not a green light now that the "spread" is believed resolved.

### 2.5 Tooling pipeline (contributions 15, 16, 17, 19) — built, found broken live, then fixed

Five TypeScript CLI tools were specced (15) and built (16) under `src/tools/`: `dedust_pool_analyzer.ts`, `dual_dex_simulator.ts`, `executor_verifier.ts`, `latency_benchmarker.ts`, `preflight_safety_gate.ts`. All passed a 100%-offline mock test suite (`test/index.ts`) from contribution 16 onward, and RESEARCH_17 confirmed that offline pass rate is **not** a reliable predictor of live correctness — two of the five were silently broken on real data. **All identified bugs were fixed by contribution 19:**

- **`dedust_pool_analyzer.ts` — was 100% non-functional on real data (RESEARCH_17), now fixed (RESEARCH_19).** The original classifier string-matched literal English text (`"ton to usdt"`) that existed only in the RESEARCH_15 mock fixture, and its numeric fallback threshold (`>1 TON per leg`) missed this pool's actual ~0.09–0.2 TON/leg trade sizes — both branches silently fell through to `UNKNOWN`, producing the misleading "0 swaps / possibly dormant" read corrected in §2.3. RESEARCH_19 replaced the classifier with the real `@ton/core` opcode decode from §2.3 (`Pool.SWAP`/`Pool.PAYOUT`), and reported it correctly identifying 42 of 50 real swaps live with zero false zeros.
- **`executor_verifier.ts` — was silently and consistently falling back to mock live (RESEARCH_17), now fixed (RESEARCH_19).** The original 5000ms axios timeout was too short for a full live contract-data fetch, so every "LIVE"-labeled run in RESEARCH_17 was actually replayed RESEARCH_14 mock data (RESEARCH_17 bypassed it with a direct `curl`/`runGetMethod` call, §2.1, to get a real reading). RESEARCH_19 increased the timeout to 15000ms, added optional API-key support, and reported a live run returning `enabled=true` with no mock-fallback warning.
- **`dual_dex_simulator.ts` — cosmetic bug fixed (RESEARCH_19).** The per-size header used to always print "1 TON Quote" regardless of actual size; RESEARCH_19 corrected the label formatting. RESEARCH_17's separate finding — a silent mock-fallback path on individual size queries when the live call itself fails (e.g. a 502), printing only a `[WARN]` rather than refusing output — is not mentioned as addressed in RESEARCH_19 and should be assumed still present until re-checked.
- **`preflight_safety_gate.ts` — verified sound since RESEARCH_17** against real, live-derived numbers (correctly rejected a real 100 TON live simulation for exceeding the 50 TON cap); RESEARCH_19 re-confirmed it fails closed correctly.
- **`latency_benchmarker.ts` — fully live since RESEARCH_17**, no fallback behavior observed; its 30-sample output (§2.2, §2.3) is the current best latency baseline for both DEXs.

**General lesson (see also §4, §5), still true even though the specific bugs are now fixed:** a tool passing its own offline, hand-written mock fixtures 100% of the time gives close to zero assurance about live correctness when the mock fixture was authored to match the tool's own assumptions rather than sampled from real API/chain output. A tool that silently substitutes mock data on a live failure (rather than erroring loudly) is a strictly worse failure mode than a crash, because it produces a plausible-looking result indistinguishable from a real one without reading the tool's own source. **RESEARCH_19's fixes were reported as live-verified in the same session that made them — per this project's own discipline, a future session should re-run them once more before trusting the fixes are durable, the same way RESEARCH_17 caught bugs in tools RESEARCH_16 believed were complete.**

### 2.6 Automation & read-only API (contribution 18)

- **`arb-research-api/`** — a Flask app (`app.py` routes, `core.py` logic) exposing the same live data sources the TS tools use, over plain HTTP `GET`: `/health`, `/reserves/dedust`, `/executor/status`, `/quote/stonfi`, `/pool/transactions`, `/spread`. **Deliberately has zero mock fallback anywhere** — every route raises/returns a non-2xx status on any upstream failure, a direct design response to §2.5's mock-fallback bugs in the TS tools. Read-only only: no route accepts a key, builds a signed message, or can broadcast. Binds to `127.0.0.1` by default; no auth/rate-limiting layer (intentional, for local/internal use — add auth first if ever exposed to untrusted callers). Every route was verified against live data before being considered done (see contribution 18 §2 for example outputs).
- **`.github/workflows/`** — three scheduled, read-only workflows, none requiring secrets (an optional `TONCENTER_API_KEY` only raises rate limits): `reserve-snapshot.yml` (every 20 min, appends to `data/reserve_snapshots.jsonl` / `data/executor_snapshots.jsonl`); `tool-suite-ci.yml` (offline tests on every push/PR, plus a daily live health check that flags — as a warning, not a hard failure — any tool reporting a mock fallback, directly targeting the §2.5 failure class); `api-smoke-test.yml` (exercises all six `arb-research-api` routes every 6 hours). **As of contribution 18, none of the three had been confirmed to actually fire on GitHub Actions.** Contribution 19 ran `scripts/snapshot_reserves.py` **directly** (not via the scheduled workflow) and got the **first** rows written into `data/reserve_snapshots.jsonl` and `data/executor_snapshots.jsonl` — this confirms the script itself works end-to-end, but **is not the same thing as confirming the scheduled GitHub Actions trigger has actually fired**, and RESEARCH_19's own handoff (§6) still asks the next contributor to check the Actions tab. There is not yet a real multi-hour time series to use for the §2.4-adjacent drift question — only the one manually-triggered row (plus whatever the schedule may have added since, unverified from any session so far).

### 2.7 TON chain-level facts (stable, unlikely to need re-verification soon)

- **Sub-second finality is live:** ~400ms block time, ~1s finality, via Catchain 2.0 (effective April 9, 2026). Streaming API v2 delivers `pending`/`confirmed`/`finalized`/`trace_invalidated` events at 30–100ms latency.
- **No cross-contract atomicity by default.** A TON transaction is a state change for one account processing one message; a multi-leg operation is a trace of independent transactions, each able to bounce/fail independently. An executor contract can only *approximate* atomicity via its own conditional-sequencing logic — not a chain-level guarantee.
- **Bounce/refund is not guaranteed.** A bounce only fires if the bounce flag was set *and* enough `msg_value` remains after gas/forward-fee consumption; otherwise the shortfall is absorbed into the receiving contract's own balance (not destroyed). Actionable: compute a worst-case gas buffer for the failure path, and monitor a contract's own balance drift as a cheap leak-detection signal.
- **MEV/front-running risk is structurally lower than EVM** (no public mempool, async messaging, limited validator reordering power) but not zero — model as a competition probability in opportunity ranking, not a direct cost line. No empirical bot-census has been done (still queued, §6).
- **TON's native currency was renamed Toncoin → Gram (GRAM)** effective June 15, 2026 (community vote). Asset-only rename; network name, addresses, balances unaffected; the low-level TL-B type was already `Grams` pre-rename. Display strings/symbol fields across the early part of this corpus (RESEARCH-01 through EXECUTION-04) hardcode "TON" and should not be trusted as literals — treat the native display symbol as runtime-configurable, sourced from whatever the live API returns. See §2.2 for the more severe symbol-collision safety rule this exposed.
- **Gas is fully deterministic**, not merely estimated — both STON.fi's `gasParams` and DeDust's `network_fee` surface computed values directly from published, governance-controlled network config. Reserve buffer only for data-dependent branches inside compute phase, not network-level uncertainty.

---

## 3. Architecture (current best hypothesis, materially unchanged in shape since RESEARCH-02, refined in detail since; unaffected by any correction in §2)

```text
HISTORICAL / INDEXED DATA  (TON Center v3, DEX APIs — discovery only, never execution-eligible)
        ↓ candidate hints
LOW-LATENCY EVENT SIGNALS  (TON Streaming API v2, 30–100ms; pending/confirmed/finalized)
        ↓ invalidation / trigger — used as a cache-invalidation bus, not a source of truth
LOCAL MARKET-STATE CACHE   (pool state keyed by state identity — LT/state-hash, not wall-clock TTL)
        ↓ shortlist
DEX-NATIVE QUOTE ADAPTERS  (STON.fi POST /v1/swap/simulate?... @ api.ston.fi  [query-string params, not JSON body]
                             DeDust   POST /v2/routing/plan @ api.dedust.io  [JSON body])
        ↓ two executable quotes
SPREAD EVALUATION + SIZE OPTIMIZATION + FULL COST MODEL
   (adaptive discrete quote grid for size; incremental-cashflow accounting — never
    double-subtract a fee/slippage already embedded in a quote's output)
        ↓ economic candidate
SAFETY / CONSISTENCY GATE
   - state freshness (state-identity match, not just quote age)
   - route identity, token identity (contract-address/kind matching ONLY — never symbol strings)
   - executor semantics — CONFIRMED enabled=true, owner-gated, never operationally used (§2.1); do not
     route through it without the owner's explicit, user-confirmed authorization
   - min-out as a hard, contract-enforced invariant, not a UI setting
   - worst-case failure-path gas buffer (guarantee refund affordability)
   - executor/pool balance-drift monitoring (leak detection; also how §2.4's open question gets answered)
   - spread-magnitude sanity check: an implausibly large, persistent spread is a rejection signal, not
     an opportunity signal, until its persistence mechanism is understood (§2.4)
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

**Key refinements worth preserving explicitly (unchanged from the prior digest, still current):**

- **Quotes should be invalidated on state-identity change, not merely time-to-live.** A tuple like `(pool state LT/hash, route identity, simulation method/version)` catches staleness a pure TTL would miss.
- **Don't double-count costs.** Store `quoted_output_raw`, `protocol_fee_embedded`, `explicit_router_fee`, `network_fee_estimate`, `price_impact_reference`, `minimum_output`, and `safety_buffer` as distinct fields; derive net profit from incremental cash flows, not overlapping independent estimates.
- **Trade-size optimization:** coarse-to-fine discrete quote grid (e.g. 0.1x/0.2x/0.4x/0.6x/0.8x/1.0x of a liquidity-derived ceiling), not continuous numerical optimization first.
- **The static CLI "Execute this trade? [y/N]" prompt is likely inadequate on a 400ms-block chain.** A "Live-Streaming Prompt" that re-polls both quotes concurrently (~500ms cadence) while armed, auto-aborts on "CANDIDATE DECAYED," and uses the freshest background quote as the `min_out` basis at approval time, is the proposed (not yet implemented or benchmarked) fix. Requests to both DEX APIs must be issued concurrently, not sequentially.
- **Failure/condition model:** three-valued (`PASS`/`FAIL`/`UNKNOWN`); all external ambiguity maps to `UNKNOWN → execution blocked`, never an implicit pass.
- **Architectural decision, reaffirmed by every contribution from 12 through 18 that has taken a position: client-orchestrated sequential execution is preferred over the custom executor for any initial prototype** — not because the executor is disabled (it is confirmed enabled, §2.1), but because it is unaudited and would require trusting its owner-gated custom logic instead of official DEX routers. The client wallet sends leg 1 with strict `min_out`/`deadline`, waits for confirmation, checks the result, then sends leg 2 with its own invariants.

---

## 4. Verification methodology established in this project (durable, reusable)

Preserved in long-term memory ([[ton-arb-verification-discipline]]) and restated here for completeness, now with two more lessons added by contributions 15–18:

1. **Static TVM disassembly is unreliable for this project's contracts.** Two independently-maintained JS disassemblers both fail on the same real opcode in the executor's code. **Hand-decoding raw opcode bytes from memory to route around a disassembler failure is exactly what produced RESEARCH-07's confidently-wrong "no executor exists" conclusion, and what produced RESEARCH_12's wrong `enabled=false` claim (a hand-chosen deserialization primitive, not a disassembler issue, but the same root failure mode: reasoning about bytes instead of running them). Do not do this.**
2. **Preferred method: empirical testing via `@ton/sandbox` local TVM emulation.** Fetch a contract's real code+data+balance via `toncenter`, plant it into a local sandbox (`createShardAccount` + `setShardAccount`), send synthetic messages, read the real exit code and VM trace. Zero mainnet risk — a local fork/replay of already-public on-chain state. **This is what resolved both the executor-dispatch question (RESEARCH-09) and the `enabled` flag dispute (RESEARCH_14) — reach for it before trusting a disassembler, a hand parse, or reasoning from memory of TVM opcode semantics.** Caveat: `node_modules` are not persisted between sessions — reinstall each time.
3. **When guessing an external service's REST API host/path, prefer reading a community open-source API client's actual source/README over pattern-matching a product name.** DeDust's real quote endpoint was found only by reading a third-party Rust client's README, under an unrelated legacy `/v2/routing/plan` namespace three agents had not guessed.
4. **A confident, well-formatted claim with a headline number is not the same as a verified one — especially when the number is unusually favorable.** RESEARCH_12's +13.7% spread and its executor `enabled=false` claim were both presented with confident, structured language and no raw artifact; RESEARCH_13 was right to demand reproduction before either was trusted, and both needed correction (the spread's *existence* held up under reproduction; its *root-cause explanation* and the *executor* claim did not).
5. **An offline test suite passing 100% is not evidence a tool works against real data — and a tool that silently substitutes mock output on a live failure is a more dangerous failure mode than one that crashes loudly.** Established by RESEARCH_17 finding two of RESEARCH_16's five tools (each with a 100%-passing offline suite) silently broken or silently mock-substituting on real inputs. The concrete countermeasures this project has since adopted: (a) build new live-data consumers (like `arb-research-api`) with **no mock fallback path at all** — fail loudly instead; (b) add scheduled live health checks (`tool-suite-ci.yml`'s daily live run) that specifically watch for a tool reporting a mock fallback, not just for a crash.
6. **When two in-project sources disagree on a price, check an independent third-party source before deciding which one is "wrong."** RESEARCH_14 resolved the STON.fi-vs-DeDust pricing dispute by checking CoinGecko independently, rather than assuming either DEX's own number was ground truth.

---

## 5. Where confident claims turned out to be wrong — the full sequence, so it isn't rediscovered

**The single most important lesson this research log has taught, repeatedly, is that a confident-sounding, well-formatted claim is not the same as a verified one.**

1. Contribution 04 (`EXECUTION-04`) asserted, in "FACT" language, detailed claims about the executor's swap-execution behavior, with no artifact.
2. Contribution 07 showed, via real transaction history and a BOC parse, that those claims were fabricated — but also introduced its own false negative (testing only snake_case get-method names when the real dashboard used camelCase), concluding "no executor exists."
3. Contribution 08 caught and fixed that specific gap (camelCase `getConfig` works).
4. Contribution 09 resolved the remaining dispatch-logic question via `@ton/sandbox` emulation rather than static disassembly, after confirming disassembly is unreliable for this contract.
5. Contribution 12 reported a headline **+13.7% "confirmed live"** spread without pasting raw request/response artifacts, and separately claimed (from a hand-parsed raw storage decode using the wrong TL-B primitive) that the executor was **disabled**.
6. Contribution 13, with no live network access that session (disclosed explicitly), correctly flagged both of 12's headline claims as unverified rather than restating them.
7. Contribution 14, with live access restored, **reproduced the spread** with raw artifacts at all three sizes and **corrected the root cause** (DeDust's pool is the mispriced side, not STON.fi's), and **refuted the executor claim** via a real TVM trace, showing `getConfig()` was right (`enabled=true`) and RESEARCH_12's raw decode used the wrong primitive.
8. Contributions 15/16 built a five-tool TypeScript suite, offline-verified 100% passing.
9. Contribution 17 found two of those five tools **silently produce mock or wrong output on real data** despite the 100%-passing offline suite — the same "confident-looking, wrong on inspection" pattern, now inside the project's own tooling rather than a prior contribution's prose.
10. Contribution 18 built a read-only API and automation with **no mock fallback**, as a direct structural response to #9, and explicitly disclosed which parts of its own predecessor's queue it did *not* address (a new process rule it introduced in the same session).
11. Contribution 19 decoded the DeDust opcodes (§2.3), fixed the tools #9 found broken (§2.5), and reported that the headline spread from #5–#7 doesn't exist as a real executable opportunity after all — real settled trades price near consensus, not near the reserve-ratio-implied rate. **This compression pass is flagging, per the same discipline, that #11's own claim has not yet been reconciled against the equally well-verified live quote-API numbers from #5/#7 (§2.4) — it may turn out to be right, but it hasn't yet cleared this project's own bar for "independently reproduced," only "internally plausible with concrete examples."**

**The standing rule for anyone continuing this project, human or AI:** no claim about live prices, contract behavior, account state, or tool output should be trusted, and certainly never acted on with real funds, unless it comes with a pasteable artifact — a real request/response body, a real transaction hash, a real get-method return value, a real TVM execution trace. Claims that promise an unusually large, easy, or risk-free return deserve *more* scrutiny before acting, not less.

---

## 6. Current priority research queue (carries forward RESEARCH_19's handoff, plus two items this compression pass surfaced that no prior file has flagged)

1. **(P0, new, highest priority)** Reconcile the tension identified in §2.4: does a fresh `POST /v2/routing/plan` quote for the DeDust TON/USD₮ pool actually settle at the quote's own promised rate (~$1.575–1.579, as returned live and reproduced three separate times), or at the ~$1.382 rate RESEARCH_19 found by decoding *other* parties' historical real trades? The clean test: get a live quote, then trace what a trade built from that exact quote would actually receive against the pool's real code+data in `@ton/sandbox` (or, if ever authorized, compare against a subsequent real small trade) — don't infer an answer from either side's numbers alone. This determines whether the project's DeDust-side quote adapter (§3) has been silently reading the wrong price for this pool the entire project, which is a more consequential bug than any single spread calculation.
2. **(P0)** Confirm at least one scheduled run of each of the three `.github/workflows/` jobs has actually succeeded on GitHub (Actions tab) — contribution 19's manually-triggered snapshot row is not the same as a confirmed scheduled firing (§2.6); this is RESEARCH_19's own stated top handoff item, still open.
3. If real scheduled snapshot data exists in `data/reserve_snapshots.jsonl` by the time you read this, use it to check whether the DeDust pool's reserve-ratio drift (moving *away* from parity, per contribution 17's 41-minute measurement) has continued, reversed, or leveled off — though per item 1, it's now unclear whether reserve-ratio drift is even the right metric to watch, versus the real-settlement price RESEARCH_19 measured a different way.
4. **(P1)** RESEARCH_19's own next-priority items, carried forward verbatim: (a) extend research beyond the TON/USD₮ pair to other high-volume DeDust/STON.fi jetton pools (e.g. NOT, MY, CATI) — apply the same rigor (raw artifacts, independent third-party price cross-check, real-vs-quoted reconciliation) rather than assuming this pair's now-revised conclusions generalize; (b) formalize a client-side sequential execution prototype specification (pre-execution transaction builder, human-in-the-loop signing interface, TON Connect 2.0/wallet payload generation) — specification only, still no execution capability; (c) keep confirming `tool-suite-ci.yml`'s daily live checks continue to pass without mock fallbacks, especially for the three tools RESEARCH_19 just fixed (§2.5) — a same-session "fixed and verified" claim should get at least one independent re-check.
5. **New item surfaced by this compression pass (not previously flagged in any prior file):** reconcile the executor `last_transaction_id.lt` discrepancy between contribution 17 (`102923871000003`) and contribution 18's example API output (`103104091000005`), §2.1. Re-check live before trusting either number, and if the executor genuinely received a new transaction, that is a materially important event (first activity since deploy) that no prior file has acknowledged.
6. **Standing rule, unchanged since it was first stated and restated by every contribution since:** no capital moves, no contract deployment, no signed/authorized call constructed or sent, and no execution capability added to the tooling, without surfacing that specific decision to the user explicitly first — never merely because a prior file's queue or recommendation implied it was the natural next step. This applies even to a sandbox-only test that would require possessing or using real key material.

---

## 7. Scope boundary (unchanged, load-bearing)

This project is **research and analysis only**: read-only chain queries, reading local scripts, web/SDK lookups, and local sandbox emulation of already-public state. **No deploying contracts, signing transactions, or moving funds.** The `.env` API key present is read-only. If a future research step would require constructing or sending an authorized/signed call, or any other fund-moving/deploying action, **that is a decision point to surface to the user explicitly** — never to execute merely because a prior agent's queue listed it as "the next step." This applies even to actions that would otherwise be zero-risk (e.g., a sandbox-only test) if they would require possessing or using real key material. Contribution 18 additionally noted: if a future contribution is ever *asked* to add execution capability, that request itself should be surfaced to the user before being built, not treated as a natural evolution of "the read-only tooling is solid now."

## 8. What this repository is not

- Not a deployed system. No code here signs or broadcasts transactions.
- Not financial advice; none of the spread/profitability figures in this repo should be treated as a live, current, or safe trading signal — re-fetch via `arb-research-api`'s `/reserves/dedust` or `/spread` routes rather than trusting any number in this document, which is already stale relative to whenever it's read.
- The executor contract is unaudited. Its enabled/live state is settled (`enabled=true`, confirmed via TVM trace, §2.1) but its post-authorization logic has never been audited, and (pending §6 item 7) has likely never processed a real trade. It should not be sent funds or routed through on the basis of anything written here.

---

## 9. Index of archived source material

The full, unabridged research chain (all reasoning, every superseded claim, every raw artifact, every citation) is preserved in `COMPRESSED/`:

| File | Agent | One-line contribution |
|---|---|---|
| `TON_ARB_RESEARCH_01.md` | RESEARCH-01 | Founding brief: goals, workflow, prototype dashboard description, architecture hypothesis, research taxonomy |
| `TON_ARB_RESEARCH_02.md` | RESEARCH-02 | TON API layering, quote+safety mechanisms (cited), atomicity rejection, state-identity concept, cost double-counting warning |
| `TON_ARB_RESEARCH_03.md` | RESEARCH-03 | DeDust hosted quote API claim (later corrected), executor urgency flagged, sub-second finality confirmed, gas determinism, MEV structural analysis |
| `TON_ARB_RESEARCH_04.md` | EXECUTION-04 | Claimed executor "reverse-engineered" with no artifact — later falsified by RESEARCH-07 |
| `TON_ARB_RESEARCH_05.md` | RESEARCH-05 | Gas-exhaustion/stuck-asset risk; Live-Streaming Prompt UI proposal; concurrent-quote requirement |
| `TON_ARB_RESEARCH_06.md` | RESEARCH-06 | Audited EXECUTION-04's claims as evidence-free; found TON→GRAM rename; corrected DeDust host claim; refined gas-exhaustion finding |
| `TON_ARB_RESEARCH_07.md` | RESEARCH-07 | First live tool access: falsified EXECUTION-04 via transaction history + BOC parse (later found to include its own false negative on get-methods); confirmed GRAM rename + symbol-collision risk |
| `TON_ARB_RESEARCH_08.md` | RESEARCH-08 | Corrected RESEARCH-07's false negative (camelCase `getConfig` works); audited dashboard as symbol-safe; diagnosed DeDust host-hunting failures |
| `TON_ARB_RESEARCH_09.md` | RESEARCH-09 | Resolved executor dispatch via `@ton/sandbox` emulation (real, owner-gated handlers); resolved DeDust quote endpoint, live-verified |
| `TON_ARB_RESEARCH_10_COMPRESSOION_01.md` | COMPRESSION-01 | First compression pass: distilled 01–09 into one current-state reference (now itself folded into this document) |
| `TON-ARB-RESEARCH_11.md` | RESEARCH-11 | Audited the compressed corpus, reprioritized the queue, argued for an empirical live cross-DEX experiment as the highest-value next step |
| `TON-ARB-RESEARCH_12.md` | RESEARCH-12 | First live matched cross-DEX experiment (+13.7%/−12.8%); executor storage decode — **both later found to need correction** |
| `TON-ARB-RESEARCH_13.md` | RESEARCH-13 | No live network access (disclosed); critically flagged RESEARCH_12's two headline claims as unverified; added `README.md` |
| `TON-ARB-RESEARCH_14.md` | RESEARCH-14 | Reproduced the spread live with raw artifacts; corrected root cause (DeDust mispriced, not STON.fi); refuted executor `enabled=false` via TVM trace; made README updates mandatory |
| `TON-ARB-RESEARCH_15.md` | RESEARCH-15 | Specified 5 TypeScript research tools (offline mock fixtures + live mode) for contributions 16/17 to build and run |
| `TON-ARB-RESEARCH_16.md` | RESEARCH-16 | Implemented all 5 tools; 100% passing offline mock test suite |
| `TON-ARB-RESEARCH_16.1.md` | RESEARCH-16.1 | Proposed mandatory base-model disclosure per contribution; self-reported as Claude 3.7 Sonnet (unverified by any later contribution) |
| `TON-ARB-RESEARCH_17.md` | RESEARCH-17 | Ran the tool suite live: found 2 of 5 tools silently broken/mock-substituting on real data; confirmed DeDust pool is active (not dormant) and its reserves drifted further from parity over 41 minutes; disputed 16.1's "mandatory"/hallucination-profile framing |
| `TON-ARB-RESEARCH_18.md` | RESEARCH-18 | Added read-only `arb-research-api/` (no mock fallback) and 3 scheduled GitHub Actions workflows; introduced the explicit-handoff and explicit-incomplete-handoff process rules; explicitly disclosed not addressing RESEARCH_17's queue |
| `TON-ARB-RESEARCH_19.md` | RESEARCH-19 | Decoded the DeDust Pool↔Vault opcodes; reported real executed swap prices (~$1.382) matching consensus, concluding the ~14% figure was a reserve-ratio artifact; fixed all 3 broken/buggy tools from contribution 17; got the first live reserve-snapshot rows written — **see §2.4 for a reconciliation gap this compression pass found in the spread conclusion, not yet addressed by any contribution** |

Consult the originals when this compressed summary is insufficient — e.g., to see the exact wording of a citation, the full VM trace output, the raw HTTP request/response bodies, or the specific reasoning behind a now-superseded claim.
