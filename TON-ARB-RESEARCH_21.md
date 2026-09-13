# TON-ARB-RESEARCH_21: The quote-vs-settlement gap, resolved — root cause found in DeDust's own REST cache, not in this project's math

**AGENT_ID:** TON_ARB_RESEARCH_21
**Base model:** Claude Sonnet 5 (`claude-sonnet-5`), via Claude Code.
**Environment disclosure:** Live network access confirmed fresh this session (real TLS certs, live block timestamps matching wall clock, multi-KB real API payloads — not just 200 status codes). `@ton/sandbox` + `@ton/core` + `@dedust/sdk` installed fresh in a scratch dir (not persisted between sessions, as expected). `gh` CLI available and authenticated as `quickerup`, used read-only except for one explicitly-disclosed `workflow_dispatch` (see §3). No mock mode was used anywhere in this contribution — every number below is either a live API/get-method response or a `@ton/sandbox` trace against real, freshly-fetched on-chain code+data.

**Handoff-completion check (per the project's standing process rule):** This session took up `TON_ARB_RESEARCH_20_COMPRESSOION_02.md` §6 items 1, 2, and 5 (all three explicitly P0/flagged). It did **not** attempt items 3 (drift analysis using snapshot data — see below for why the existing data is unsuitable), or 4(a)/4(b)/4(c) (extend to other pairs; formalize an execution spec; re-verify the RESEARCH_19 tool-suite fixes). Those remain open for the next contributor.

---

## 1. §6 item 1 (P0): Does a fresh DeDust quote settle at its own promised rate? — **No. Root cause identified.**

This was flagged as the single most important open item: DeDust's `/v2/routing/plan` has repeatedly quoted ~$1.575–1.579/TON for the TON/USD₮ pool (`EQA-X_yo3fzzbDbJ_0bzFWKqtRuZFIRa1sJsveZJ1YpViO3r`) across three independent sessions (12, 14, 17), while RESEARCH_19 decoded *other parties'* historical real trades averaging ~$1.382/TON. Nobody had tested what a *fresh* quote-to-settlement round trip actually pays.

### 1.1 Live quote, reproduced

```
POST https://api.dedust.io/v2/routing/plan
{"from":"native","to":"jetton:0:b113a994b5024a16719f69139328eb759596c38a25f59028b146fecdc3621dfe","amount":"100000000000"}

-> [[{"pool":{"address":"EQA-X_yo3fzzbDbJ_0bzFWKqtRuZFIRa1sJsveZJ1YpViO3r","isStable":false,
      "assets":["native","jetton:0:b113...1892"],
      "reserves":["201857552649718","317716412003"]},
     "assetIn":"native","assetOut":"jetton:0:b113...1892",
     "tradeFee":"100000000","amountIn":"100000000000","amountOut":"157161170"}]]
```

100 TON in → quoted 157.161170 USD₮ out ($1.5716/TON). Confirmed self-consistent: plugging the API's own stated reserves into the standard constant-product formula (`y·dx(1-fee)/(x+dx(1-fee))`) reproduces `157161170.05` exactly. **The API's arithmetic is correct — its input reserves are wrong.** (Note in passing: at small trade sizes, e.g. 1 TON, the router instead multi-hops through `stGRAM` — Bemo's liquid-staking derivative — but arrives at a similar ~$1.57/TON, so hop count isn't the explanation; see raw traces in the session artifacts if a future contributor wants them.)

### 1.2 Real settlement, via `@ton/sandbox` against the live pool's actual bytecode

Fetched the native Vault (`EQDa4VOn...ICq_`), the pool, and the USD₮ Vault's real code+data+balance via `toncenter`, planted all three into a local sandbox, and sent a real `VaultNative.SWAP` message (`op=0xea06185d`, exact TL-B layout read from `@dedust/sdk`'s actual `VaultNative.js`/`Vault.js` source, not guessed) for 100 TON with `limit=0`. The resulting transaction chain reproduced the documented internal protocol exactly — `0x61ee542d` (Pool.SWAP) → `0xad4eb6f5` (Pool.PAYOUT) → jetton transfer — and the decoded `Pool.PAYOUT` body carried:

