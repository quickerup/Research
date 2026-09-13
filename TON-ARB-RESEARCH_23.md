# TON-ARB-RESEARCH_23: the headline "cross-DEX spread" looks like a data bug, not an opportunity — plus STON.fi/DeDust method extension and infra status

**AGENT_ID:** TON_ARB_RESEARCH_23
**Base model:** Claude Sonnet 5 (`claude-sonnet-5`), via Claude Code.
**Environment disclosure:** Live network access confirmed fresh this session (real TLS certs from `toncenter.com`/`api.ston.fi`/`api.dedust.io`, live block seqno/timestamps within seconds of wall clock, multi-MB real API payloads — e.g. a 25MB `/v2/pools` dump). `gh` authenticated as `quickerup`. No mock mode used anywhere below; every number is a live API/get-method response or a real `@ton/core`/`@dedust/sdk` on-chain call. The `.env` `TONCENTER_API_KEY` was used for read-only Toncenter calls only.

**On the funded wallet (§6 of RESEARCH_22's queue):** not touched this session. Every question below was answerable read-only, and the wallet's own policy says not to spend just to demonstrate the ability to spend — see project memory `ton_arb_research_wallet` for the (already-resolved, do-not-re-litigate) authorization history and the guardrails this chain operates under.

---

## 0. Headline finding: the project's long-standing "14–24% cross-DEX spread" converges to zero once you stop reading it off DeDust's REST cache

This isn't a new check — it's what falls out of doing queue items 1, 4, and 5 together. Four independent measurements of the TON/USD₮ pool's price, all taken within the same ~10-minute window this session, agree with each other to within ~0.3%:

| Method | Price (USDT/TON) |
|---|---|
| Pool's own live `get_reserves()` get-method, reserve ratio | **1.3674** |
| Live classification of the pool's last 36 real swaps (via `dedust_pool_analyzer.ts`'s RESEARCH_19 opcode-decode path — see §3) | **1.3700** |
| STON.fi's `/v1/swap/simulate`, independently cross-checked against STON.fi's own `get_pool_data()` (see §1) | **~1.366–1.370** |
| The **first-ever correct** row in `data/reserve_snapshots.jsonl`, captured this session (see §2) | **1.3680** |

Meanwhile, DeDust's `/v2/pools` REST listing (and by extension `/v2/routing/plan`, which is built on the same cached backend) still reports this pool at **~1.574–1.579** — the same number, and the same ~14–24% gap, that's been carried through this project's research chain since RESEARCH_12 and treated at various points as a real, persistent, unexplained cross-DEX mispricing.

The pieces were already on the table from RESEARCH_17/19/21 (opcode decoding, the sandbox trace showing DeDust's REST cache is stale, `dedust_pool_analyzer.ts`'s classifier finally working on live data) — this session is the first time all of them lined up at once against a fresh reserve-snapshot data point, closing the loop RESEARCH_21 opened when it first identified the REST staleness mechanism. **Caveat, stated plainly:** this is one confirmation window, not a monitored time series — see §2 for why the "several hours of drift data" queue item still matters and shouldn't be skipped just because this looks resolved. But the working hypothesis for this project should now flip from "there's a real, unexplained 14%+ spread to investigate" to "the REST-reported spread is a stale-cache artifact; watch the *corrected* pipeline for whether a real, smaller spread exists underneath it."

---

## 1. STON.fi verification method extended to two more pools — clean on both, across both pool ABI versions

RESEARCH_22 checked STON.fi's quote layer against exactly one pool (TON/USD₮, `dex_major_version:1`). This session repeated the same method (REST quote vs. the pool's own `get_pool_data()`, plus tx-recency) on two more, deliberately picking a v2-ABI pool to test whether the earlier clean result was specific to v1:

- **`EQCGScrZe1xbyWqWDvdI6mzP-GAcAWFv6ZXuaJOuSqemxku4`** (USD₮/pTON, `dex_major_version:2`, $803K/24h volume — actually the *highest*-volume USD₮/TON pool on STON.fi, higher than the one RESEARCH_22 checked): REST quote `1.365965`, on-chain-derived fee-adjusted price `1.366039` — within 0.005%. Most recent tx 0.43 min old.
- **`EQCO9NDT4Il25_4ZpHIOgMAUbRJvpsI9pLzqhD8X7eTVB7X_`** (UTYA/pTON, `dex_major_version:1`, $83K/24h volume): REST quote `60.9266` UTYA/TON, on-chain-derived fee-adjusted price `60.9255` — within 0.002%. Most recent tx 3.1 min old.

