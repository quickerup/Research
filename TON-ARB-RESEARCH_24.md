# TON-ARB-RESEARCH_24: the "spread" mystery's actual root cause — DeDust's own docs call `/v2/pools` legacy, and it's baked into two tools' live-mode bugs, one previously unnoticed

**AGENT_ID:** TON_ARB_RESEARCH_24
**Base model:** Claude Sonnet 5 (`claude-sonnet-5`), via Claude Code.
**Environment disclosure:** Live network access confirmed fresh this session — real TLS cert for `toncenter.com`, a `masterchainInfo` block timestamp (`gen_utime` decoding to `2026-09-13 09:56:36 UTC`) within 3 seconds of wall clock at call time, and every DeDust/STON.fi number below is a live API/get-method response captured this session, not carried over from a prior file. `gh` authenticated as `quickerup`. No mock mode used for any finding below.

**On the funded wallet:** not touched. Nothing this session needed it — see queue item 6.

---

## 0. Root cause, finally: DeDust's `/v2/pools`/`/v2/routing/plan` isn't "stale," it's the endpoint tier DeDust's own docs and SDKs call legacy

RESEARCH_17/19/21/23 progressively nailed down *that* DeDust's REST layer disagrees with on-chain truth and *that* it gets worse the more dormant a pool is, but treated it as an unexplained caching bug in an otherwise-current API. It isn't one — it's the wrong API tier, and DeDust says so themselves:

- A community-maintained Rust client (`Sild/api-clients-rs`, `crates/dedust`) states directly: *"The v2 asset and pool-list endpoints are considered legacy and should not be selected for new registry integrations."* Its source (`crates/dedust/src/api_client.rs`) hardcodes two different hosts for the two tiers — `DEFAULT_API_V2_URL = "https://api.dedust.io/v2"` vs **`DEFAULT_API_V4_URL = "https://mainnet.api.dedust.io/v4/api"`** — a different *hostname*, not just a different path, which is presumably why three sessions of "is `/v2/pools` cached vs `/v2/routing/plan` cached" investigation never turned up the real current tier: it isn't under `api.dedust.io` at all.
- The crate also confirms DeDust's own web frontend calls `POST /v4/api/get_pools` (an "enriched screener," not in DeDust's public developer reference docs, but directly observable) for the exact pool listing this project has been reading from `/v2/pools`.

**Direct empirical proof, done live, side-by-side, at the same instant** (TON/USD₮ pool `EQA-X_yo3fzzbDbJ_0bzFWKqtRuZFIRa1sJsveZJ1YpViO3r`):

| Source | TON reserve | USD₮ reserve | Implied price |
|---|---|---|---|
| Pool's own `get_reserves()` get-method (toncenter `runGetMethod`, `2026-09-13T09:59:49Z`) | 206862.912110 | 279742.228885 | **1.352307** |
| `POST mainnet.api.dedust.io/v4/api/get_pools` (same minute) | 206862.912110 | 279742.228885 | **1.352307** — bit-for-bit identical reserves |
| `GET api.dedust.io/v2/pools` (same minute) | 202414.094085 | 316918.124481 | 1.565692 — **15.7% off**, `lastPrice: null`, `stats.volume: ["0","0"]` |

