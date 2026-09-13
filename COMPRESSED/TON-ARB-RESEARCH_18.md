# TON DEX Arbitrage Terminal — Read-Only API, Contribution Process Change, and Scheduled Automation

**AGENT_ID:** TON-ARB-RESEARCH_18
**Date:** September 13, 2026
**Role:** Research Contribution #18 (Tooling & Infrastructure)

---

## 0. Model & Environment Disclosure

Per the practice contributions 16.1 and 17 established: this session runs on **Sonnet 5** (model id `claude-sonnet-5`, Anthropic). Same caveat 17 already gave and that still holds — this is informative, not an audit trail; nothing in this log ties either of the two confirmed bad claims (contributions 04, 12) to a specific model family.

**Environment state this session:** confirmed live network access to `toncenter.com`, `api.dedust.io`, and `api.ston.fi` before writing any code against them — every endpoint shape used below (`GET /v2/pools`, `POST /v2/routing/plan`, `POST /v1/swap/simulate`, `GET getAddressInformation`, `POST runGetMethod`, `GET getTransactions`) was hit live and its real response inspected first, per [[ton_arb_verification_discipline]], rather than inferred from a prior contribution's prose description of it.

---

## 1. What was asked and what this contribution did

The task for this session was: implement `arb-research-api/app.py` and incorporate it into the project; add a new contribution-process requirement (explicit handoff instructions for the next contributor, and explicit disclosure if a contributor failed to do what was asked of them); and add scheduled GitHub Actions that do something that directly helps ongoing research.

This is **not** the same as TON-ARB-RESEARCH_17 §8's priority queue (decode the Pool↔Vault opcodes, extend the reserve-drift observation window, fix the two broken CLI tools, fix the simulator's cosmetic bug). None of those four items were worked on this session — see §5 below for why that isn't being left implicit, per the process rule this contribution itself adds.

## 2. `arb-research-api/` — a read-only HTTP wrapper

Added `arb-research-api/app.py` (Flask routes) and `arb-research-api/core.py` (the actual fetch/parse logic, importable independently of the web layer). It exposes the same live data sources the `src/tools/*.ts` CLI tools already use — DeDust pool reserves, DeDust/STON.fi quotes, the executor contract's `getConfig()`, raw pool transaction history, and a live dual-DEX spread calculation — over plain HTTP `GET` routes, so other tools (including the new scheduled workflows in §3) can consume research data without reimplementing request/parsing logic in a third language.

**Every route was run against the live network and its actual output inspected before being considered done**, not just written and assumed correct:

```
GET /health                  -> {"ok":true,"service":"arb-research-api"}
GET /reserves/dedust         -> live TON/USD₮ pool reserves, e.g. 201,799.30 TON / 317,806.16 USDT (implied 1.57486 USDT/TON)
GET /executor/status         -> enabled=true, min_spread_bps=200, max_trade_nanos=50000000000, last_transaction_lt=103104091000005
GET /quote/stonfi?...        -> full live STON.fi swap/simulate response (ask_units, price_impact, router info, etc.)
GET /pool/transactions?limit=5 -> raw live Toncenter getTransactions rows
GET /spread?amount=1         -> Path A +0.1385 TON gross / Path B -0.1251 TON gross, both live-quoted
GET /quote/stonfi (no params) -> HTTP 400, {"ok":false,"error":"..."}  (fails closed, does not guess defaults)
```

These numbers land in the same range as RESEARCH_17's independent measurements taken ~14 hours earlier (reserves drifted slightly further, consistent with continuous real trading, not a code bug), which is itself a small piece of cross-validation that the new API is reading the same real pool RESEARCH_11 onward has tracked, not a different one.

**Design choices, and why:**
- **No mock fallback, anywhere.** RESEARCH_17 §1 and §4 found that two `src/tools/*.ts` CLI tools silently substitute mock data on a failed live call, and that this was not obvious from their output. `core.py` raises `UpstreamError` instead and every route returns a non-2xx status on failure — a caller (human or automated) cannot mistake a failure for a live result. This is a deliberate deviation from the existing tools' behavior, not an oversight; see `arb-research-api/README.md` for the explicit statement of this policy.
- **Read-only only.** No route accepts a private key, builds a signed message, or calls anything that could broadcast a transaction. This does not change the project's core safety posture (README "What this repository is not") — it just gives the existing read-only posture an HTTP interface.
- **Binds to `127.0.0.1` by default**, not `0.0.0.0` — a deployer has to opt in to exposing it beyond localhost via `HOST=0.0.0.0`, rather than that being the default.

Not done, and explicitly flagged rather than silently skipped: no auth/rate-limiting layer was added, since this is a research tool intended to run locally or behind a caller's own infrastructure, not a public-facing service. If a future contribution deploys this somewhere it's reachable by untrusted callers, add auth first — don't assume the lack of one here means it was considered and judged unnecessary for that context.

## 3. Scheduled GitHub Actions

Three workflows were added under `.github/workflows/`, all read-only (no route or script they run can sign or broadcast a transaction), and all designed to keep working without any repository secrets configured (an optional `TONCENTER_API_KEY` secret only raises the rate limit):

