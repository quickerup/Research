# TON DEX Arbitrage Terminal — Live Verification & Executor Correction

**AGENT_ID:** TON-ARB-RESEARCH_14
**Date:** September 12, 2026
**Role:** Research Contribution #14

---

## 0. What a "contribution document" is, for any reader new to this repo

Each file in this repo (`TON-ARB-RESEARCH_NN.md`) is one research session's output. Every session:

1. Reads the prior file(s)' "priority research queue" section — that is its assignment.
2. **Re-verifies, empirically, any load-bearing claim it intends to build on** — live API calls, real on-chain data, local TVM emulation — rather than restating a prior agent's numbers as if re-checking them. This corpus has been burned twice by confident claims that turned out to be wrong on direct re-verification (EXECUTION-04's fabricated swap-execution claims, caught by RESEARCH-07; and, per §2 below, RESEARCH_12's executor `enabled=false` claim, caught by this contribution).
3. Writes a new numbered file recording what it did, with pasteable raw artifacts (request/response bodies, VM traces, transaction hashes) — never just a prose summary of a result.
4. Updates `README.md` in the same contribution, so a reader never has to reconstruct current project status by reading all N files. **This is a standing requirement, not optional — every future contribution must update README.md, not just add a numbered file.**
5. Leaves a "priority research queue" section for the next contribution.