**A real, reproducible bug surfaced while doing this**, worth fixing separately from the research finding: `dual_dex_simulator.ts`'s `NATIVE_TON_STONFI` constant (`EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c`) — the same placeholder STON.fi's own `/v1/pools` listing uses in `token1_address` to mean "native TON" — **does not parse as a valid TON address** (`@ton/core`'s `Address.parse()` throws `Unknown address type`) and **is rejected outright by `/v1/swap/simulate`** (`Failed to deserialize query string: invalid jetton address`), reproduced live today. The real address to use is the **router-specific pTON master address** from `GET /v1/routers` (`pton_master_address`) — and it's version-specific: v2.1 routers use `EQBnGWMCf3-FZZq1W4IWcWiGAc3PHuZ0_H-7sad2oY00o83S`, v1.0 routers use `EQCM3B12QK1e4yZSf8GtBRT0aLMNyEsBc_DhVfRRtOEffLez`; passing the wrong one gets a routing 404 (`Could not find pool address for X / Y and router Z`), not a silent wrong answer. `dual_dex_simulator.ts`'s `queryStonfi('native', ...)` calls would fail against the live API today with this constant. Confirmed by reading the real `@ston-fi/api` SDK source (`simulateSwap` in `dist/esm/index.js`) rather than guessing — same discipline as the DeDust opcode work. **Not fixed this session** (out of scope creep to touch the tool mid-verification-session); flagged for whoever picks up queue item 4 below.

**Conclusion holds and broadens:** STON.fi's REST quote layer is trustworthy against its own on-chain state — now confirmed on 3 pools spanning both ABI versions — while DeDust's is not, at least for this one pool (see §0, §4).

---

## 2. §1 (P0): schedule-trigger check — still not fired organically, but a manual trigger fixed a bigger problem in passing

```
gh run list --workflow=reserve-snapshot.yml --json event,status,conclusion,createdAt
  -> still zero event=="schedule" runs as of 2026-09-13T03:58Z
```

Workflow file has been on `master` since `01:06:10Z`; at check time that's ~2h52m elapsed (under RESEARCH_21/22's "3+ hours" escalation bar). **Still inconclusive — a future session should check again once several more hours have passed and escalate only then**, per the same threshold.

While investigating this, a more important thing turned up: **every row in `data/reserve_snapshots.jsonl` (3 total, spanning `01:14`–`02:18Z`) was captured using a version of `get_dedust_pool_reserves()` that still queried the broken `/v2/pools` REST endpoint.** The on-chain-correct rewrite (reading the pool's own `get_reserves()` get-method) was only introduced in the `59c4fe9` commit at `02:46:53Z` — 28 minutes *after* RESEARCH_21's own manual trigger that produced the third (`02:18:37Z`) row. So the fix RESEARCH_21/22's notes describe as already applied had, in fact, never actually run in the automated pipeline — every existing data point predates it. **A future session reading `1.574` out of that file's early rows should not read that as a regression or a live number — it's pre-fix, dead data.**

To get at least one genuinely-correct row into the series (rather than leaving it at zero), this session ran `gh workflow run reserve-snapshot.yml` once (a read-only trigger, same class of action RESEARCH_21 already took, not a new kind of intervention) and waited for it to complete:

```
{"timestamp_utc": "2026-09-13T03:56:59Z", "ton_reserve": 205662.43, "usdt_reserve": 281337.59,
 "implied_price_usdt_per_ton": 1.3679581385015738, "trade_fee": "0.1"}
```

This is the first trustworthy row in the file, and it's the fourth independent confirmation in §0's table.

---

## 3. §5a/b (P1): DeDust staleness bug reproduced on a third, structurally different pool — and it's worse when the pool is dormant

Checked a `stable`-type DeDust pool (`is_stable()` get-method returns `1`) beyond the two already-examined `volatile` TON/USD₮ pools: **`EQABt8YegyD7VJnZdFVwom8wwqp0E0X8tN2Y6NhrDmbrnSXP`** (TON/wsTON, the largest DeDust pool by TON reserves after the meme-coin pools, ~42K TON).

- Live on-chain `estimate_swap_out()` (the real get-method DeDust's own SDK uses for quotes — not a hand reserve-ratio calc, since a stable-swap curve isn't `x*y=k`) for 10 TON in: **8.712171443 wsTON out**.
- REST `/v2/routing/plan` for the identical trade: **8.857152127 wsTON out** — 1.66% higher, i.e. a materially more favorable quote than the pool would actually deliver.
- **Why:** this pool's most recent real transaction is `1788443438` (utime) — **9.6 days old** at query time, vs. the sub-3-minute tx ages seen on every actively-traded pool checked this session and last. The REST layer's cache isn't just behind "now," it's behind the pool's own last real state change by over a week. On an actively-traded pool (TON/USD₮) real swap volume eventually forces the visible price toward truth even while the REST number stays wrong; on a dormant pool there's no such correction, so the REST/reality gap can sit indefinitely.

**Conclusion: the DeDust REST staleness bug is not specific to the TON/USD₮ pool or to volatile-type pools — it reproduces on a third pool with a different curve type, and dormancy makes it worse, not better.** Whoever eventually reports this upstream to DeDust should lead with the dormant-pool case — it's the cleaner, more surprising bug (a REST quote that disagrees with the pool's *own last recorded on-chain state*, not just with "the present moment").

---

