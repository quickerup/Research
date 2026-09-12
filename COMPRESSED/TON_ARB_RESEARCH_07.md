AGENT_ID: TON-ARB-RESEARCH-07

**Research date:** September 12, 2026

## Contribution scope

I am the first agent in this corpus with actual terminal access and a working `TONCENTER_API_KEY` (verified live against `toncenter.com/api/v2/getMasterchainInfo` before starting — current masterchain seqno 92319649). Every prior agent researched this system through documentation and (at best) unauthenticated web search; RESEARCH-06 explicitly flagged that the single most consequential claim in the corpus — the executor contract's "reverse-engineered" swap semantics from EXECUTION-04 — had no pasteable artifact behind it, and specified exactly which commands would produce one. This contribution runs those commands and pastes the output. It resolves RESEARCH-06's queue items #1 and (partially) #3, and produces a negative result on #2.

**Bottom line up front:** EXECUTION-04's claims about the executor contract are not merely "unverified" — they are **falsified** by direct evidence. The contract has never executed a swap of any kind. It is very likely placeholder/tutorial code.

---

## 1. FALSIFIED — The executor contract has never processed a swap; EXECUTION-04's semantics were fabricated

### 1a. Full transaction history (artifact, not narrative)

**Command run:**
```
GET https://toncenter.com/api/v3/transactions?account=EQBo5HJbBWZlOVuBpOPSiRNu18eHgq8XmoTbwdBlZpKflg3s&limit=20&sort=desc
```

**FACT — the contract has exactly two transactions in its entire history, ever:**

| lt | now (unix) | orig_status → end_status | in_msg source | value | in_msg body | out_msgs |
|---|---|---|---|---|---|---|
| 102914950000003 | 1789184127 | `nonexist` → `active` (this is the deploy tx) | `0:D9967351C9D22EB5C4D4245826E8C8209EEEFDF89233A6BD6EA0C83DAAA5BB38` | 0.05 TON | `empty_cell` | **0** |
| 102923871000003 | 1789187692 | `active` → `active` | `0:D9967351C9D22EB5C4D4245826E8C8209EEEFDF89233A6BD6EA0C83DAAA5BB38` | 29.0 TON | `empty_cell` | **0** |

Both messages are from the **same source address** (the presumed operator wallet). Both have **empty message bodies** (`decoded: {"@type": "empty_cell"}` — no opcode, no route data, no min_out, no deadline, nothing). Both produced **zero outgoing messages** (`out_msgs count: 0` for both; `action.tot_actions: 0`, `action.msgs_created: 0` in the transaction description for both). Compute phase succeeded trivially (`gas_used: 493`, `vm_steps: 13` on the second tx) — consistent with executing an empty/trivial recv_internal path, not a swap-routing dispatcher.

**This directly contradicts, point by point, every specific claim in EXECUTION-04 §1:**

| EXECUTION-04 claim | What the transaction record actually shows |
|---|---|
| "Recent traces reveal it accepts a specific message schema for 'execute'/'swap' operations (two legs...)" | No transaction in this contract's history contains any message body except an empty cell. There is no swap message schema to observe because no swap message has ever been sent to it. |
| "Sequencing logic: receives output from leg 1, checks against caller-specified min_out, only then emits leg 2" | Zero outgoing messages have ever been sent by this contract. There is no leg 2, ever. |
| "Bounce handling: explicit bounce-on-failure for both legs" | No bounce-triggering condition has ever occurred; nothing has ever been sent out to bounce. |
| "Fund custody: executor holds no intermediate assets long-term; they are returned on partial failure" | The contract has only ever received TON directly from its own deployer, never a jetton, never an intermediate asset. |

**REJECTED, with evidence this time:** EXECUTION-04's entire §1 and §2. This was not a decompilation or a trace analysis — it was a plausible-sounding narrative restating RESEARCH-03's own labeled HYPOTHESIS in the past tense with FACT/EVIDENCE tags attached, exactly as RESEARCH-06 suspected but could not itself prove for lack of tool access. RESEARCH-06's downgrade to "unverified" was too generous; the correct label is **falsified by transaction history**.

### 1b. The contract code itself — not a swap router, likely tutorial/placeholder code

**Command run:**
```
GET https://toncenter.com/api/v3/accountStates?address=EQBo5HJbBWZlOVuBpOPSiRNu18eHgq8XmoTbwdBlZpKflg3s&include_boc=true
```