```
Pool.PAYOUT queryId=12345 amountP=137580866
```

**137.580866 USD₮ for 100 TON in → $1.3758/TON.** This is the real payout the pool's actual bytecode computed, not a guess.

### 1.3 The pool's own get-methods confirm it, live, independent of the sandbox

```
runGetMethod(pool, "get_reserves", [])
  -> reserve0 = 204921093838660 (204,921.09 TON)
     reserve1 = 282352012612    (282,352.01 USD₮)
     implied price: $1.3779/TON

runGetMethod(pool, "estimate_swap_out", [nativeAssetSlice, 100000000000])
  -> amountOut = 137580866   <-- bit-for-bit identical to the sandbox trace's real settlement
     tradeFee  = 100000000
```

Three independent methods — a real sandboxed trade against live bytecode, the pool's own `get_reserves()`, and the pool's own `estimate_swap_out()` — all agree with each other (~$1.376–1.378/TON) and with RESEARCH_19's historical-trade average (~$1.382/TON) and with STON.fi/CoinGecko consensus (~$1.38/TON). **None of them agree with `/v2/routing/plan`.**

### 1.4 Root cause: DeDust's own REST cache is stale for this specific pool, confirmed via its own self-reported LT

`GET https://api.dedust.io/v2/pools` (the bulk listing `arb-research-api/core.py` also used) returns, for this exact pool address:

```json
{"address":"EQA-X_yo3fzzbDbJ_0bzFWKqtRuZFIRa1sJsveZJ1YpViO3r",
 "lt":"90455910000021",
 "reserves":["201857176212689","317717102154"],
 "stats":{"fees":["0","0"],"volume":["0","0"]}}
```

Its own `lt` field (90,455,910,000,021) is **~13 trillion LT units behind** the pool's real current LT (~103,119,720,000,042, confirmed live via `get_reserves()`'s `last_transaction_id.lt` this session). The `stats.fees`/`stats.volume` being flatly `["0","0"]` despite the pool processing real swaps roughly every 25 seconds (RESEARCH_17) is consistent with the same frozen index entry never having been refreshed. This is not a project-side bug and not noise — it is DeDust's own backend serving a long-stale cached snapshot for this one pool through both `/v2/pools` and `/v2/routing/plan` (both draw from the same reserve figures; §1.1's quote is self-consistent with exactly this stale number).

**This is the answer to §2.4/§6 item 1: RESEARCH_19 was right that no persistent +14% executable spread exists, and this session additionally explains *why* the wrong number was so reproducible across three separate sessions — it was never random drift or a routing artifact, it was the same frozen cache entry being served every time.**

### 1.5 A second, consequential discovery: this project's own tooling was unknowingly reading the same stale cache

`arb-research-api/core.py`'s `get_dedust_pool_reserves()` (used by the `/reserves/dedust` route and by `scripts/snapshot_reserves.py`, i.e. the scheduled snapshot automation from contribution 18) called `fetch_dedust_pools()` → `GET /v2/pools` — the exact stale source identified above. **Every row so far in `data/reserve_snapshots.jsonl` (including the two RESEARCH_19 wrote and the one this session's manual workflow dispatch wrote, see §3) records the wrong, stale ~$1.57 figure, not the pool's real ~$1.38 price.** This directly blocks §6 item 3 (use the snapshot series to check drift) — that series cannot currently answer anything about this pool's real price movement.

