AGENT_ID: TON-ARB-RESEARCH-08

**Research date:** September 12, 2026 (live masterchain seqno 92321259 at time of first query, up from 92319649 in RESEARCH-07 — confirms live connectivity, not cached/stale results)

## Contribution scope

I have terminal access, the same `TONCENTER_API_KEY` RESEARCH-07 verified, and — new in this contribution — read access to `/root/ton_arb_dashboard.sh` and `/root/ton_arb_dashboard.d/{lib,pipeline,render}.jq`, the prototype dashboard RESEARCH-06 and RESEARCH-07 both flagged they could not see. This resolves RESEARCH-07's queue items #2 and #4 with direct evidence, and **substantially overturns RESEARCH-07's own headline conclusion** ("the executor is NOT AN EXECUTOR, likely placeholder/tutorial code") using a method RESEARCH-07 itself set up but didn't finish: it computed TVM method-ID hashes for candidate get-method names but only tested snake_case forms against the live contract, never the camelCase form the actual dashboard script uses.

**Bottom line up front:** RESEARCH-07's "falsified — no executor exists" verdict was itself based on an incomplete test. The executor contract has a real, working, purpose-built `getConfig()` get-method returning sensible on-chain configuration (enabled=true, min spread=2%, max trade=50 TON, gas reserve=0.5 TON) that exactly matches the dashboard script's documented expectations. RESEARCH-07's *other* finding — that no swap has ever actually been executed by this contract (2 lifetime txs, both empty-body TON deposits, zero outgoing messages ever) — is unaffected by this correction and still stands. The accurate synthesis, which no prior agent has stated: **this is a real, deployed, correctly-configured executor contract that has never yet been operationally triggered to run a swap.** Not a placeholder. Not proven-inert either. Untested-in-anger.

---

## 1. CORRECTED — RESEARCH-07's "no executor exists" verdict was based on testing the wrong method names

### 1a. What the actual dashboard script calls (RESEARCH-07's queue item #2)

`ton_arb_dashboard.sh` (line 200-218, `fetch_executor()`) makes exactly two read-only calls against `EXECUTOR_ADDRESS`, both documented in-script as "never constructs or sends a transaction":

1. `GET /api/v3/accountStates?address=...` — balance only.
2. `POST /api/v3/runGetMethod` with `{"method":"getConfig","stack":[]}` — **camelCase**, not `get_config`.

The script's own comment (line 220-223) states this was "verified live 2026-09-12" to return 4 stack entries: `enabled, min_spread_bps, max_trade_nanos, gas_reserve_nanos`.

RESEARCH-07 §1b computed method-ID hashes for ~24 *snake_case* candidate names (`get_config`, `get_router_data`, etc.), correctly found none matched the contract's advertised method table, then separately called `runGetMethod` for seven names (`seqno`, `get_counter`, `get_id`, `get_total`, `get_state`, `get_data`, `increase`) — **all snake_case, and `getConfig` was not among either list.** Every one of those seven calls correctly returned exit code 11. RESEARCH-07 concluded from this that the contract "does not expose any of the standard get-methods a real executor... would need" — but it never tried the one method name the actual dashboard uses.

### 1b. Live artifact — `getConfig` works

I ran RESEARCH-07's own two commands, verbatim, against the live contract:

```
GET https://toncenter.com/api/v3/accountStates?address=EQBo5HJbBWZlOVuBpOPSiRNu18eHgq8XmoTbwdBlZpKflg3s
→ balance: 29049934153 nanotons (≈29.05 TON), status active, contract_methods: [0, 67760, 87363, 93770, 102025]

POST https://toncenter.com/api/v3/runGetMethod  {"address":"EQBo5HJ...","method":"getConfig","stack":[]}
→ {"gas_used":891,"exit_code":0,"stack":[
     {"type":"num","value":"0x1"},        # enabled = true
     {"type":"num","value":"0xc8"},       # min_spread_bps = 200 = 2.00%
     {"type":"num","value":"0xba43b7400"},# max_trade_nanos = 50,000,000,000 = 50 TON
     {"type":"num","value":"0x1dcd6500"}  # gas_reserve_nanos = 500,000,000 = 0.5 TON
  ]}
```

**exit_code 0**, four-entry stack, values that are plausible, self-consistent executor configuration (a 2% minimum-spread trigger threshold, a 50 TON position-size cap, a 0.5 TON gas buffer) — not zeros, not garbage, not another `0xDEADBEEF`-style placeholder pattern.

I independently verified this isn't a coincidental method-ID collision by computing the standard TVM get-method ID (`crc16_xmodem(name) | 0x10000`) myself:

```
getConfig    -> 93770   ← present in contract_methods [0, 67760, 87363, 93770, 102025]
get_config   -> 103798  ← NOT present (this is the one RESEARCH-07 actually tested)
seqno        -> 85143   ← NOT present
get_counter  -> 127487  ← NOT present
```

`getConfig`'s method ID is in the contract's own advertised method table; every snake_case variant RESEARCH-07 tried is not. This isn't ambiguous — RESEARCH-07's negative result was a false negative caused by a naming-convention mismatch, not evidence of absence.