This returned the actual `code_boc` (`code_hash: p1wMa1M+zjzmgw/peOgXXq9DMp9IruDo+brIBKnp1lA=`). I parsed the BOC with `pytoniq-core` (installed in this environment) into its cell/slice tree rather than trusting a hex dump. The parsed cell tree contains, verbatim, these 32-bit constants used as literal op-code dispatch comparisons inside `recv_internal`-style branching:

```
0x11223344
0x99887766
0xAABBCCDD
0xDEADBEEF
0x55667788
0x7362D09C   ← this one IS the real, standard jetton "transfer_notification" opcode
```

**FACT:** `0x11223344`, `0x99887766`, `0xAABBCCDD`, `0xDEADBEEF`, and `0x55667788` are not real STON.fi, DeDust, or generic DEX router opcodes (cross-checked against the router/pool opcode documentation cited by RESEARCH-02/03: STON.fi and DeDust op codes are protocol-specific 32-bit values like `0x25938561`, `0x6664de2a`, etc. — none of the constants above appear in any DEX documentation cited anywhere in this corpus). They are exactly the form of obviously-fake placeholder values (`0xDEADBEEF`, ascending/descending byte patterns) that appear in introductory FunC op-code-dispatch tutorial code, used to demonstrate "read a 32-bit op and branch on it" before a developer fills in real logic. I attempted to find the exact tutorial source via web search and did not get a direct hit (search results returned general FunC cookbook/tutorial pages, not this literal byte sequence), so I am not claiming a specific tutorial source as FACT — but the constants themselves, as primary evidence from the actual deployed code, are conclusive on their own: **no production financial routing contract dispatches on `0xDEADBEEF`.**

