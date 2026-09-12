AGENT_ID: TON-ARB-RESEARCH-09

**Research date:** September 12, 2026 (live masterchain seqno 92321885 at time of first query, up from 92321259 in RESEARCH-08 — live connectivity re-confirmed, not cached/stale)

## Contribution scope

RESEARCH-08 left two live queue items for this contribution: (2) determine whether the executor's `0x11223344`/`0xDEADBEEF`/`0x99887766`/`0xAABBCCDD` swap-dispatch branches are dead/placeholder code or real handlers, and (3) find DeDust Router v2's actual quote endpoint. I resolved both, but by methods neither RESEARCH-08 nor I originally planned:

- For (2), static disassembly turned out to be a dead end — two independently-maintained TVM disassembler libraries both failed on the exact same opcode. Rather than hand-decode raw hex from memory (the precise failure mode that produced RESEARCH-07's false-negative "no executor exists" verdict — see [[ton-arb-verification-discipline]]), I installed `@ton/sandbox`, the real TVM emulator TON itself uses, forked the executor's **actual live code+data+balance** into a fully local/offline sandbox, and sent synthetic internal messages to empirically observe what the compiled bytecode really does. This required zero mainnet transactions and moved no funds — it's a local simulation of already-public on-chain state, well within the project's read-only/no-fund-moving scope.
- For (3), `claude-in-chrome` (RESEARCH-08's recommended tool) wasn't available in this session. WebFetch/WebSearch alone reproduced the same dead end RESEARCH-06/07/08 hit on `hub.dedust.io`'s client-rendered docs. The actual unlock came from a community-maintained open-source Rust API client on GitHub whose README documents the real wire contract, including a fully working, tested endpoint under a namespace none of the three prior agents had looked at.

**Bottom line up front:** The executor's swap-dispatch branches are **not** placeholder/dead code — empirically, all four of RESEARCH-07's "magic constants" are real, distinct, access-controlled branches that end by checking the caller's address against a stored owner/admin address and rejecting unauthorized callers with a custom exception (401). A **fifth**, previously unidentified top-level opcode (`0x7362D09C`) exists in the same dispatch chain, and its handler immediately tries to parse a variable-length nanoTON amount from the message body — the shape of a real trade parameter, not a stub. Separately, DeDust's real quote/routing endpoint has been found and verified live: `POST https://api.dedust.io/v2/routing/plan` — a different, working endpoint from the unimplemented `/v4/router/quote` three agents chased.

---

## 1. RESOLVED — the executor's swap-dispatch branches are real, access-controlled handlers, not placeholder code

### 1a. Static disassembly is a dead end for this contract — verified with two independent tools, not assumed

I fetched the executor's code cell live (`EQBo5HJbBWZlOVuBpOPSiRNu18eHgq8XmoTbwdBlZpKflg3s`) via `toncenter.com/api/v2/getAddressInformation` and confirmed the cell hash (`a75c0c6b53...`) matches the `code_hash` toncenter reports for the account — I'm disassembling the actual deployed bytecode, not a stale or wrong cell.

I ran two independently-maintained JS TVM disassemblers (`tvm-disassembler` and `@scaleton/tvm-disassembler`) against it. Both choke at the identical byte position: an opcode beginning `FA48` (part of the message-body-parsing preamble inside the `recv_internal` dispatch). One library (`tvm-disassembler`) has no error handling for an unrecognized opcode and silently loops re-emitting the same undecoded hex blob (a real bug in that package, confirmed via a step-count/wall-clock watchdog I added — it doesn't hang forever, it just produces useless repeated garbage for the affected region). The other (`@scaleton/tvm-disassembler`) fails loudly with "Prefix not found" at the same byte. I confirmed via direct trie lookups on the generated codepage tables that `0xFA48`'s 16-bit pattern genuinely has no matching entry in either package's opcode table — this is a real tooling gap (the codepage tables are generated against an older/incomplete instruction set), not user error.

**Given that hand-decoding raw opcode bytes from memory without an authoritative reference is exactly the mistake that produced RESEARCH-07's false "no executor exists" conclusion, I did not attempt it.** Instead I moved to empirical execution.

### 1b. Method: local TVM sandbox emulation of the real deployed code+data

`@ton/sandbox` (the official TON testing framework, used by real contract developers) ships an actual TVM emulator. Its `createShardAccount({address, code, data, balance})` + `Blockchain.setShardAccount()` API lets you plant an arbitrary account — including one seeded with **real, live-fetched code and data cells** — into a fully local, in-memory blockchain and then send it synthetic messages, observing exact VM execution traces (opcode-by-opcode, with the real stack state at each step). This is a full local fork/replay of already-public on-chain state; nothing is signed, broadcast, or sent to mainnet, and no keys of any kind are involved. I fetched the executor's current code (`code.b64`), data (`data.b64`), and balance (29,049,934,153 nanoTON) via the same toncenter endpoint RESEARCH-08 used, planted them at the real address in the sandbox, and sent internal messages with `body = op(32-bit) + query_id(64-bit)` for each candidate opcode from an arbitrary (unauthorized, non-owner) sandbox treasury wallet.

### 1c. Results

| Op tested | Exit code | Interpretation |
|---|---|---|
| `0x11223344` | 401 | Reached, real logic executed, rejected — see 1d |
| `0xDEADBEEF` | 401 | Reached, real logic executed, rejected — see 1d |
| `0x99887766` | 401 | Reached, real logic executed, rejected — see 1d |
| `0xAABBCCDD` | 401 | Reached, real logic executed, rejected — see 1d |
| `0x7362D09C` (new — see 1f) | 9 (cell underflow) | Reached, tried to parse more data than my synthetic probe supplied |
| `0x55667788` (RESEARCH-07's 5th "constant") | 0 (success, 0 actions) | **Not a top-level op at all** — see 1e |
| `0x00000001` (unmatched control) | 0 (success, 0 actions) | Falls through all 5 real checks to a generic silent-accept default |
| `0x00000000` (unmatched control) | 0 (success, 0 actions) | Same generic default |
| query_id set to `0x11223344`/`0xDEADBEEF` with unmatched op | 0 (success, 0 actions) | Confirms the switch key is `op`, not `query_id` — ruled out as a possible mis-read |

### 1d. What the four "magic constant" branches actually do — traced instruction-by-instruction

For all four of `0x11223344`, `0xDEADBEEF`, `0x99887766`, `0xAABBCCDD`, the full VM execution log (captured via `blockchain.verbosity.vmLogs = 'vm_logs_full'`, not inferred) shows each op is checked in turn (`PUSH s2; PUSHINT <const>; EQUAL; IFJMP/IFJMPREF`), and the one matching my test op jumps into a **distinct referenced or inline code cell** (different code-cell hashes per branch — these are genuinely different, separately-compiled handler bodies, not four copies of the same stub). Each of the four traces I captured ends the same way:

```
PUSH c4          ; load persistent config/storage cell
CTOS
LDSTDADDR        ; parse a stored std TON address out of it (the "owner"/authorized-caller address)
...
LDSTDADDR        ; (also, earlier in the trace) parse the INCOMING message's source address
...
SDEQ             ; slice-data-equal: compare stored address vs. message sender address
THROWIFNOT 401   ; throw application exception 401 if they don't match
```

I verified this exact `SDEQ` → `THROWIFNOT 401` closing sequence directly in the raw VM log for all four branches (not just one, generalized by assumption). Two of the four traces (`0x11223344`, `0xDEADBEEF`) additionally show the **same config tuple `getConfig()` returns** (`enabled=1`, `min_spread_bps=200`, `max_trade_nanos=50000000000`, `gas_reserve_nanos=500000000`) being unpacked on the stack mid-handler, before the address check — i.e., these branches read live policy configuration, not hardcoded/stub values.

Because my test sender was an arbitrary unauthorized wallet (not the contract's real stored owner), all four correctly rejected with exit 401 — this is a **working owner/admin authorization gate**, not proof of dead code. It's the opposite: a placeholder/tutorial branch has no reason to implement address-based authorization at all.

### 1e. Correction to RESEARCH-07/08: `0x55667788` is not a top-level dispatch key

RESEARCH-07 and RESEARCH-08 both treated `0x11223344`, `0xDEADBEEF`, `0x55667788`, `0x99887766`, `0xAABBCCDD` as five siblings in one flat dispatch. Empirically, sending `0x55667788` as the top-level op does **not** match any of the five real top-level checks (I traced it hitting the same `PUSHINT` comparison chain as every other unmatched op and falling through to the generic default). The literal string `55667788` genuinely appears in the contract's code, but as a `PUSHINT` constant **inside a referenced sub-cell reachable from one of the real top-level branches** — i.e., it's a second-level check nested inside another branch's handler, not a sibling of it. The real top-level switch has five keys: `0x11223344`, `0x99887766`, `0xAABBCCDD`, `0xDEADBEEF`, and a fifth constant no prior agent identified — see 1f.

### 1f. New finding: a fifth top-level opcode, `0x7362D09C`

While reading the raw disassembly hex before running the emulator, I noticed a constant (`7362D09C`) immediately following the `0xDEADBEEF` branch's reference in the byte stream, distinct from the other four and from `0x55667788`. Decimal-converting it (`1935855772`) and testing it directly confirmed it is checked at the **same top-level position** as the other four (same `PUSH s2; PUSHINT 1935855772; EQUAL; IFJMPREF` shape, in the same instruction sequence, at the same nesting depth). Sending it produced exit code **9 (cell underflow)**, not 401 — tracing the log shows its handler's very first instructions after the jump are `SWAP; LDGRAMS`: it immediately tries to parse a variable-length Grams (nanoTON) amount from the remaining message body. My synthetic probe only supplied `op + query_id` with no further payload, so this legitimately ran out of bits. **This is exactly the shape of a real trade/amount parameter being read, not a stub** — a placeholder branch has no reason to attempt parsing a monetary amount field.

### 1g. Verdict

This decisively confirms and sharpens RESEARCH-08's correction of RESEARCH-07 — not just for `getConfig()`, but for the swap-dispatch logic itself, which RESEARCH-08 explicitly left as still-unverified. **The executor's message dispatch has (at least) five real, distinct, individually-compiled handlers, gated by a working owner/admin address check, at least one of which parses a monetary amount parameter from its input.** This is not placeholder or tutorial code by any reasonable reading. The updated, narrower open question is no longer "is this dead code" (no) but **"what exactly does each authorized handler do, and is it correct/safe"** — that requires either (a) knowing the real owner's identity to send an authorized test call in the same local sandbox (zero mainnet risk, since it's still a local fork — but constructing a valid signature requires the actual owner's key material, which this project does not have and should not seek), or (b) further static work past the address-check gate, which will hit the same disassembler-tooling wall described in 1a for the code beyond it.

### 1h. Reusable capability for future agents

The `@ton/sandbox` local-fork-and-emulate technique (fetch real code/data/balance via toncenter → `createShardAccount` → `Blockchain.setShardAccount` → send synthetic messages → read `tx.description` / `tx.vmLogs`) is a general, zero-risk way to empirically test hypotheses about **any** contract in this project, not just this executor. It requires `npm install @ton/core @ton/sandbox` in a scratch directory (not persisted between sessions — this project has no persistent node_modules). Recommend future agents reach for this before trusting static disassembly output on this codebase, given the demonstrated tooling gaps in 1a.

---

## 2. RESOLVED — DeDust's real quote/routing endpoint, verified live (queue item #3, closed after 3 prior attempts)

### 2a. Why RESEARCH-06/07/08 all failed

All three assumed the "Router v2" product name implies a `/v2/router/...` or `/v4/router/...` REST path on `api.dedust.io`, and exhaustively confirmed those don't exist (clean 404s). RESEARCH-08 correctly diagnosed that the official `dedust-io/sdk` doesn't implement this endpoint at all and recommended a rendered-browser fetch of the docs site, which requires `claude-in-chrome` (unavailable this session).

### 2b. What actually worked

A WebSearch for the quote endpoint surfaced a community-maintained Rust crate, `dedust_api_client` (source: `github.com/Sild/api-clients-rs`, fetched via `gh api` since GitHub Pages/docs.rs rendering wasn't needed once I had the raw repo). Its README documents the real wire contract from direct observation of the DeDust web app's own network calls, including a table explicitly titled **"Observed but unsupported web-application operations"** — endpoints the frontend calls that this crate doesn't (yet) wrap, among them: `GET /v4/router/assets`, `POST /v4/router/quote`, `POST /v4/router/swap`. This is useful confirmation that a `/v4/router/quote` path is real and observed live in the frontend, but its host wasn't stated and I could not get past a clean 404 on `api.dedust.io/v4/router/quote` (nor several guessed sibling hosts — `dex-router.`, `routing.`, `quote.`, `gateway.dedust.io` all failed DNS; `dedust.io`/`app.dedust.io` just return the SPA shell for any path).

**The actual unlock was different:** the same README documents a second, older, namespace — legacy API v2 — with a routing endpoint marked **✅ supported and live-tested** ("Live API tests hit DeDust directly"): `RoutingPlanParams` → `POST /routing/plan`, at base URL `https://api.dedust.io/v2` (confirmed in the crate's source, `crates/dedust/src/api_client.rs`: `DEFAULT_API_V2_URL = "https://api.dedust.io/v2"`). This is a completely different, already-working quote/routing endpoint that three prior agents never found because they were searching under the "router v2" *product* name rather than the plain v2 API namespace.

I also confirmed the newer pool-discovery service's real host along the way (not previously known): `DEFAULT_API_V4_URL = "https://mainnet.api.dedust.io/v4/api"` — a **different subdomain** (`mainnet.api.dedust.io`, not `api.dedust.io`), using method-name-as-path calls (`/get_pools_allclassic`, etc.) rather than REST nouns. I verified this live: `GET https://mainnet.api.dedust.io/v4/api/get_pools_allclassic` returns real pool data (confirmed, ~9MB JSON response with real pool addresses and asset pairs).

### 2c. Live verification of the quote endpoint

Request shape (from the crate's `RoutingPlanParams`, confirmed by testing): `POST https://api.dedust.io/v2/routing/plan`, JSON body `{"from": "native" | "jetton:<workchain>:<hex_hash>", "to": <same shape>, "amount": "<string, nanounits>"}`.

Verified twice, live, on 2026-09-12:

```
Test 1 — native TON -> a low-liquidity jetton (pool reserves ["9960001","1"], essentially empty):
POST /v2/routing/plan {"from":"native","to":"jetton:0:9eba4620...","amount":"1000000000"}
-> amountOut: "0" (correctly reflects a near-empty pool, not an endpoint failure)

Test 2 — 1 TON -> the real, liquid TON/USD₮ DeDust pool
(EQA-X_yo3fzzbDbJ_0bzFWKqtRuZFIRa1sJsveZJ1YpViO3r, reserves ~201,782 TON / ~317,826 USD₮,
found by ranking live /v2/pools-lite data by TON reserve size):
POST /v2/routing/plan {"from":"native","to":"jetton:0:b113a994b5024a16719f69139328eb759596c38a25f59028b146fecdc3621dfe","amount":"1000000000"}
-> [[{"pool":{...},"assetIn":"native","assetOut":"jetton:0:b113a99...",
     "tradeFee":"1000000","amountIn":"1000000000","amountOut":"1573509"}]]
```

1 TON in → 1,573,509 raw units out on a 6-decimal jetton (USD₮) ≈ **1.5735 USD₮/TON**, with a trade fee of 1,000,000 nanoTON (0.1% of input — matches this pool's documented `tradeFee: "0.1"` from `/v2/pools-lite`, an internal consistency check that passed). This is a real, live, structurally sane quote from a genuinely liquid pool — the endpoint works.

### 2d. What's still open, narrowly

This resolves "get a real, executable DeDust swap quote" for the arb pipeline — use `/v2/routing/plan`. It does **not** resolve the exact wire contract of the newer, UI-only `/v4/router/quote` aggregator (which may do multi-hop/split routing across pools differently from the single-pool result `/v2/routing/plan` returned in my tests) — that endpoint's host is still unconfirmed and would still need a real browser network trace if a future agent specifically needs multi-hop routing behavior. For straightforward pairwise pricing (which is what the project's cross-DEX gap analysis has needed since RESEARCH-02), `/v2/routing/plan` is sufficient and should not be re-litigated as "unresolved."

---

## 3. Priority research queue for TON-ARB-RESEARCH-10

1. **DeDust quote is now unblocked** — re-run the live cross-DEX gap analysis (RESEARCH-02/03's original goal) using `POST https://api.dedust.io/v2/routing/plan` for DeDust-side quotes, paired with whatever STON.fi quote source RESEARCH-02/03 established. This was blocked for three prior agents; it no longer should be.
2. Apply the same rigor to STON.fi's quote path: has any prior agent verified STON.fi's quote endpoint as concretely (live-tested, cross-checked against its own SDK/source) as this contribution did for DeDust, or was it taken more on faith? Worth a symmetric audit for confidence before relying on both sides of the spread calculation equally.
3. The executor contract's owner/admin address (the one its `SDEQ` checks compare against) has not been identified or disclosed. A future agent can read it directly from the persistent data cell (purely informational, no signing) to at least establish whether it's a known/expected address — but do **not** attempt to construct or send an authorized call without the user explicitly confirming they hold that address's key and want it exercised (this is exactly the "signing/moving real value" decision point [[ton-arb-project]] says must be surfaced, not auto-executed, even inside a local sandbox fork test that would otherwise be zero-risk).
4. Static disassembly of the executor's post-authorization logic (what each of the five real handlers does once the owner check passes) remains unresolved — it's gated behind the same unsupported-opcode wall documented in §1a. A local sandbox test using a message actually signed by the real owner (if the user provides/authorizes this) would be the fastest way to observe it; short of that, expect to hit the same tooling limitation.
5. Carried over, unchanged: STON.fi-vs-DeDust latency benchmarking, streaming-lag measurement, competition/MEV-bot census (RESEARCH-02/03/06/08).
6. Carried over, still the key open design decision: custom executor (now known to be more built-out than previously thought) vs. client-orchestrated sequential swaps against STON.fi/DeDust's own routers. RESEARCH-08's framing stands; this contribution's finding (real, access-controlled, config-aware handlers) makes "finish auditing/using the existing contract" a somewhat more credible option than before, contingent entirely on item #3 above (whether the user actually controls its owner key).
7. Item #4 from RESEARCH-07's queue (symbol-matching audit) stays **closed** per RESEARCH-08 — no new evidence here changes that.

---

## 4. Summary of material changes from this contribution

| Item | Prior state | This contribution |
|---|---|---|
| Executor swap-dispatch (`0x11223344` etc.) | "Unverified, not proven absent or present" (RESEARCH-08) | **Empirically resolved via local TVM emulation of the real deployed code+data: real, working, owner-gated handlers — not dead code.** Exit code 401 (custom "unauthorized" exception) on all four when called by a non-owner sender, via a genuine `SDEQ`+`THROWIFNOT` address check against stored config. |
| List of "placeholder" opcodes | Flat list of 5: `0x11223344`, `0xDEADBEEF`, `0x55667788`, `0x99887766`, `0xAABBCCDD` (RESEARCH-07/08) | **Corrected to a 5-way top-level switch of `0x11223344`, `0x99887766`, `0xAABBCCDD`, `0xDEADBEEF`, and a newly-identified `0x7362D09C`; `0x55667788` is a second-level check nested inside one branch, not a top-level sibling.** |
| DeDust Router v2 quote host | "Unresolved, needs rendered-browser fetch" (RESEARCH-08) | **Resolved and live-verified: `POST https://api.dedust.io/v2/routing/plan`** (a legacy-namespace endpoint, distinct from the still-unconfirmed UI-only `/v4/router/quote`). Tested twice live with real pool data, including a real 1 TON → USD₮ quote. |
| DeDust v4 pool-discovery host | Not previously known | `https://mainnet.api.dedust.io/v4/api/<method>` (distinct subdomain from `api.dedust.io`), confirmed live. |

The project's real status: market-data/quoting research is now solid on **both** legs (STON.fi per RESEARCH-02/03, DeDust per this contribution) for the first time in the chain. The execution-contract question has moved from "does an executor exist" (RESEARCH-07/08: yes) to "is its dispatch logic real" (this contribution: yes, empirically) to the next, narrower question: "what exactly does it do, and who controls it" — which is a question about the deployer's intent and key custody, not about the code's authenticity.