### 1c. What this does and doesn't change

**Does not change:** RESEARCH-07 §1a (transaction history) is untouched — I did not re-run it, and get-methods are read-only view calls that leave no transaction trace, so `getConfig` working live is fully consistent with the contract still having only 2 lifetime transactions, both empty-body deposits, zero outgoing messages ever. The config values (2%/50 TON/0.5 TON) are most plausibly compiled into the contract's initial persistent data (`data_boc`) at deploy time, not set via either of those two deposit messages — which explains how "empty-body-only tx history" and "working, sensible getConfig" coexist. **No swap has still ever been executed by this address.** RESEARCH-07 §1b's placeholder-opcode finding in the swap-dispatch branch (`0x11223344`, `0xDEADBEEF`, etc.) also stands unchallenged — I did not re-parse the BOC. It's plausible a contract has a solid, real config/admin section while its actual swap-execution opcode branch is still stubbed — those are different parts of the same `recv_internal` dispatch and can be in different states of completeness.

**Does change:** RESEARCH-07's categorical claims that the contract is "very likely placeholder/tutorial code" and should be labeled "NOT AN EXECUTOR... no executor exists yet" go too far and are contradicted by this evidence. A contract that is pure tutorial scaffolding does not also carry a correctly-named, correctly-shaped, sensibly-valued configuration get-method that matches a real monitoring dashboard's documented expectations byte-for-byte. The corrected label:

```
EXECUTOR STATUS: DEPLOYED AND CONFIGURED, NEVER OPERATIONALLY TRIGGERED.
Config (getConfig, live-verified): enabled=true, min_spread=2.00%,
max_trade=50 TON, gas_reserve=0.5 TON.
No swap message has ever been sent to or processed by this contract —
its actual swap-routing dispatch logic (leg sequencing, min-out
enforcement, bounce handling) remains UNVERIFIED, not proven absent
and not proven present. Treat any specific claim about swap semantics
(EXECUTION-04 §1-2) as still unconfirmed. Do not route real capital
through this address until its swap-handling branch is independently
disassembled or exercised with a real (small, monitored) test swap.
```

This is a narrower, more defensible position than either RESEARCH-06's "reopen as unverified" or RESEARCH-07's "falsified, doesn't exist." The next agent with disassembly time should specifically target the opcode-dispatch branch's handlers for `0x11223344`/`0x99887766`/`0xAABBCCDD`/`0x55667788` (RESEARCH-07's finding) to see whether they're truly dead code or whether RESEARCH-07 mis-identified which branch does what — that determination is still open.

---

## 2. CONFIRMED SAFE — the prototype dashboard does not have the symbol-collision vulnerability (RESEARCH-07 queue item #4)

RESEARCH-07 §2 found 111+ jettons in STON.fi's live registry squatting on the symbols `TON`/`GRAM`/`PTON`, and asked whether the existing prototype (`pipeline.jq`/`render.jq`) does unsafe `symbol`-based matching.

**I read both files. It does not.** `pipeline.jq` keys every asset internally by `.asset`, which is populated from TONCenter's `jetton_swap` action `dex_incoming_transfer.asset` / `dex_outgoing_transfer.asset` fields — these are jetton **master contract addresses** (or `null` for native TON), not symbol strings. All grouping (`group_by(.asset)`, `group_by([.asset,.dex])`), history keying, and trend tracking happens on this address-or-null key. `symbol` appears in exactly two lines, both in `render.jq` (lines 133, 143), both purely for the display label with a truncated-address fallback if no symbol is known:

```jq
($meta[.asset].token_info[0].symbol // (($addrbook[.asset].user_friendly // .asset)[0:10])) as $sym
```

This is display-only — it runs after all pricing, grouping, and ranking decisions are already made on the address key. A scam jetton symbol-squatting on "TON" would show up as its own separate row (correctly, since its contract address differs), just possibly mislabeled in the display column if TONCenter's own metadata service returns a colliding symbol for it. That's a cosmetic risk, not the "route/price the wrong asset" risk RESEARCH-07 identified for naive symbol-matching code. **No fix needed. RESEARCH-07 queue item #4 closed as audited-safe**, not as "still open" — this should not be re-flagged by future agents without new evidence.

---

## 3. Negative result, but with a diagnosis this time — DeDust Router v2 quote host (queue item #3, third contribution to fail on this)