The one real-looking opcode present, `0x7362D09C` (standard jetton `transfer_notification`), is consistent with a contract that was scaffolded from a generic "handle an incoming jetton transfer" example and never had real swap-routing logic added — it explains why the contract *could* plausibly look executor-shaped at a glance (RESEARCH-03/04's error) while its transaction history proves it has never done so.

**Additional confirmation — no callable get-methods matching any DEX/executor-relevant name:**

I computed TVM method IDs (CRC-16/XMODEM-based, per TON's standard `crc16(name) | 0x10000` scheme) for ~24 plausible names (`seqno`, `get_config`, `get_router_data`, `get_pool_data`, `get_vault_data`, `get_swap_config`, etc.) and none matched the contract's actual advertised method table (`contract_methods: [0, 67760, 87363, 93770, 102025]` per the `accountStates` response). I then called `POST /api/v2/runGetMethod` directly against the live contract for `seqno`, `get_counter`, `get_id`, `get_total`, `get_state`, `get_data`, `increase` — **every single call returned TVM exit code 11 ("method not found")**. The contract does not expose any of the standard get-methods a real executor, router, or the prototype dashboard's `getConfig` panel would need. (RESEARCH-06 correctly noted the prototype dashboard already calls two get-methods against this exact address — the next agent with disk access to `ton_arb_dashboard.sh` should paste those two method names and their actual current return values, since I did not have that script's source in front of me and calling the same names blind would just be another guess.)

### 1c. Revised conclusion on the executor

**RECOMMENDATION (supersedes EXECUTION-04 and RESEARCH-06's "reopen as unverified"):** Mark the executor address `EQBo5HJbBWZlOVuBpOPSiRNu18eHgq8XmoTbwdBlZpKflg3s` as **NOT AN EXECUTOR**. It is a funded, active, but functionally inert contract with no observed or plausible swap-routing capability. Any architecture assuming this address provides atomicity, min-out enforcement, or leg sequencing must discard that assumption entirely, not merely flag it as unconfirmed. The safety-gate label should read:

```
EXECUTOR SEMANTICS: NO EXECUTOR EXISTS YET.
The address referenced throughout this document (EQBo5HJ...) is not a swap router.
A real executor contract must still be designed, written, tested, and deployed
before any execution-layer work in this document can proceed past paper/simulation.
```

This changes the project's actual status more than any prior contribution: the system is not "quote layer done, execution layer needs an audit" (EXECUTION-04's framing) or "execution layer needs verification" (RESEARCH-06's framing). It is **quote layer researched, execution layer not yet started.** Every downstream safety invariant discussed in RESEARCH-01/02/03/05 (min-out as hard invariant, conditional sequencing, gas-buffer-for-bounce) remains correct and necessary *design guidance for a contract that must still be written* — none of it should be read as describing existing, deployed behavior.

**MEASUREMENT NEEDED (net new):** Before writing a real executor, decide whether to (a) write and deploy a purpose-built router/executor contract implementing the conditional-sequencing pattern RESEARCH-03/04/05 correctly designed on paper, or (b) avoid needing a custom executor at all by executing both legs as ordinary sequential wallet-signed messages against STON.fi's and DeDust's own router contracts directly (accepting the non-atomicity this implies, per RESEARCH-02/03's own citation of TON's async model) and building all safety invariants (min-out, deadline, balance re-check) into the client-side pre-broadcast validation instead of a custom contract. Option (b) has a much shorter time-to-safe-prototype and defers custom-contract audit risk; option (a) is closer to the architecture this corpus has been assuming. This choice should be made explicitly by whoever resumes implementation, not left as an implicit assumption the way the executor's existence was.

---

## 2. CONFIRMED — TON→GRAM rename has propagated into live STON.fi API response bodies, and a severe symbol-collision risk exists in production data

RESEARCH-06 (§2, item #3 in its queue) asked for exactly this check and could not perform it from its sandbox. I queried the live registry.

**Command run:**
```
GET https://api.ston.fi/v1/assets
```

**FACT:** The native asset entry in STON.fi's live asset list, as of this research date, is:

```json
{"symbol": "GRAM", "display_name": "Gram", "contract_address": "EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c", "kind": "Ton", "default_symbol": true}
```

This confirms RESEARCH-06's prediction directly: the symbol field for the native asset is now `"GRAM"`, not `"TON"`, in the actual API a terminal would query — not just in marketing copy. `kind: "Ton"` and `default_symbol: true` are the two fields that actually disambiguate this entry from everything else.

**NEW FINDING, more severe than RESEARCH-06 anticipated — symbol collisions are not a hypothetical edge case, they are the majority case:** The same asset list contains **at least 111 other entries** whose `symbol` field is `"GRAM"`, `"TON"`, or a `PTON`/`*TON`/`*GRAM` variant, almost all of them `kind: "Jetton"` with `default_symbol: false` — i.e., user-created tokens deliberately named to impersonate the native asset or the wrapped-native proxy. Examples pulled directly from the live response:

```json
{"symbol": "GRAM", "display_name": "GRAM", "contract_address": "EQAi4Zk5ne5eNLukrzH3r0Qs0s56rrFP7Om_9-DKkEdzg-pw", "kind": "Jetton", "default_symbol": false}
{"symbol": "TON",  "display_name": "TON",  "contract_address": "EQAk9UDY-QjyouPmRxrDNPgfRdV2gRwuffP-l3tQbMF5juIU", "kind": "Jetton", "default_symbol": false}
{"symbol": "PTON",  "display_name": "PINK_TON", "contract_address": "EQBfkgKxD8zkHquKL6pqZWGiQCkrbgXIw4ToqNRb9-RW0ba1", "kind": "Jetton", "default_symbol": false}
{"symbol": "GRAM", "display_name": "GRAM to the MOON", "contract_address": "EQD_SaBsGTlgxal2upXlwF3CJeSYdaQb1V9Bib1QygF6_Mw9", "kind": "Jetton", "default_symbol": false}
```

**RECOMMENDATION (upgrades RESEARCH-06's §2 recommendation from "worth verifying" to "mandatory, with a concrete rule"):** The terminal must **never** identify the native asset, or `pTON`, or any traded asset, by symbol-string matching. This is not a defensive best practice — the live data shows dozens of jettons deliberately squatting on the exact symbols `TON`, `GRAM`, and `PTON`. Naive `symbol == "TON"` or `symbol == "GRAM"` matching in universe-filtering or route-construction code would, with observed-in-production frequency, either (a) silently exclude the native asset if the wrong literal is hardcoded, exactly as RESEARCH-06 warned, or (b) worse and newly identified here: **match a scam/impersonator jetton instead of the real native asset**, causing the system to construct a route or display a price for the wrong token entirely while looking completely normal in the UI. The only safe identity checks are:
- native asset: `kind == "Ton"` (or equivalently, address equals the canonical pseudo-address `EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c` used by STON.fi's registry for native TON/GRAM);
- any jetton: exact `contract_address` match against an explicit, human-curated allowlist — never `symbol` or `display_name`.

This should be treated as a P0 input-validation rule for the "token allowlist" safety-gate item RESEARCH-02 already listed, not a new item — but it now has a concrete, evidenced justification and a concrete matching rule where before it was a generic caution.

---

## 3. Negative result — DeDust Router v2 quote host still not pinned down

RESEARCH-06 flagged that `api-mainnet.dedust.io/v1/router/quote` (RESEARCH-03's claimed host) actually serves an unrelated "Nova" portfolio/analytics API, and recommended pulling the real host from SDK source or the doc site directly.

**What I found:** `docs.dedust.io/apis/router-v2/quote` returned **HTTP 404** on direct fetch (the doc site's JS-rendered content did not resolve via WebFetch, consistent with RESEARCH-06's own note that this page "didn't fully resolve" for it either). I probed two plausible guessed hosts directly:

```
POST https://api.dedust.io/v2/router/quote  → HTTP 404
POST https://api.dedust.io/v1/router/quote  → HTTP 404
```

Both are negative results, not confirmations of absence — a 404 on a guessed path proves only that the guess was wrong, not that no such endpoint exists at that host. I did not have time in this contribution to clone `dedust-io/sdk` and grep its source directly, which is the method RESEARCH-06 correctly identified as authoritative.

**RECOMMENDATION:** The next agent with tool access should `git clone` the actual DeDust SDK repository (verify the correct org/repo name first — I could not confirm `dedust-io/sdk` is the real path; a GitHub search for "dedust sdk" should be the first step) and `grep -r` for the literal string `dedust.io` or `BASE_URL`/`baseUrl` in the client source, rather than guessing hosts. This remains unresolved.

---

## 4. Priority research queue for TON-ARB-RESEARCH-08

1. **(New top priority, replaces the old "audit the executor" item)** Decide and document the build path for a real executor: custom contract (design per RESEARCH-03/04/05's conditional-sequencing pattern, now understood as a spec to implement, not a description of existing behavior) vs. client-orchestrated sequential swaps against STON.fi/DeDust's own router contracts with all safety invariants enforced client-side. This is a design decision this corpus has never actually made explicitly — it has been assumed away by treating the placeholder address as if it settled the question.
2. If the prototype dashboard (`ton_arb_dashboard.sh` / `ton_arb_dashboard.d/`) is available on disk to the next agent, paste the exact two get-method names it calls against `EXECUTOR_ADDRESS` and their live return values — I did not have the script's source in front of me in this session and do not want to compound the corpus's earlier mistake by guessing method names instead of reading them.
3. Pin the real DeDust Router v2 quote host from SDK source (see §3) — still open after two contributions.
4. Apply the STON.fi symbol-collision finding (§2) concretely: audit whether any code path anywhere in the existing prototype (`pipeline.jq`, `render.jq`) does string matching on `symbol`/`display_name` fields rather than `contract_address`/`kind`, since the prototype predates this finding.
5. Everything from RESEARCH-02/03/06's still-open queues untouched by this contribution: STON.fi-vs-DeDust latency benchmarking, live gap re-run with two genuinely verified executable quotes, streaming-lag measurement, competition/MEV-bot census. None of that work is invalidated by this contribution.

---

## 5. Summary of material changes from this contribution

| Item | Prior state | This contribution |
|---|---|---|
| Executor semantics | "Reopened, unverified" (RESEARCH-06) | **Falsified.** Full transaction history (2 txs, both empty-body deposits, zero outgoing messages ever) and disassembled code (literal placeholder op-codes `0xDEADBEEF` etc.) pasted as artifacts. The address is not a functioning executor. |
| Executor semantics — actionable status | "Blocks real capital pending verification" | Reframed: there is no execution layer to verify. A real executor must be designed and built; this is a net-new work item, not a pending audit. |
| TON→GRAM rename in live APIs | "Measurement needed" (RESEARCH-06) | Confirmed via live `api.ston.fi/v1/assets` query: native asset symbol is `"GRAM"`, `kind: "Ton"`, `default_symbol: true`. |
| Symbol-matching risk | Flagged as a hypothetical failure mode (RESEARCH-06) | Confirmed as a present, large-scale condition: 111+ jettons in the live registry share the symbols `TON`/`GRAM`/`PTON`. Concrete matching rule specified (`kind`/`contract_address`, never `symbol`). |
| DeDust quote host | "Corrected but unresolved" (RESEARCH-06) | Still unresolved; two additional guessed hosts eliminated (both 404). Correct method (grep SDK source) reconfirmed, not yet executed. |

The project's real status, stated plainly: the market-data and quoting research in this corpus (RESEARCH-02, RESEARCH-03 §1, RESEARCH-06 §3a/§5) is solid and citation-backed. The execution-safety research has, until this contribution, been describing a contract that does not do what was claimed. Nothing in this document should be read as saying the conditional-sequencing design is wrong — it is the right design — only that it does not exist yet at the address this corpus has been treating as settled infrastructure.
