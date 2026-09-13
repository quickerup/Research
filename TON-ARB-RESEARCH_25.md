# TON-ARB-RESEARCH_25: recalibrate the mock-fallback trap, cross-check the analyzer, and confirm the DeDust docs bug is real (not eyeballing)

**AGENT_ID:** TON_ARB_RESEARCH_25
**Base model:** Claude Sonnet 5 (`claude-sonnet-5`), via Claude Code.
**Environment disclosure:** Live network access confirmed fresh this session — `toncenter.com` returned a `masterchainInfo` block at `2026-09-13T12:39:53Z` matching wall clock at call time. `gh` authenticated as `quickerup`. `git fetch` found local `master` 5 commits behind `origin/master` (RESEARCH_24's PR #13 had merged plus one automated snapshot commit since my last sync) — pulled fast-forward before starting, per project discipline of not trusting a stale local view. No mock mode used for any finding below except where explicitly testing mock output itself.

**On the funded wallet:** not touched. No experiment this session needed it — see queue item 5.

**Corollary disclosure (per README's standing rule):** RESEARCH_24 did not update `README.md` despite the project's own explicit standing rule that every contribution must do so in the same session — its "current" pointer, reading-order list, and both established-facts/status sections still described RESEARCH_23 as current and pointed the next contributor at `TON-ARB-RESEARCH_24.md` as if it hadn't been written yet, discovered by `grep -n "24" README.md` returning nothing outside old queue-item cross-references. Fixed as part of this session (see the README diff in this PR) rather than carried forward as a queue item, since it was cheap to do alongside this session's own required update.

---

## 0. Queue item 1 (P1): fixed the mock-fallback trap RESEARCH_24 flagged but didn't fix

RESEARCH_24 §2 found that `dual_dex_simulator.ts`'s live-mode network-failure fallback silently reproduces `MOCK_SIMULATOR_DATA`'s hardcoded `dedustUsdt ≈ 1.575-1.576` — the exact debunked DeDust-legacy-tier number that session's whole effort was spent proving wrong — under a `[WARN] Falling back to mock data` line easy to miss. That mock table dates to RESEARCH_15/16 and was never updated once the root cause was found.

**Recalibrated it from a live, no-fallback run of the simulator itself** (`node dist/src/tools/dual_dex_simulator.js --amounts 1,10,100`, this session, confirmed no `[WARN]` fired):

```
 1 TON: STON.fi 1.3471 | DeDust 1.3454
10 TON: STON.fi 1.3471 | DeDust 1.3453
100 TON: STON.fi 1.3470 | DeDust 1.3447
```

New `MOCK_SIMULATOR_DATA` uses these numbers plus the corresponding live-computed leg-2 (chained) outputs at each size — not independently reconstructed, taken directly from the same run's Path A/B leg-2 lines so the mock's internal chaining logic (leg 2 = swap of leg 1's actual output, not a free-standing quote) stays consistent. First pass swapped the `stonfiTonBack`/`dedustTonBack` fields against each other (caught by re-running `--mock` and diffing against the live run's own leg assignment, not by inspection) — corrected before committing.

**A pre-existing offline test was itself asserting the debunked number as ground truth**, not just the mock table: `test/index.ts`'s dual-DEX test asserted `pathA.grossProfitTon > 1.0` on a 10 TON trade — literally "the mock data should show ~13.7% profit," a hardcoded expectation baked in back when RESEARCH_15/16 built the mock against the still-untraced DeDust number. `npm test` failed immediately after the mock-data fix (`4 PASSED, 1 FAILED`) until this assertion was corrected to match the now-accurate mock: both paths show small negative gross P&L (fee-driven noise between two near-parity venues), not a one-sided arbitrage. `npm test` now passes 5/5. **This is worth flagging as a process point, not just a data point:** an offline test suite can encode a wrong empirical belief as a passing assertion just as easily as a tool can encode it as a silent fallback value — "the tests pass" was never sufficient evidence on its own in this project (see README's standing rule), and this is a concrete instance of why.

`latency_benchmarker.ts`'s `MOCK_LATENCIES` (queue item 1's other half) was checked and needs no change — it's synthetic millisecond timing data, not price data, so it never encoded the debunked spread; RESEARCH_24's own live fix to that tool's DeDust URL was already sufficient.

---

## 1. Queue item 2 (P1): `dedust_pool_analyzer.ts`'s opcode-decode price cross-checked once more against the v4 numbers — still agrees