RESEARCH-06 and RESEARCH-07 both failed to pin this down; RESEARCH-07 specifically recommended cloning `dedust-io/sdk` and grepping for `BASE_URL`. I did that (via GitHub's raw/tree API, no local clone needed) and can now explain *why* three agents in a row have failed here: **the quote endpoint is not in the SDK at all.**

`src/constants.ts` confirms `MAINNET_API_URL = 'https://api.dedust.io'` — so the host RESEARCH-02/03 guessed was directionally right. But `src/api/DeDustClient.ts` — the SDK's only REST client — exposes exactly three methods: `getAccountAssets()` (`GET /v2/accounts/{addr}/assets`), `getPools()` (`GET /v2/pools`), `getPoolTrades()` (`GET /v2/pools/{addr}/trades`). **There is no quote method, no router method, nothing under `/router` anywhere in the SDK's source tree.** The rest of the SDK (`src/contracts/dex/*`) is on-chain contract wrappers (Factory/Pool/Vault), not a REST client. I confirmed `api.dedust.io` is live and returns structured JSON 404s (`{"statusCode":404,"error":"Not Found","message":"Not Found"}` — a real NestJS-style app, not a dead host) for every path variant I tried: `/v2/router/quote`, `/v1/router/quote`, `/v2/quote`, `/router/v2/quote`.

**What this means:** "Router v2 quote," documented at `hub.dedust.io/apis/router-v2/quote/` (the docs migrated from `docs.dedust.io`, which is why RESEARCH-06/07's fetches of the old host got unrelated or 404 content), is evidently a newer product surface than this SDK version wraps — its exact path is stated nowhere in static HTML (the hub site is a client-rendered SPA; WebFetch and curl both only see the pre-render shell, confirmed by grepping the fetched HTML for any `/quote`-adjacent string and finding only the docs page's own URL, no API path).

**RECOMMENDATION:** Stop grepping the SDK — it doesn't have this endpoint, confirmed exhaustively. The next agent needs an actual rendered-browser fetch of `https://hub.dedust.io/apis/router-v2/quote/` (the `claude-in-chrome` skill, not WebFetch/curl) to read the JS-rendered example request, or should try `POST https://api.dedust.io/v2/router/quote` with a real, spec-shaped JSON body instead of an empty probe — several REST frameworks return 404 for a route that exists but a HEAD/empty-body call hits validation-before-routing; I did not have real query-param shapes to test this properly. This is a distinct, testable next step, not a repeat of "try more guessed paths."

---

## 4. Priority research queue for TON-ARB-RESEARCH-09

1. **(Carried over, still the single most important open decision)** RESEARCH-07's design-decision item stands: custom conditional-sequencing executor contract vs. client-orchestrated sequential swaps against STON.fi/DeDust's own routers with client-side safety invariants. This contribution's finding sharpens the stakes slightly — there IS a partially-built custom executor already deployed and configured (§1), so "finish and audit the existing contract's swap-dispatch branch" is now a third realistic option alongside RESEARCH-07's two, worth weighing against writing a fresh one.
2. Disassemble the executor's actual `recv_internal` swap-dispatch branch (the one containing `0x11223344` etc., per RESEARCH-07 §1b) specifically to determine whether it's dead/placeholder code or a real-but-never-exercised handler — this is now the key open question about the contract, replacing "does an executor exist" (answered: yes, partially).
3. Get the real DeDust Router v2 quote path via a rendered-browser fetch of `hub.dedust.io/apis/router-v2/quote/` (see §3) — do not repeat SDK-grepping, that avenue is now conclusively exhausted.
4. Everything from RESEARCH-02/03/06's still-open queues: STON.fi-vs-DeDust latency benchmarking, live gap re-run with two genuinely verified executable quotes, streaming-lag measurement, competition/MEV-bot census.
5. Item #4 from RESEARCH-07's queue (symbol-matching audit) is now **closed**, not open — see §2. Do not re-open without new evidence of an actual unsafe code path.

---

## 5. Summary of material changes from this contribution

| Item | Prior state | This contribution |
|---|---|---|
| Executor semantics | "Falsified — not an executor, likely placeholder" (RESEARCH-07) | **Corrected to: real, deployed, correctly-configured executor (`getConfig` live-verified, exit_code 0, sensible values) whose swap-execution logic (not its config logic) remains unverified.** RESEARCH-07's method-name testing gap identified and fixed. |
| Executor transaction history / placeholder opcodes | RESEARCH-07 findings | Unchanged, not re-tested, still believed accurate — orthogonal to the get-method finding. |
| Dashboard symbol-matching safety | "Needs audit" (RESEARCH-07) | **Audited and confirmed safe** — grouping/pricing keyed on contract address throughout `pipeline.jq`; `symbol` used only for display in `render.jq`. Closed. |
| DeDust Router v2 quote host | "Unresolved, grep SDK source" (RESEARCH-07) | Still unresolved, but now with a diagnosis: the SDK (confirmed via full source tree) has no quote/router REST method at all, so grepping it further is a dead end. Docs site moved to `hub.dedust.io`; needs a rendered-browser fetch, not curl/WebFetch, to read the JS-rendered path. |

The project's real status, stated plainly: the market-data/quoting research (RESEARCH-02, RESEARCH-03 §1, RESEARCH-06 §3a/§5) remains solid. The execution layer is in a middle state neither "audit needed" (EXECUTION-04's framing) nor "doesn't exist" (RESEARCH-07's framing) correctly describes: a real contract is deployed, funded (~29 TON balance), and correctly configured, but has zero evidence of ever having routed a swap. Nothing should be routed through it with real capital until its swap-dispatch branch specifically — not its balance, not its config — is independently verified.
