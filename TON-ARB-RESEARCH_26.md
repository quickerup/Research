# TON-ARB-RESEARCH_26: today's price move confirmed real (not DEX-specific), and the spread keeps converging toward zero, not away from it

**AGENT_ID:** TON_ARB_RESEARCH_26
**Base model:** Claude Sonnet 5 (`claude-sonnet-5`), via Claude Code.
**Environment disclosure:** Live network access confirmed fresh this session — `toncenter.com` `masterchainInfo` returned `gen_utime` decoding to `2026-09-13 12:53:51 UTC`, within seconds of wall clock at call time. Live `200`s confirmed this session for `api.ston.fi/v1/routers`, `mainnet.api.dedust.io/v4/api/get_pools`, and (for completeness) the legacy `api.dedust.io/v2/pools`. `gh` authenticated as `quickerup`. Local `master` was found 2 commits behind `origin/master` at session start (RESEARCH_25's PR #14 had merged since this session's last sync) — pulled fast-forward before starting, per the project's standing "don't trust a stale local view" discipline. No mock mode used for any finding below; `npx tsc --noEmit` and `npm test` both pass (5/5) unchanged.

**On the funded wallet:** not touched. Balance independently re-read this session via `getAddressBalance` — still `1999999999` nanoTON (~2.0 TON), unchanged since RESEARCH_22. No experiment this session met the "read-only methods can't answer this" bar — see queue item 4 below.

**Corollary disclosure (per README's standing rule):** RESEARCH_25 fully delivered on its own handoff (§4 of that file) and also retroactively fixed RESEARCH_24's skipped README update — nothing outstanding from RESEARCH_25 to report here. This session addresses RESEARCH_25 §4's four queue items in order below.

---

## 0. Queue item 2 (P2, easy): today's ~1.38→~1.35 TON/USDT move is real, confirmed against CoinGecko

RESEARCH_25 §3 flagged that STON.fi, DeDust-live, and the reserve-snapshot series had all drifted from ~1.38 toward ~1.35 together over the course of today's sessions, and asked for an independent off-chain check to rule out something DEX-specific.

```
curl https://api.coingecko.com/api/v3/simple/price?ids=the-open-network&vs_currencies=usd
  -> {"the-open-network":{"usd":1.35,"last_updated_at":1789303930}}
```

`last_updated_at` decodes to `2026-09-13T12:52:10Z`, ~2.5 minutes before this session's own on-chain reads. **CoinGecko's independent, off-chain-sourced price is 1.35 — matching the current on-chain/DEX consensus (see §2) to 3-4 significant figures**, not the earlier-in-the-day ~1.38. This is a real, broad market move reflected everywhere, not an artifact specific to either DEX or to this project's own tooling. Queue item closed.

---

## 1. Queue item 1 (P2): reserve-snapshot series — no new organic point since RESEARCH_25, interval is irregular, not yet enough for volatility analysis

```
gh run list --workflow=reserve-snapshot.yml --json event,status,conclusion,createdAt
  -> schedule  2026-09-13T11:54:09Z  success   <- same run RESEARCH_25 already saw
     schedule  2026-09-13T06:11:10Z  success
     workflow_dispatch  2026-09-13T03:56:49Z  success
     workflow_dispatch  2026-09-13T02:18:26Z  success
```

Wall clock at this session's check: `2026-09-13T12:54:41Z`, only ~1h since the last firing — no new row expected yet given the observed ~2h15m/~5h43m gaps between prior firings (irregular, consistent with GitHub Actions' documented best-effort `schedule:` delay under load, not a bug). `data/reserve_snapshots.jsonl` is unchanged at 6 total rows / 3 genuinely-correct rows (post-`59c4fe9`):

```
03:56:59Z  1.367958
06:11:20Z  1.365668   (-0.17%)
11:54:17Z  1.350215   (-1.13%, -1.30% cumulative)
```

Did not force a manual trigger — same reasoning RESEARCH_24/25 gave (letting it accumulate organically is the point of having a working schedule). Still queued for a future session once there are more points.

---

## 2. New data point: a fourth live simulator run shows the tightest spread yet — convergence continues, not reversal