**Fixed this session** (`arb-research-api/core.py`): renamed the old REST-based function to `get_dedust_pool_reserves_rest()` (kept, clearly docstring-flagged as stale-for-this-pool, for anyone who wants to compare the two sources side by side) and rewrote `get_dedust_pool_reserves()` — the name every existing caller (`app.py`'s route, `scripts/snapshot_reserves.py`) already uses — to call the pool's own `get_reserves()` get-method live instead. Verified live post-fix:

```
get_dedust_pool_reserves() -> reserves_raw=['204611435803399','282779780539'], implied price $1.3820/TON
get_dedust_pool_reserves_rest() -> reserves_raw=['202183055549956','317205521905'], implied price ~$1.569/TON (still stale, as expected/documented)
```

No other code paths depend on the old function's exact return shape (`assets`/`total_supply` fields) — checked via grep across the repo before changing it. This is a read-only data-source fix, no signing/fund-moving involved.

---

## 2. §6 item 5: the executor `last_transaction_id.lt` discrepancy — resolved, with the actual transaction traced

RESEARCH_18 showed `last_transaction_lt=103104091000005` where RESEARCH_17 had `102923871000003` — an unflagged discrepancy the compression pass caught but nobody had chased down.

**Live re-check this session**, plus full transaction history:

```
runGetMethod(executor, "getConfig", []) -> last_transaction_id.lt = 103104091000005  (still current, unchanged)

getTransactions(executor, limit=5, desc):
  lt=103104091000005  utime=1789259742  from=<owner>  exit_code=0   <-- new tx, not seen before RESEARCH_18
  lt=102923871000003  utime=1789187692  from=<owner>  exit_code=0   <-- RESEARCH_17's "deposit" tx
  lt=102914950000003  utime=1789184127  from=<owner>  exit_code=0   <-- original deploy
```

**Both numbers were correct — RESEARCH_18's was just newer.** The executor now has **3 lifetime transactions, not 2** — a genuinely new event RESEARCH_18 saw happen but never called out explicitly, and no session since has investigated what it was. This session decoded the message body:

```
in_msg body: te6cckEBAQEADwAAGZmId2YAAAAAAAAAAAg5kl5m
  op = 0x99887766   (one of the five dispatch opcodes documented since RESEARCH-09)
  query_id = 0
  value = 20,000,000 nanoTON (0.02 TON)
```

Replayed this exact message in `@ton/sandbox` against the executor's live code+data, with the sender correctly set to the real owner address (`EQDZlnNR...q qW7OBPM`, via `@ton/sandbox`'s `internal()` message builder — a plain `treasury()` call does **not** let you impersonate an arbitrary address, it silently uses its own derived address; this cost one failed attempt, worth noting for the next contributor who tries owner-impersonation in the sandbox). Result:

```
exitCode=0 (SDEQ/THROWIFNOT 401 owner check passed)
1 outbound message: executor -> owner, value=19,687,732 nanoTON
No message to any DEX/vault contract. No further outbound calls.
```

**Conclusion: this was a trivial owner "ping"/probe call — 0.02 TON, far below the contract's own `gas_reserve_nanos` (0.5 TON) and `max_trade_nanos` (50 TON) thresholds — that passed the owner check, executed opcode `0x99887766`'s handler, and refunded essentially the full value back to the owner. It did not attempt, and did not result in, any interaction with STON.fi or DeDust.** The standing claim "the executor has never been operationally exercised for a swap" still holds exactly — refine it to: the executor has now received one owner-only non-swap probe call (2026-09-11, per `utime=1789187692`→`1789259742` range) in addition to its original deploy+deposit, and still shows zero evidence of ever dispatching to a DEX.

---

## 3. §6 item 2: has any scheduled GitHub Actions workflow ever actually fired? — **No, but the mechanism itself works.**

`gh run list` and `gh workflow list` (read-only, authenticated as `quickerup`) show:

- `arb-research-api Smoke Test` and `Tool Suite CI & Live Health Check`: every run so far is `push` or `pull_request` triggered. **Zero `schedule`-triggered runs found**, filtering explicitly on `event=="schedule"` across the last 50 runs.
- `Reserve & Executor Snapshot` (`reserve-snapshot.yml`, cron `*/20 * * * *`): **zero runs of any kind** — not scheduled, not manual, not even a smoke test — prior to this session.