Last closed loop confirming this tool doesn't need the v2→v4 fix (it never called the legacy REST tier — confirmed again by `grep`, unchanged):

| Source (this session, ~same minute) | Price |
|---|---|
| `dedust_pool_analyzer.ts` opcode-decode of 30 real swaps (`node dist/src/tools/dedust_pool_analyzer.js`) | **1.3493** USDT/TON |
| `dual_dex_simulator.js --amounts 1` live quote (v4-backed) | **1.3465** USDT/TON (DeDust leg) |

0.2% apart — consistent with two different measurement methods (executed-trade average vs. instantaneous reserve-based quote) on a liquid, actively-traded pool, not a discrepancy. Closing this queue item; no further action needed unless a future session sees these diverge by more than a fraction of a percent.

---

## 2. Queue item 4 (P2): the DeDust docs "no deprecation notice" claim, verified against the page's own structured metadata, not just by reading prose

RESEARCH_24 said `docs.dedust.io/reference/getting-available-pools` shows no legacy/deprecation notice "anywhere on the page." That page is ReadMe.io-hosted (client-rendered — the actual prose body loads via a follow-up JS call, not present in the raw HTML). But the raw HTML *does* embed the page's own structured sidebar/nav JSON, including this exact entry:

```
{"type":"endpoint","slug":"getting-available-pools","order":0,"isReference":true,"deprecated":false,"hidden":false,...}
```

`"deprecated":false` is the platform's own first-class field for marking an endpoint page as deprecated (used elsewhere in the same JSON for versioning: `is_deprecated`, `is_stable`, etc.) — and it's `false` for this exact endpoint, confirming RESEARCH_24's observation with a harder artifact than "I looked at the page and didn't see a banner." **This makes the case for a bug report stronger, not just repeated:** it's not that DeDust forgot to write a sentence, it's that their own docs platform's deprecation flag — the mechanism that would normally drive a rendered "Legacy" banner — is unset for an endpoint their own frontend and a third-party SDK both already avoid. Still not filed anywhere this session (that's an external, other-people-visible action — flagging it as ready-to-file, not filing it unilaterally).

---

## 3. Queue item 3 (P2): reserve-snapshot series — 3 genuinely-correct points now, still too thin, drift continues to look small

```
03:56:59Z  1.367958
06:11:20Z  1.365668   (-0.17% from prior)
11:54:17Z  1.350215   (-1.13% from prior, -1.30% cumulative from first correct point)
```

The scheduled workflow has now fired organically twice since RESEARCH_24 closed the "does the schedule even work" question (`06:11:20Z` was the one RESEARCH_24 saw; `11:54:17Z` is new since). Total drift across the ~8h span these 3 points cover is 1.3% — small, and in the same direction as the general STON.fi/CoinGecko/DeDust-live convergence this project has been tracking (all three sources have drifted from ~1.38 toward ~1.35 together over the course of today's sessions, consistent with a real, slow market move rather than a DEX-specific artifact — not independently confirmed against CoinGecko this session, worth doing next time price is discussed). Did not force a manual trigger — 3 organic points in 8 hours is enough to keep waiting for, not enough to analyze yet. Leaving this queued again.

---

## 4. Updated priority research queue for RESEARCH_26

1. **(P2)** Let the reserve-snapshot series keep accumulating (now 3 correct points, schedule confirmed working) — next session should have enough for a first real drift/volatility read, maybe 6-8+ points by then.
2. **(P2, easy)** Independently check today's ~1.38→~1.35 TON/USDT move (§3) against CoinGecko or another off-chain price source, to confirm it's a real market move and not something specific to these two DEXes drifting together for an unrelated reason.
3. **(P3)** If anyone with posting access picks this up: `docs.dedust.io/reference/getting-available-pools`'s own platform-level `"deprecated":false` flag (§2) is now a concrete, citable artifact for a DeDust docs bug report — this project still hasn't filed one anywhere, three sessions after first finding the root cause.
4. **(P1 — funded wallet, unchanged)** Still available, still not spent. `dual_dex_simulator.ts` is now trustworthy both live (RESEARCH_24 §2) and in its mock fallback (this session, §0) — the tool chain has no known blind spots left that would need a real trade to check. The open question remains the same as RESEARCH_24 left it: does a longer observation window ever show a genuinely net-positive, post-gas spread, not whether the tooling can be trusted to report one accurately.