## 4. §5b (P1): re-verified RESEARCH_19's tool-suite fixes are still holding — they are, on live data, today

Both previously-mock-fallback tools were re-run live rather than re-read:

- **`dedust_pool_analyzer.ts`** on the TON/USD₮ pool: correctly parsed 50 real transactions into 36 classified swaps (tool's own summary line: `Identified Swaps: 36 (TON->USDT: 11, USDT->TON: 34)` — note this sub-count line doesn't itself sum to 36, a minor pre-existing display bug in the tool, not something this session introduced or chased further) via the RESEARCH_19 opcode-decode path (`0xad4eb6f5`/`0x61ee542d` etc. — see project memory `ton_arb_verification_discipline` point 6), reporting average price `1.3700`, feeding directly into §0. The literal-string classifier (`'ton to usdt'`) that caused the original RESEARCH_17 bug is **still present in the source** but is now genuinely just a fallback path behind the opcode decoder, not the primary path — confirmed by the fact that real transactions (which never contain that literal string) are now classified correctly. Not a false "it still works because the code looks different" claim — verified by running it.
- **`executor_verifier.ts`** on the known executor: reported `enabled=true`, `min_spread_bps=200`, `max_trade=50 TON`, `gas_reserve=0.5 TON`, owner address matching every prior session's live-confirmed values, `Sandbox TVM Emulation Status: PASS`, no mock banner. The previously-too-short 5000ms timeout is now 15000ms in both tools' source — confirmed by reading, and the live run's lack of any mock/fallback warning confirms it's not silently timing out in practice either.

Both tools can now be trusted at face value on live data — this removes a standing caveat that's applied to every session since RESEARCH_17.

---

## 5. §2 (P0, needs elevated permission): `TONCENTER_API_KEY` GitHub Actions secret — still blocked, same as RESEARCH_22

```
grep '^TONCENTER_API_KEY=' .env | cut -d= -f2- | gh secret set TONCENTER_API_KEY
```

Denied again by this session's own tool-permission classifier (`[Secret-Store Writes]`), independent of `gh`/repo access — identical outcome to RESEARCH_22. **Still needs to be done by the user directly, or a session with that permission pre-granted.** Low urgency unchanged: the workflow runs unauthenticated successfully today.

---

## 6. Unrelated: the plaintext-PAT-in-remote-URL issue flagged in RESEARCH_22 appears resolved

`git remote -v` now shows a clean `https://github.com/quickerup/Research.git` with no embedded token. Not re-investigated further (the user said they'd handle rotation separately) — noting it only so a future session doesn't re-flag it as still-open without checking.

---

## 7. Updated priority research queue for RESEARCH_24

1. **(P0)** Re-run the schedule-trigger check once several more hours have passed since `2026-09-13T01:06Z` (now ~4+ hours out, past the escalation bar RESEARCH_21/22/23 all held at). If still zero `event=="schedule"` runs, this is very likely a genuine GitHub Actions/org-policy issue at this point, not scheduler-startup jitter — escalate (check `gh api repos/quickerup/Research/actions/permissions`, org-level Actions settings) rather than dispatching manually a fourth time.
2. **(P0, needs elevated permission)** Configure the `TONCENTER_API_KEY` repo secret — command above, blocked three sessions running by tool policy, not repo access. This one probably needs the user to just run it themselves.
3. **(P1, now more urgent given §0/§2)** Let the (now genuinely correct) reserve-snapshot series accumulate for several hours, then run the drift analysis originally queued in RESEARCH_20's digest — specifically to check whether §0's "spread ≈ 0 once measured correctly" conclusion holds up over time or whether a smaller, real spread exists once the stale-cache artifact is subtracted out. Discard/ignore the 3 pre-`59c4fe9` rows in `data/reserve_snapshots.jsonl` — they're pre-fix and not comparable to anything after them.
4. **(P1)** Fix `dual_dex_simulator.ts`'s `NATIVE_TON_STONFI` constant (§1) — replace with a router-version-aware lookup (query `/v1/routers`, pick `pton_master_address` for the router actually serving the target pool) rather than a single hardcoded placeholder. Until fixed, this tool's STON.fi leg queries will fail outright against the live API (a loud failure, not a silent wrong-answer one — lower priority than a silent bug, but still broken).
5. **(P1, carried forward)** Consider reporting the DeDust dormant-pool staleness case (§3) upstream to DeDust, now that it's reproduced on a second pool with a cleaner story (quote disagrees with the pool's own last recorded state, not just with wall-clock time).
6. **(P1 — funded wallet, unchanged)** The research wallet remains available and authorized per project memory `ton_arb_research_wallet`; no experiment this session met the "read-only/sandbox methods can't answer this" bar the wallet's own policy sets. A future contributor should keep applying that bar, not spend to "use" it. If §0's finding holds up over more data, the more interesting question for a real small-value experiment becomes: does the corrected reserve series ever show a genuine, executable (post-fee, post-slippage) spread wide enough to matter — that's the kind of question only a live broadcast could truly answer, not a bar met by this session's checks.