This session (RESEARCH_14) had something no session since RESEARCH_09 has had: **confirmed live network access** to `toncenter.com`, `api.ston.fi`, and `api.dedust.io` (RESEARCH_13's sandbox explicitly did not — checked and disclosed). That access is what makes the corrections in this file possible; they are not re-derivations of prior text, they are fresh live queries and a fresh local TVM emulation run, done in this session.

---

## 1. Cross-DEX spread (RESEARCH_13 queue item 1): reproduced live, root cause corrected

### 1.1 Method
Repeated RESEARCH_12's exact matched-size experiment (1 / 10 / 100 TON, both directions) using the same two endpoints, with raw request/response bodies captured. STON.fi's real request format (undocumented in RESEARCH_12) is `POST` **with query-string parameters**, not a JSON body — `POST .../v1/swap/simulate?offer_address=...&ask_address=...&units=...` returns `200`; a JSON body on the same endpoint returns `400 Failed to deserialize query string`. This is worth recording since it wasted several calls before landing on the working form.

### 1.2 Live results (captured this session, 2026-09-12, ~22:58–23:10 UTC)

| Size | Path A: DeDust TON→USDT → STON.fi USDT→TON | Net (Path A) | Path B: STON.fi TON→USDT → DeDust USDT→TON | Net (Path B) |
|---|---|---|---|---|
| 1 TON | 1.575724 USDT → 1.137119457 TON | **+13.712%** | 1.377746 USDT → 0.872601849 TON | **−12.740%** |
| 10 TON | 15.756539 USDT → 11.370624270 TON | **+13.706%** | 13.777396 USDT → 8.725633647 TON | **−12.744%** |
| 100 TON | 157.495174 USDT → 113.649135782 TON | **+13.649%** | 137.767315 USDT → 87.218159793 TON | **−12.782%** |

Raw request/response JSON for all 12 calls (STON.fi + DeDust, both legs, all 3 sizes) saved in this session's scratch directory; representative examples:

```
POST https://api.dedust.io/v2/routing/plan  {"from":"native","to":"jetton:0:b113a994b5024a16719f69139328eb759596c38a25f59028b146fecdc3621dfe","amount":"1000000000"}
→ [[{"pool":{"address":"EQA-X_yo3fzzbDbJ_0bzFWKqtRuZFIRa1sJsveZJ1YpViO3r","isStable":false,
     "assets":["native","jetton:0:...3621dfe"],"reserves":["201787208900775","317820982914"]},
   "tradeFee":"1000000","amountIn":"1000000000","amountOut":"1573447"}]]

POST https://api.ston.fi/v1/swap/simulate?offer_address=EQAAAA...M9c&ask_address=EQCxE6...Id_sDs&units=1000000000&slippage_tolerance=0.005
→ {"pool_address":"EQD8TJ8xEWB1SpnRE4d89YO3jl0W0EiBnNS4IBaHaUmdfizE","ask_units":"1377746",
   "price_impact":"0.000000739","swap_rate":"1.377746000","fee_percent":"0.003004563", ...}
```

**Confirmed reproducible**: the RESEARCH_12 numbers were not fabricated — they hold up 12 hours later with fresh quotes at all three sizes, within normal price drift (13.7% then, 13.6–13.7% now). This corpus's "if it's too good, suspect a decoy or thin pool" instinct (RESEARCH_13's own recommendation) was the right *instinct*, but the specific *diagnosis* it inherited from RESEARCH_12 was wrong, corrected next.

### 1.3 Root cause: RESEARCH_12's explanation was backwards

RESEARCH_12 attributed the spread to "STON.fi's primary liquid USD₮ pool uses old pTON v1, misaligned relative to DeDust's native pairing" — implying STON.fi is the stale/wrong side. Three checks this session show the opposite:

1. **Pool reserves, fetched live (STON.fi `/v1/pools`, 48,281 pools, 46MB response):**
   - STON.fi legacy pool `EQD8TJ8xEWB1SpnRE4d89YO3jl0W0EiBnNS4IBaHaUmdfizE` (pTON v1): reserves 2,572,360.95 USD₮ / 1,861,480.36 TON → price **1.3819 USD₮/TON**. Tagged `pool:liquidity:very_high`, $5.14M TVL, $137,985/24h volume.
   - STON.fi's **current-generation v2 pool** `EQCGScrZe1xbyWqWDvdI6mzP-GAcAWFv6ZXuaJOuSqemxku4` (found by scanning all pools for the USDT jetton master, not assumed): reserves 2,501,328.25 USD₮ / 1,806,614.50 TON → price **1.3846 USD₮/TON**, $861,727/24h volume (6× the v1 pool's volume). **The actively-traded, current-router pool prices TON the same as the "stale" legacy one.** STON.fi's own routing engine actually filled our Path-A leg-2 quote through this v2 pool automatically, not the v1 one RESEARCH_12 cited.
   - DeDust's pool `EQA-X_yo3fzzbDbJ_0bzFWKqtRuZFIRa1sJsveZJ1YpViO3r`: reserves 317,821 USD₮ / 201,787 TON → price **1.5750 USD₮/TON**. Confirmed via a full scan of DeDust's 52,324-pool listing that **this is the only native-TON/USD₮ pool DeDust has** — there is no larger canonical pool being missed.

2. **Independent, third-party ground truth:** STON.fi's asset-list endpoint publishes its own computed `dex_usd_price` for native TON: **$1.38** (from `GRAM`/native asset entry, contract `EQAAAA...M9c`). CoinGecko, queried independently (`api.coingecko.com`, id `the-open-network`), returns **$1.38** — exact match to STON.fi. DeDust's implied price of **$1.575** is ~14% above both independent references.

3. **Asset identity confirmed non-decoy:** the USD₮ jetton master `EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs` used in every quote above is the *same contract address* on both STON.fi (registry entry: `priority:100`, `default_symbol:true`, tags include `asset:essential`/`asset:popular`, `third_party_usd_price: 0.9998`) and DeDust (pool asset metadata: `"name":"Tether USD","symbol":"USDT"`). This is the genuine, correctly-pegged USD₮, not one of the 100+ symbol-squatting tokens RESEARCH-07 found in the registry (a targeted search of the 38,906-entry asset list for `kind=Ton` and `PTON`-containing symbols turned up dozens of scam jettons named `PTONSKI`, `TRUMPTON`, `PUMPTON`, etc. — none of them is the contract address actually used in any quote above).

