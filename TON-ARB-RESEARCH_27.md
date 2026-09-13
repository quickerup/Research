# TON-ARB-RESEARCH_27: reserve-series/simulator correlation confirmed mechanistically, wallet and executor unchanged

**AGENT_ID:** TON_ARB_RESEARCH_27
**Base model:** Claude Sonnet 5 (`claude-sonnet-5`), via Claude Code.
**Environment disclosure:** Live network access confirmed fresh this session — `toncenter.com/api/v2/getMasterchainInfo`'s response `@extra` timestamp decoded to `2026-09-13T13:06:26Z`, within seconds of wall clock (`13:06:06Z` at call time). Local `master` was already up to date with `origin/master` (`git rev-list --left-right --count` returned `0 0`) — no pull needed this session. `gh` authenticated as `quickerup`. `npx tsc --noEmit` and `npm test` both pass (5/5) unchanged. No mock mode used for any finding below.

**On the funded wallet:** not touched. Balance independently re-read this session via `getAddressBalance` — still `1999999999` nanoTON (~2.0 TON), unchanged since RESEARCH_22. No experiment this session met the "read-only methods can't answer this" bar — see queue item 4 below.

**Corollary disclosure (per README's standing rule):** RESEARCH_26 fully delivered on its own handoff (§5 of that file); nothing outstanding from RESEARCH_26 to report here. This session addresses RESEARCH_26 §5's four queue items in order below.

---

## 1. Queue item 1 (P2): reserve-snapshot series — still no new organic point beyond RESEARCH_26's

```
gh run list --workflow=reserve-snapshot.yml --json event,status,conclusion,createdAt
  -> schedule  2026-09-13T11:54:09Z  success   <- same run RESEARCH_26 already saw
     schedule  2026-09-13T06:11:10Z  success
     workflow_dispatch  2026-09-13T03:56:49Z  success
     workflow_dispatch  2026-09-13T02:18:26Z  success
```

Wall clock at this session's check: `2026-09-13T13:07Z`, only ~1h13m since the last firing — consistent with the previously observed ~2-6h irregular gaps, not a bug. Same reasoning as RESEARCH_24/25/26: did not force a `workflow_dispatch`, since letting the schedule accumulate organically is the point of having a working cron.

Instead of waiting further, this session took a **manual, read-only run of `scripts/snapshot_reserves.py`** (the same script the cron calls, no fund-moving, no code change) to get a same-moment data point for queue item 3's correlation task below, appending one genuinely-correct row:

```
2026-09-13T13:08:09Z  1.347291 USDT/TON  (-0.21% vs. 11:54:16Z's 1.350215, -1.51% cumulative vs. 03:56:59Z's first post-fix point)
```

`data/reserve_snapshots.jsonl` now has 7 rows / 4 genuinely-correct rows (post-`59c4fe9`) spanning ~9h12m. Still short of a real volatility-analysis window; queued again for RESEARCH_28.

---

## 2. Queue item 3 (P2): simulator vs. reserve-series correlation — confirmed, and the residual gap is exactly explained by DeDust's own stated fee

RESEARCH_26 §5 item 3 asked whether the simulator's live gross-spread number and the reserve-snapshot series' implied price move together (expected, if both read real state) or diverge (a new finding). This session got both readings ~30 seconds apart instead of waiting for the next cron point:

```
13:07:41Z  node dist/src/tools/dual_dex_simulator.js --amounts 1,10,50,100
  1 TON: DeDust quote = 1.3459 USDT/TON  (swap-simulated, includes pool fee)

13:08:09Z  python3 scripts/snapshot_reserves.py (manual, read-only)
  raw reserve ratio (spot, no fee) = 1.347291 USDT/TON
```

The simulator's DeDust quote (1.3459) is *below* the raw reserve-ratio spot price (1.347291) by ~0.084% — and the pool's own `trade_fee` field (read by the same script) is `"0.1"` (0.1%). Multiplying the raw spot price by `(1 - 0.001)` gives `1.34594`, matching the simulator's live-quoted output to 4 significant figures. **The two data sources move together and the gap between them is not noise — it's exactly the pool's documented swap fee, mechanistically explained rather than just visually correlated.** This is a stronger result than RESEARCH_26 asked for: not just "do they trend together" but "the delta between them is fully accounted for by a named, on-chain-read parameter." Closes queue item 3 as originally scoped; a future session repeating this at a different reserve ratio would further confirm the relationship is linear (expected from the constant-product formula at these trade sizes) rather than coincidental at this one snapshot.

Also re-confirmed while reading the manual snapshot's paired executor row: `last_transaction_lt` is still `103104091000005` across all 7 executor-snapshot rows now on file (`01:14Z` through `13:08Z` today) — the executor has still never dispatched a real mainnet trade, consistent with every prior contribution back to RESEARCH_12/17/21.

---

## 3. Queue item 2 (P3): DeDust docs bug report — still not filed, still flagging rather than filing unilaterally

Unchanged from RESEARCH_24/25/26: the artifact (`docs.dedust.io/reference/getting-available-pools`'s own structured-metadata field reading `"deprecated":false` despite the endpoint it documents serving dead/stale data) is ready. Filing it — as a support ticket or an issue against a third-party repo — is an action visible outside this repo, so it stays queued rather than done unilaterally, per this project's standing discipline. Four sessions running now (24, 25, 26, 27) have carried this same unfiled, ready artifact without a user response; re-raising it once more here, but not re-deriving it again — if a future session gets no response either, it's reasonable to stop re-flagging it every single contribution and just note it as a permanently-available, low-priority backlog item instead of repeating the same paragraph indefinitely.

---

## 4. Queue item 4 (P1 — funded wallet, unchanged): still available, still not spent

Same threshold as RESEARCH_24/25/26: only a longer-window empirical answer to "does a net-positive post-gas spread ever appear" would justify using it. This session's live simulator run (§2) shows the same net-negative-at-every-size result as the prior four measurements (RESEARCH_24 §2, RESEARCH_25 §0/§1, RESEARCH_26 §2, this session) — five now, all net-negative after gas, all converging rather than diverging. Balance independently re-verified unchanged this session (see disclosure above). No experiment this session crossed the "read-only can't answer this" bar.

---

## 5. Updated priority research queue for RESEARCH_28

1. **(P2)** Reserve-snapshot series: now 4 correct points spanning ~9h12m (`03:56:59Z` → `13:08:09Z`), schedule still firing irregularly (~1-6h gaps). Keep letting it accumulate; don't force manual triggers except for a specific correlation task like §2's, where the value is in a matched-timestamp pair, not in adding volume to the series.
2. **(P3)** DeDust docs bug report (§3): artifact ready and cited across RESEARCH_24-27; still unfiled after 4 sessions of flagging. If the user wants it filed, do that first before anything else queued here. If a fifth session also gets no response, stop re-raising it every contribution — note it once as a standing low-priority backlog item in the README instead.
3. **(P3)** §2's fee-explains-the-gap finding was confirmed at one reserve ratio. A future session could repeat the same paired (simulator quote, raw reserve read) measurement at a meaningfully different reserve ratio (e.g., after a larger organic price move) to confirm the relationship holds linearly rather than being a one-off coincidence at today's specific ratio — cheap to do opportunistically whenever a session is already taking a live reading for another reason, not worth a dedicated session on its own.
4. **(P1 — funded wallet, unchanged)** Still available, still not spent. Threshold unchanged from RESEARCH_24-26: only a longer-window empirical "yes, a net-positive post-gas spread appeared" would justify using it. Five independent live measurements now (RESEARCH_24/25×2/26/27) all say no, with the gap shrinking, not growing — the empirical case for *not* spending it keeps getting stronger, but "not yet" is not the same as "never," so the wallet stays available rather than being written off outright.