1. **`reserve-snapshot.yml`** — every 20 minutes, runs the new `scripts/snapshot_reserves.py` (built on `arb-research-api/core.py`) and commits one row each to `data/reserve_snapshots.jsonl` and `data/executor_snapshots.jsonl`. This directly executes RESEARCH_17 §8 item #2 ("take snapshots of this pool's reserves every 15–30 minutes over several hours") as ongoing infrastructure instead of requiring a future session to sit and poll manually. It fails the workflow run (writes nothing) rather than committing a partial or guessed row on any upstream error, for the same "unknown must never be treated as safe" reason `core.py` doesn't mock-fallback.
2. **`tool-suite-ci.yml`** — runs the existing offline `npm test` suite on every push/PR (this repo had no CI before), plus once daily also runs each of the five CLI tools live and uploads their raw stdout as a 90-day build artifact, flagging (as a workflow warning, not a hard failure) any tool that reports falling back to mock data live. This targets the exact failure class RESEARCH_17 found by hand — a tool that passes its offline mock-based tests but silently breaks on live data — by re-checking it automatically instead of only when a human happens to run the tools live.
3. **`api-smoke-test.yml`** — every 6 hours (and on any PR touching `arb-research-api/`), starts `app.py` and hits all six routes against live data, failing if any returns a non-200 or `ok:false`. Applies the same "verify it actually works against real data on a schedule" discipline to the component this session just added, rather than only to the pre-existing tools.

I validated all three workflow YAML files parse correctly (`yaml.safe_load`) and manually ran the equivalent of each workflow's core steps locally against live data before writing this section — the outputs quoted in §2 are from those local runs, not assumed. **What I could not do from this sandbox:** actually trigger these workflows on GitHub Actions and watch them run, since that requires the repository's Actions to be enabled and a push to a branch GitHub is watching, which is outside this session's ability to do or verify from here. That is the honest boundary of "verified this session" for this section — the code has been run and shown to work; the *scheduled infrastructure* running it in GitHub's environment has not been observed to fire, only inspected for correctness. Next contributor: check the Actions tab for at least one successful scheduled run of each before trusting the automation is actually live, not just correctly written.

## 4. New process requirement: explicit handoffs, and explicit disclosure of incomplete handoffs

Added to `README.md` (see the two new standing rules following the existing README-update rule):

- Every contribution must end with a numbered, actionable handoff to the next contributor — not a vague "future work" gesture. §6 below is this contribution's handoff, written to that standard.
- If a contribution was answering a prior handoff (or any instruction) and did not complete it, it must say so explicitly, near the top, before anything else — which is what §1 and §5 of this file do for RESEARCH_17's queue.

This rule was added because the project already has a documented history of exactly this kind of silent gap being costly in a different form: contribution 04's fabricated claims went unchallenged for three contributions (05–06) before 07 caught them; the "update the README" rule exists because that got skipped before too (see the README's own admission of this). Making incomplete handoffs an explicit, required statement rather than an implicit one is the same fix applied one level up — to the process connecting contributions, not just to the claims inside them.

## 5. Explicit disclosure: RESEARCH_17's priority queue was not addressed this session

Per the rule just added in §4, stating this plainly rather than leaving readers to notice on their own: **none of RESEARCH_17 §8's four substantive queue items were worked on this session.** Specifically still outstanding, unchanged from RESEARCH_17:

1. Decoding the DeDust Pool↔Vault opcodes (`0x61ee542d`, `0x9c610de3`, `0xad4eb6f5`) via `@ton/sandbox`.
2. Extending the reserve-drift observation window to hours — **partially addressed as infrastructure, not as a finding**: `reserve-snapshot.yml` (§3.1) will build this time series automatically going forward, but as of this file being written, it has not yet run on a real schedule and produced hours of data (see §3's caveat) — there is no new drift finding to report yet, only the capability to produce one.
3. Fixing `dedust_pool_analyzer.ts`'s classifier.
4. Fixing `executor_verifier.ts`'s timeout.

This was a scope decision made at the start of the session based on the task actually given (build the API, change the process, add automation), not an oversight discovered afterward — but per §4's new rule, a deliberate scope decision that leaves a prior queue unaddressed still has to be stated, not just left for the next reader to infer from a diff.

## 6. Handoff to the next contributor (TON-ARB-RESEARCH_19)

**Do this first:**
1. Confirm at least one scheduled run of each of the three new workflows has actually succeeded on GitHub (Actions tab) — this session verified the code but not the scheduled execution (§3). If `reserve-snapshot.yml` hasn't run yet, `data/reserve_snapshots.jsonl` won't exist — don't treat its absence as a bug, treat it as "hasn't had a chance to run yet," and check the Actions history to tell the difference.
2. If snapshot data exists by the time you read this, use it: check whether the reserve-drift direction RESEARCH_17 measured over 41 minutes (moving *away* from parity) has continued, reversed, or leveled off over the longer window `reserve-snapshot.yml` has been collecting. This is the actual answer to RESEARCH_17 §8 item #2, once there's enough data — don't re-derive it from a fresh short manual snapshot when a real time series is sitting in `data/`.

**Then, in priority order, RESEARCH_17's still-outstanding queue (§5 above) stands as written:** opcode decode (P0), then the two tool fixes (P1), then the simulator cosmetic bug (P2). Fix the classifier and timeout only after the opcode decode, same reasoning RESEARCH_17 gave — a correct fix needs real protocol semantics, not another guess.

**Explicitly out of scope for you to attempt without stopping to surface it to the user first:** anything that would size, authorize, sign, or broadcast a real trade against either DEX or the executor contract. Nothing in this contribution changes that standing rule. The new API and automation exist to make the *research* faster and more continuous, not to move any project closer to unattended trading — if a future contribution is ever asked to add execution capability, that request itself should be surfaced to the user before being built, per [[ton_arb_project]], not treated as a natural next step from "the read-only tooling is solid now."

**Verify before trusting, same as always:** every number in §2 of this file is from a live run performed during this session (commands and raw-ish output are quoted, not just described) — but by the time you read this, prices and reserves have moved again. Re-fetch via `/reserves/dedust` or `/spread` rather than quoting this file's numbers as current.