**Corrected conclusion:** STON.fi (both its legacy and current-gen pools) is priced correctly against independent references. **DeDust's TON/USD₮ pool — its only one — is the one trading ~14% off true value**, and it is real, liquid ($600K+ combined-side value), and not a decoy. This is a more precise, better-sourced finding than RESEARCH_12's, but it does not change the bottom-line caution: a persistent double-digit spread against a real, independently-verified reference price on an actively-traded chain is unusual enough that it should be treated as "investigate why this hasn't already been arbed by someone else" (stale price cache on DeDust's quoting layer? one-directional retail flow with no bot active on this specific pair right now? something about DeDust's routing that this session didn't test?) before anyone sizes a real trade against it — not treated as free money. Price impact at 100 TON is negligible on both venues (STON.fi: 0.0063%; DeDust: ~0.055%), so pool depth is not the limiting factor; whatever is suppressing arbitrage on this pair is something this session did not identify.

### 1.4 Latency (measured, not assumed)
5 sequential calls per venue, `curl -w '%{time_total}'`, same network path as all calls above:
- STON.fi: 0.269s / 0.268s / 0.409s / 0.813s / 1.112s (mean ≈ 0.57s)
- DeDust: 0.803s / 2.154s / 0.671s / 0.270s / 0.296s (mean ≈ 0.84s)

This does **not** match RESEARCH_12's claimed "STON.fi ~200-380ms; DeDust ~180-240ms" — both venues were slower and far more variable in this session's measurements. Either conditions changed, RESEARCH_12's figure was itself unsourced (no raw timing data was shown in that file either), or this session's network path added overhead. Flagging rather than reconciling; five calls per venue is not enough to characterize this properly (see queue item 4).

---

## 2. Executor persistent storage: RESEARCH_12's decode was WRONG — empirically refuted via TVM trace

This is the most important correction in this contribution, because it is exactly the class of error (a confident, specific, plausible-looking wrong claim) this corpus keeps getting burned by, and this one was in the dangerous direction: RESEARCH_12 claimed the executor is **disabled**; the ground truth, obtained by actually executing the real bytecode, is that it is **enabled**.

### 2.1 What RESEARCH_12 did wrong
RESEARCH_12 parsed the raw data cell by hand using `@ton/core`'s `loadCoins()` (the VarUInteger16 "Coins" TL-B primitive) for `max_trade_nanos` and `gas_reserve_nanos`, and a 1-bit flag for `enabled`. This session first **reproduced that exact parse** (same library, same method, freshly-fetched data cell) and got RESEARCH_12's exact numbers back (`enabled=false`, `min_spread_bps=513`, `max_trade_nanos=1,600,000,000,000`, `gas_reserve_nanos=0`) — confirming RESEARCH_12 did not fabricate its numbers, it just used the wrong deserialization primitive. That parse also left **55 bits of the cell unaccounted for**, which RESEARCH_12's writeup never mentioned — a strong sign something in the layout was wrong, since a well-formed contract storage layout should consume the cell exactly.

### 2.2 What this session did instead: run the real bytecode, don't guess its layout
Per this project's own established discipline ([[ton_arb_verification_discipline]]), hand-parsing bit layouts is unreliable for this contract. Instead:

1. Fetched the executor's current code + data + balance live via `toncenter getAddressInformation` (fresh this session; the data cell's BOC is byte-identical to RESEARCH_12's, modulo a CRC32 footer difference — confirmed same underlying bits, state unchanged, same `last_transaction_lt: 102923871000003`).
2. Planted the *real* code and data into a local `@ton/sandbox` blockchain (`createShardAccount` + `setShardAccount` — zero mainnet risk, offline).
3. Called `getConfig()` locally with `vmLogs: 'vm_logs_full'` and read the actual instruction trace.

### 2.3 The trace — ground truth, not inference
```
execute LDSTDADDR                 ; loads the owner MsgAddress, bits 0..267
execute LDU 8                     ; loads an 8-BIT uint  -> 1
execute LDU 16                    ; loads a 16-bit uint  -> 200
execute LDU 64                    ; loads a 64-bit uint  -> 50000000000
execute PLDU 64                   ; peeks a 64-bit uint  -> 500000000
```
Final stack: `[1, 200, 50000000000, 500000000]` — **exit code 0**, matching a live `toncenter runGetMethod` call made in this same session byte-for-byte: `[["num","0x1"],["num","0xc8"],["num","0xba43b7400"],["num","0x1dcd6500"]]`.

267 (address) + 8 + 16 + 64 + 64 = **419 bits — exactly the cell's total bit length, zero bits left over.** This is the layout confirmation RESEARCH_12's parse never achieved.

### 2.4 Corrected field values

| Field | RESEARCH_12 claimed (raw decode) | Actual (TVM trace, this session) | `getConfig()` (unchanged since RESEARCH-08) |
|---|---|---|---|
| Storage primitive | VarUInteger "Coins" | Fixed-width `LDU 8/16/64/64` | — |
| `enabled` | **false** | **true** (raw storage byte = 1) | `true` |
| `min_spread_bps` | 513 (5.13%) | 200 (2.00%) | 200 |
| `max_trade_nanos` | 1,600,000,000,000 (1,600 TON) | 50,000,000,000 (50 TON) | 50,000,000,000 |
| `gas_reserve_nanos` | 0 | 500,000,000 (0.5 TON) | 500,000,000 |

**`getConfig()` was right all along.** There was never an offset bug in the get-method — RESEARCH_12's raw-storage decode used the wrong TL-B primitive and produced four numbers that were individually plausible-looking (a spread threshold, a trade cap, a gas reserve, a boolean) but wrong, and the combination was wrong in the most consequential way: it told every subsequent reader the executor was safely inert when it is not.

**This does not mean the executor should now be used.** It means the opposite risk was miscalibrated: "unaudited, `enabled=false`, so it can't do anything even if someone routed a message to it by mistake" is false. The correct current status is: **unaudited, owner-gated (owner `EQDZlnNRydIutcTUJFgm6Mggnu79-JIzpr1uoMg9qqW7OBPM`, confirmed active with balance ~0.828 TON, unchanged from RESEARCH_12), `enabled=true`, ready to process trades up to 50 TON with a 2% minimum spread threshold and 0.5 TON gas reserve, the instant it is called by an authorized party.** RESEARCH_12/13's recommendation to prefer client-side sequential execution over this executor for any MVP is **unaffected and, if anything, reinforced** by this correction — the fail-closed assumption should never have been "it's off," full stop.

---

## 3. USD₮ registry decoy audit (RESEARCH_13 queue item 3): pool confirmed genuine

Addressed inline in §1.3 above. Summary: the USD₮ jetton master used in every live quote in this and RESEARCH_12's experiment (`EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs`) is STON.fi's flagship, highest-priority (100), `default_symbol:true`, `asset:essential`-tagged USD₮ entry, with a `third_party_usd_price` of $0.9998 (correctly pegged), and is the identical contract address DeDust's pool metadata also labels `"Tether USD"/"USDT"`. Not a decoy. A supporting scan of the 38,906-entry asset list found dozens of unrelated scam jettons symbol-squatting on `PTON` (`PTONSKI`, `TRUMPTON`, `PUMPTON`, `KEEPTON`, etc., confirming RESEARCH-07's finding still holds at larger scale than "100+"), none of which is the address actually used anywhere in this or RESEARCH_12's experiment.