Re-ran the project's actual decision tool live, no fallback (`node dist/src/tools/dual_dex_simulator.js --amounts 1,10,50,100`), at `2026-09-13T12:55Z`:

```
  1 TON: STON.fi 1.3466 | DeDust 1.3462   (gross -0.17% to -0.23%)
 10 TON: STON.fi 1.3466 | DeDust 1.3461   (gross -0.18% to -0.23%)
 50 TON: STON.fi 1.3465 | DeDust 1.3459   (gross -0.20% to -0.25%)
100 TON: STON.fi 1.3465 | DeDust 1.3455   (gross -0.23% to -0.28%)
```

Every size is net-negative after gas on both paths, same as RESEARCH_24/25's runs — but the STON.fi/DeDust quote gap itself is now under 0.1% at every size (previously ~0.5-1% in RESEARCH_24, and RESEARCH_25 §1 found the swap-classifier vs. live-quote gap at 0.2%). This is the fourth independent live measurement (RESEARCH_24 §2, RESEARCH_25 §0/§1, this session) and all four point the same direction: **the residual STON.fi/DeDust gap keeps shrinking as more of it gets measured correctly, not growing** — the opposite of what a real, persistent arbitrage opportunity would look like. Consistent with, and mildly strengthens, the project's standing "spread ≈ 0" conclusion. This also matches §0's finding almost exactly (1.345-1.347 vs. CoinGecko's 1.35), giving three independent sources (STON.fi on-chain, DeDust on-chain, CoinGecko off-chain) agreeing to within ~0.4% at the same moment in time — the strongest three-way convergence this project has recorded to date.

---

## 3. Queue item 3 (P3): DeDust docs bug report — still not filed, still flagging rather than filing unilaterally

RESEARCH_25 §2 produced a citable artifact (the docs page's own `"deprecated":false` structured-metadata field) for a vendor bug report against `docs.dedust.io/reference/getting-available-pools`. Filing it is an action visible to a third party outside this repo, not a read-only research step — consistent with three prior sessions' judgment, this session is not filing it unilaterally. **Surfacing to the user directly:** the artifact is ready (RESEARCH_24 §0, RESEARCH_25 §2); if you want it filed (e.g., as a DeDust support ticket or an issue against `Sild/api-clients-rs` referencing the discrepancy), say so and specify where, since "post something on our behalf to an external party" is exactly the kind of action this project's standing discipline asks to be surfaced rather than assumed.

---

## 4. Queue item 4 (P1 — funded wallet, unchanged): still available, still not spent, threshold unchanged

Same threshold RESEARCH_24/25 stated: the tool chain is now trustworthy both live and in its mock fallback, so the only remaining open question is empirical — does a longer observation window ever show a genuinely net-positive, post-gas spread — not whether the tooling can be trusted to report one accurately. This session's data point (§2) makes that look less likely over time, not more, but four data points across ~10 hours is still a short window for a market-wide question. No experiment this session crossed the "read-only can't answer this" bar, so the wallet stays untouched.

---

## 5. Updated priority research queue for RESEARCH_27

1. **(P2)** Reserve-snapshot series: now 3 correct points, schedule confirmed working but firing irregularly (~2-6h gaps) — keep letting it accumulate; don't force a manual trigger. Re-check whether the ~1.38→1.35 move (§0) continues, reverses, or stabilizes once more points land.
2. **(P3)** DeDust docs bug report (§3): artifact is ready and cited across RESEARCH_24/25/26; still unfiled. If the user wants it filed, do that first before anything else queued here — otherwise leave it queued, don't re-derive the artifact again.
3. **(P2)** This session's four-point convergence trend (§2) is encouraging but still short-window — if a future session has more reserve-snapshot points (item 1) by then, worth explicitly correlating the simulator's live gross-spread number against the snapshot series' implied price at the same timestamps, to see if they move together (they should, if both are reading real state) or diverge (which would itself be a new finding worth chasing).
4. **(P1 — funded wallet, unchanged)** Still available, still not spent. Threshold for using it is unchanged from RESEARCH_24/25: only a longer-window empirical answer to "does a net-positive post-gas spread ever appear" would justify it, and this session's data continues to point toward "no."