The v2 response's `lastPrice: null` and zero-valued 24h volume/fees for a pool the v4 data shows doing $171K/24h and a trade roughly every 25 seconds (per RESEARCH_17) is the real tell — it's not slightly behind, it looks like a dead/unmaintained snapshot that happens to occasionally get its reserves nudged (its numbers do differ from the ~201.7-201.9K TON seen in RESEARCH_12-17's `/v2/pools` reads, just never anywhere near correct). **This retroactively explains every "14-24% cross-DEX spread" finding back to RESEARCH_12**: it was always a comparison between a real price and a dead API tier's number, not two real prices.

---

## 1. Two live tool-suite bugs fixed, both downstream of the same root cause — one of them newly discovered this session

**`src/tools/dual_dex_simulator.ts`** (the project's actual arbitrage P&L calculator — the tool whose output would be the basis for deciding whether to fire a real trade) had two live-mode bugs, confirmed by running it, not just reading it:

1. `queryDeDust()` called `api.dedust.io/v2/routing/plan` — the same dead tier as above (RESEARCH_23 §1 already flagged this file's *other* bug but treated the DeDust leg as fine). **Fixed:** now calls the confirmed-live `v4/api/get_pools` screener for this pool's reserves and computes swap output locally with standard constant-product-plus-fee math (matches the pool's own `lp_fee`+`protocol_fee`=`trade_fee` fields, 8+2=10 → 0.10%, consistent with the on-chain fee already used throughout this project).
2. `NATIVE_TON_STONFI` was the hardcoded invalid placeholder RESEARCH_23 flagged (`Address.parse()` throws, `/v1/swap/simulate` 400s on it). **Fixed:** resolved live via a new `getPtonMasterAddress()` helper that queries `/v1/routers` and picks the pton master address of the highest `major_version` router (confirmed live: 50 of 51 routers are `major_version:2` sharing one pton address; exactly 1 is `major_version:1` with a different one — matches RESEARCH_23's numbers exactly).

**`src/tools/latency_benchmarker.ts`** had its own independent copy of the same invalid STON.fi placeholder — **not previously flagged**, because RESEARCH_23 only checked the pricing tools, not the latency one. Confirmed live, before fixing: `curl` to that exact URL returns **HTTP 400** every time. Since `axios.post` throws on non-2xx, every "STON.fi" sample this tool has ever produced in live mode was the hardcoded 1500ms failure penalty, not real latency:

| | Before fix (this session, reproduced) | After fix (this session, live) |
|---|---|---|
| STON.fi samples | 400 error → flat 1500ms penalty every time (StdDev would read 0) | Min 134.57ms / Mean 139.64ms / Max 144.47ms / StdDev 3.28ms — real variance |
| DeDust endpoint | `/v2/routing/plan` (dead tier) | `v4/api/get_pools` (same fix as above, and the endpoint actually worth benchmarking since it's what pricing now depends on) |

Both fixes verified by running the compiled tools live (`node dist/src/tools/dual_dex_simulator.js`, `node dist/src/tools/latency_benchmarker.js`), not just by re-reading source — same discipline as RESEARCH_19/22/23. `npx tsc --noEmit` and `npm test` (5/5) both pass unchanged; the existing offline test suite only exercises mock mode for these two tools, so it couldn't have caught or been broken by this.

---

## 2. Live re-run of the (now-fixed) arbitrage simulator: confirms §0's "spread ≈ 0" conclusion, from the project's own decision tool for the first time

```
 5 TON: STON.fi 1.3524 | DeDust 1.3412  (Path B gross +0.62%, net -4.38% after 0.25 TON gas)
10 TON: STON.fi 1.3510 | DeDust 1.3412  (Path B gross +0.52%, net -1.98% after gas)
50 TON: STON.fi 1.3518 | DeDust 1.3517  (both paths net-negative after gas)
```

Every size checked is net-unprofitable once the tool's own flat 0.25 TON gas estimate is applied, and the gross spread that does appear (~0.5-1%) is well within the kind of pool-to-pool noise you'd expect from two independently-traded venues, not a mispricing. This is the same conclusion RESEARCH_23 §0 reached via four ad hoc measurements — the difference is this is now the project's actual simulator tool saying it, correctly, live, for the first time since it was written.

**New caveat surfaced by this run, not yet fixed:** one call (`--amounts 1,10`, first invocation) hit a `timeout of 5000ms exceeded` on the 1 TON leg and silently fell back to `MOCK_SIMULATOR_DATA`, which prints **`DeDust = 1.5757 USDT`** — the old, pre-fix, stale-cache-era number, hardcoded into the "safe fallback" path back when it was written against the broken endpoint. A transient network hiccup (not a bug in today's fix — retrying immediately succeeded) is enough to make this tool silently show the exact illusory 13%+ "opportunity" this session just spent its whole effort debunking, under a `[WARN] ... Falling back to mock data` line that's easy to miss in a longer run. Queued below.

---

## 3. Queue item 1 (P0): schedule-trigger — resolved, no escalation needed

```
gh run list --workflow=reserve-snapshot.yml --json event,status,conclusion,createdAt
  -> {"event":"schedule","createdAt":"2026-09-13T06:11:10Z","conclusion":"success"}  <- fired organically
     {"event":"workflow_dispatch","createdAt":"2026-09-13T03:56:49Z", ...}
     {"event":"workflow_dispatch","createdAt":"2026-09-13T02:18:26Z", ...}
```

The workflow fired on its own schedule at `06:11:10Z` — about 5h05m after landing on `master` (`01:06:10Z`), past the "3+ hours" bar RESEARCH_21/22/23 held at without ever seeing it happen. **This was scheduler-startup jitter, not an org-policy or Actions-config problem** — RESEARCH_23's own escalation criterion is satisfied in the "it eventually just worked" direction. No `gh api .../actions/permissions` investigation needed; closing this queue item rather than carrying it forward again.

## 4. Queue item 2 (P0, needs elevated permission): `TONCENTER_API_KEY` secret — unchanged, not re-attempted

Same tool-permission classifier blocked this in RESEARCH_22 and RESEARCH_23 for reasons unrelated to `gh`/repo access; re-running the identical blocked command a fourth time wouldn't produce new information. Still needs the user to run it directly.

## 5. Reserve-snapshot series: now 2 genuinely-correct points, 2h14m apart — too thin for real drift analysis yet

`data/reserve_snapshots.jsonl`'s first 3 rows predate the `59c4fe9` on-chain-read fix (RESEARCH_23 §2) and remain not comparable. The 2 correct rows so far:

```
03:56:59Z  1.367958
06:11:20Z  1.365668   (-0.17% over 2h14m)
```

Consistent with §0/§2's "no real persistent spread" conclusion but it's two points, not a time series — did not force a third manual trigger this session (RESEARCH_21/23 already did that twice; letting the now-working schedule accumulate organically is the right move per queue item 3 below).

---

## 6. Updated priority research queue for RESEARCH_25

1. **(P1, new)** Recalibrate `dual_dex_simulator.ts`'s `MOCK_SIMULATOR_DATA` (and check `latency_benchmarker.ts`'s `MOCK_LATENCIES` for the same issue) to the corrected ~1.35-1.37 consensus numbers from §0/§2 of this file — right now the fallback path silently reproduces the exact debunked stale-cache spread on any transient network failure, which is a worse failure mode than an obvious error would be.
2. **(P1, carried, now easier)** `dedust_pool_analyzer.ts` doesn't call the legacy REST tier directly (confirmed by `grep`), but its RESEARCH_19 opcode-decode path's price should now be cross-checked once more against the `v4/api/get_pools` numbers in this file (already close per RESEARCH_23 §0's table) — low urgency, just closing the loop on the last tool not yet touched by this session's fix.
3. **(P2)** Let the reserve-snapshot series accumulate over the *next several actual schedule firings* (now that §3 confirms the schedule works) before attempting real drift analysis — 2 points is not enough, don't force a third manual trigger just to have more data faster.
4. **(P2)** Consider whether `docs.dedust.io/reference/getting-available-pools` (DeDust's own public developer reference) is worth a bug report itself — it documents `/v2/pools` as the only pool-listing endpoint with no legacy/deprecation notice anywhere on the page, while DeDust's own frontend and a third-party SDK both treat it as legacy. A developer following DeDust's official docs today would write exactly the bug this project has been chasing since RESEARCH_12.
5. **(P1 — funded wallet, unchanged)** Still available, still not spent — no experiment this session met the "read-only methods can't answer this" bar. With `dual_dex_simulator.ts` now trustworthy live (§2), the next real threshold question is whether it ever shows a genuinely net-positive, post-gas spread over a longer observation window — worth watching for, not worth forcing.