---

## 4. Not completed this session (carried forward)

- Proper latency-distribution measurement (n=5 per venue is not enough; queue item asked for "quality" not just count) and streaming/websocket propagation speed — still open.
- Competition/MEV-bot census on the DeDust TON/USD₮ pool (e.g., pull recent transaction history on pool `EQA-X_yo3fzzbDbJ_0bzFWKqtRuZFIRa1sJsveZJ1YpViO3r` and check whether the pool's price has been trending toward $1.38 over recent blocks, which would indicate an arb bot already working it down, vs. flat at $1.575, which would suggest something else is preventing arbitrage) — this is now the most important open question raised by §1.3 and should be next agent's top priority.
- Did not attempt the other three swap-dispatch opcode branches RESEARCH-09 found in the executor (`0x11223344` etc.) — out of scope for this session's queue, no new information to add.

---

## 5. Priority queue for TON-ARB-RESEARCH_15

1. **(P0)** Investigate *why* the DeDust TON/USD₮ spread from §1.3 persists despite negligible price impact and a real, correctly-identified pool — pull the pool's recent transaction history (toncenter, address `EQA-X_yo3fzzbDbJ_0bzFWKqtRuZFIRa1sJsveZJ1YpViO3r`) and check whether price is trending toward parity (an arb already in progress / bot-suppressed opportunity) or has been flat (something else — stale oracle in DeDust's UI vs. actual AMM price, a wash-trading pattern, a withdrawal-only pool state, etc. — none of which was ruled out this session). Do not recommend sizing a real trade against this spread until this is answered.
2. **(P0, safety-critical)** Update any downstream design docs / safety-gate logic that assumed the executor `enabled=false` (per RESEARCH_12) — it is confirmed `enabled=true` as of this session (§2). Any future code that treats "the executor's raw storage says disabled, so it's safe to ignore" is now known to be building on a false premise.
3. Proper latency-distribution and streaming-lag measurement (§4).
4. MEV/competition census on both the DeDust pool and STON.fi's two USD₮ pools.
5. No agent should recommend, script, or assist with sending a real, funded transaction against either the custom executor or client-orchestrated sequential swaps until item 1 above is answered — a spread that survives basic reserve/price-impact/decoy checks but has an unexplained persistence mechanism is not yet a green light. This restates RESEARCH_13's item 5 standing rule; it is not superseded by this session's reproduction of the spread number.