The workflow YAML itself has no obvious defect (valid cron syntax, `workflow_dispatch: {}` present, `permissions: contents: write` present). To distinguish "the pipeline is broken" from "the cron just hasn't fired yet" (only ~70 minutes had elapsed since the workflow was merged to `master`, and GitHub's scheduler is known to have first-run delays for brand-new schedules), **this session manually triggered it once via `gh workflow run reserve-snapshot.yml --ref master`** — a read-only, non-fund-moving, explicitly-disclosed action, directly in scope of what this queue item asked the next contributor to confirm.

Result: **it works end-to-end.** Run [`34732718290`](https://github.com/quickerup/Research/actions/runs/34732718290) completed successfully, fetched a snapshot, and pushed commit `14f1d1d` to `master`. Two things surfaced in its log worth flagging:

1. **`TONCENTER_API_KEY` is empty in the workflow's environment** — the repo secret was never actually configured, despite the workflow referencing `secrets.TONCENTER_API_KEY`. It still worked (the project's docs already note the key is optional, only raising rate limits), but a real 20-minute-cadence schedule running unauthenticated indefinitely risks eventual rate-limiting. Configuring the secret (`gh secret set TONCENTER_API_KEY`) is a one-line fix but requires repo admin action this session didn't take, since it wasn't asked to touch repo secrets.
2. The snapshot this manual run wrote (`data/reserve_snapshots.jsonl`, commit `14f1d1d`) was captured **before** this session's §1.5 fix landed, so it still recorded the stale ~$1.574 figure. All snapshot rows up through that commit should be treated as reflecting the buggy source; only rows written after the `core.py` fix in this same session's PR are reading the corrected on-chain source.

**Still unresolved:** whether the `schedule:` trigger itself will ever fire organically. This needs a future contributor to check again after several more hours have passed (`gh run list --workflow=reserve-snapshot.yml --json event -q '.[] | select(.event=="schedule")'`) — if it's still empty after, say, 3+ hours (9+ missed 20-minute firings), that's a real GitHub Actions configuration problem (not: default-branch cron restrictions don't apply here, the file has been on `master` since RESEARCH_18's merge) worth escalating rather than continuing to assume it'll start eventually.

---

## 4. Updated priority research queue for RESEARCH_22

1. **(P0)** Re-check whether `reserve-snapshot.yml`'s `schedule` trigger has fired organically yet (`gh run list --workflow=reserve-snapshot.yml --json event -q '.[] | select(.event=="schedule")'`). If still empty after several hours, treat it as a real infra bug, not a timing artifact, and investigate (check org/repo Actions settings, confirm the default branch is what GitHub thinks it is, etc.) rather than re-dispatching manually again.
2. **(P0)** Configure the `TONCENTER_API_KEY` GitHub Actions secret (`gh secret set TONCENTER_API_KEY < <(grep TONCENTER_API_KEY .env | cut -d= -f2)`, or via the repo settings UI) — currently empty, confirmed in a live run's log (§3.1). Low urgency at current call volume but should be fixed before relying on this at higher frequency or for a long-running series.
3. **(P1)** Now that `get_dedust_pool_reserves()` reads the correct on-chain source, let the snapshot series (`data/reserve_snapshots.jsonl`) accumulate for a few hours and *then* revisit §6 item 3 (drift analysis) — this was blocked all session by the stale-data bug (§1.5) and is now unblocked, but there isn't yet enough post-fix data to say anything.
4. **(P1)** Consider applying the same "does the REST quote endpoint match on-chain get-methods" check (§1) to STON.fi's `/v1/swap/simulate` — this project has never independently verified STON.fi's quote against its own pool contract's get-methods the way this session did for DeDust; given DeDust's REST layer was just found to have a real staleness bug, STON.fi's shouldn't be assumed clean without the same check.
5. **(P1, carried forward verbatim from RESEARCH_19/the compression digest, not attempted this session):** (a) extend research beyond the TON/USD₮ pair to other high-volume DeDust/STON.fi jetton pools, applying the same rigor including the new "check the REST reserves' own `lt` field against the pool's live LT" test from §1.4; (b) formalize a client-side sequential execution prototype specification (still spec-only, no execution capability); (c) independently re-verify RESEARCH_19's tool-suite fixes are still holding (not done this session — this session worked entirely through direct API/get-method/sandbox calls, not the `src/tools/*.ts` suite).
6. **Standing rule, unchanged:** no capital moves, no contract deployment, no signed/authorized call constructed or sent, and no execution capability added, without surfacing that decision to the user explicitly first. Nothing in this session did or recommends otherwise — the one non-read-only action taken (§3's manual `workflow_dispatch`) touches only public, non-financial repo data (JSONL snapshot rows) and was disclosed inline as it happened, not after the fact.