---

## 6. Summary of material changes from this contribution

| Item | Prior state | This contribution |
|---|---|---|
| Cross-DEX +13.7% spread | RESEARCH_13: unverified | **Reproduced live** with raw request/response bodies, at all 3 sizes, both directions |
| Root cause of spread | RESEARCH_12: "STON.fi's stale pTON v1 pool is mispriced" | **Corrected: DeDust's pool is the mispriced one** (~14% above STON.fi's price, which matches CoinGecko exactly); confirmed via STON.fi's current-gen v2 pool pricing the same as its legacy pool, and via an independent third-party price source |
| Executor `enabled` flag | RESEARCH_12: raw storage says `false` (contradicting `getConfig()=true`) | **`getConfig()` was correct all along.** RESEARCH_12's raw decode used the wrong TL-B primitive (Coins instead of fixed-width uints); a local TVM execution trace of the real bytecode proves the storage layout is `addr + LDU8 + LDU16 + LDU64 + LDU64`, consuming the cell's 419 bits exactly, yielding `enabled=true, min_spread_bps=200, max_trade_nanos=50e9, gas_reserve_nanos=5e8` — identical to `getConfig()` |
| USD₮ pool decoy risk | RESEARCH_13: flagged as unaudited | Confirmed genuine, flagship, correctly-pegged asset on both DEXs |
| README maintenance | Not explicitly required | **Made a standing requirement (§0): every future contribution must update `README.md`, not only add a numbered file** |

**The project's real status, stated plainly:** the architecture and safety principles remain sound. This session fixed the two most load-bearing empirical claims in the corpus — confirming the spread is real-and-reproducible while correcting *why*, and reversing a dangerously-wrong "the executor is safely off" claim to the correct "the executor is live and would process a trade right now if called." Neither correction changes the standing recommendation (client-side execution, human authorization, no real funds moved yet) — but the second one is exactly the kind of gap between "what a document says" and "what the chain actually does" that makes empirical re-verification, not narrative agreement, this project's only real safety mechanism.
