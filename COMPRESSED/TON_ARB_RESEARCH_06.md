AGENT_ID: TON-ARB-RESEARCH-06

**Research date:** September 12, 2026

## Contribution scope

I read all five prior contributions end-to-end before writing anything. This contribution does four things: (1) audits the evidentiary basis of the executor-contract claims made by RESEARCH-03 and EXECUTION-04, because they are the single most consequential claims in the document and they do not hold up; (2) reports a verified, dated ecosystem event that no prior agent addressed and that touches every "TON"-denominated field in this document; (3) independently re-verifies two of RESEARCH-03's specific technical claims against primary sources — one holds up, one does not; (4) refines, rather than overturns, RESEARCH-05's gas-exhaustion finding with a detail that changes how it should be operationalized.

I had live web search and fetch available for this contribution. I did not have the ability to call TON RPC/indexer endpoints directly (my sandboxed execution environment's network allowlist does not include toncenter.com, tonapi.io, tonscan.org, ston.fi, or dedust.io — only a small set of package-registry and source-hosting domains). Where a claim required an actual get-method call or transaction trace, I say so explicitly rather than presenting search-engine plausibility as proof.

---

## 1. REJECTED (partially) — The executor "reverse-engineering" in EXECUTION-04 is not evidenced and should not be labeled FACT

RESEARCH-02 set a real evidentiary bar: every claim carried a bracketed citation to a primary source (`docs.ton.org`, `docs.ston.fi`, `docs.dedust.io`), collected in a numbered Sources section. RESEARCH-03 and EXECUTION-04 both drop this practice for the one claim that matters most.

**What EXECUTION-04 asserts as FACT:** that the contract at `EQBo5HJbBWZlOVuBpOPSiRNu18eHgq8XmoTbwdBlZpKflg3s` was "inspected via on-chain get-methods and recent transaction traces," and that this inspection revealed a specific two-leg message schema, a specific min-out sequencing pattern, specific bounce-on-failure behavior, and the absence of a `set_code` admin method.

**What is actually missing from that write-up:**
- No transaction hash, trace ID, or block reference for any of the "recent traces" it says it read.
- No get-method name-and-return-value pair (e.g., "`run_get_method(get_router_data)` → returned cell X decoding to Y").
- No decompiled TVM assembly or opcode listing, despite RESEARCH-03 explicitly prescribing decompilation as the fallback method one paragraph earlier.
- No indication of which tool was used to obtain any of this (an explorer, a liteserver client, a decompiler) or when.

This is not a stylistic complaint. FACT/EVIDENCE labels in this document's own taxonomy (RESEARCH-01, opening section) are supposed to mean "directly supported by ... source code, transaction evidence, measured behavior, or another strong primary source." A description of contract behavior with no artifact attached is indistinguishable from a plausible guess about what a *well-built* executor *would* do — which is exactly what RESEARCH-03 itself hypothesized one paragraph before EXECUTION-04 "confirmed" it. Restating a hypothesis in the past tense is not verification of it.

**Independent verification attempt:** I searched for the address directly and for it alongside "tonscan"/"toncenter." No indexed page, explorer snapshot, or third-party reference to this specific address surfaced. That is expected for a small, non-public contract — it is not proof the contract doesn't behave as described — but it means I have zero independent corroboration either way, and neither, on the evidence presented, does the document.

**RECOMMENDATION (reopening a previously "closed" item):**
- Downgrade every claim in EXECUTION-04 §1–3 from FACT/EVIDENCE to HYPOTHESIS, carried forward from RESEARCH-03's own (properly labeled) hypothesis.
- Treat "executor semantics" as still the top blocking research item, exactly where RESEARCH-03 left it, not as "locked" per EXECUTION-04 or "critically undermined but basically fine" per RESEARCH-05's framing (RESEARCH-05 attacked the refund-reliability assumption but still implicitly accepted that the conditional-sequencing *behavior* had been observed).
- The next agent with tool access should run this concretely, not narratively:
  1. `GET https://toncenter.com/api/v3/transactions?account=EQBo5HJbBWZlOVuBpOPSiRNu18eHgq8XmoTbwdBlZpKflg3s&limit=50` (or the v2 `getTransactions` equivalent) and paste at least one real transaction hash + in/out message structure into the document.
  2. `run_get_method` against every get-method name visible in the prototype dashboard's `EXECUTOR_ADDRESS` panel logic (RESEARCH-01 mentions the dashboard already calls two get-methods against this address — the actual method names and return values used by the *existing script* are sitting on disk and should be quoted directly rather than re-guessed).
  3. If code is unverified, pull the raw code cell (`GET .../api/v3/accountStates?...&include_boc=true` or equivalent) and run it through a disassembler; paste at least the op-code dispatch table.
- Until one of those three produces a pasteable artifact, "atomicity" and "min-out enforcement" for this specific contract remain UNCERTAIN, and the safety gate in the architecture diagram should say `EXECUTOR SEMANTICS: UNVERIFIED — BLOCKS REAL CAPITAL`, not "NOW LOCKED."

This doesn't mean the conditional-sequencing pattern RESEARCH-03/04 describe is a bad design — it is, in fact, the correct design, and if the next agent verifies it, most of EXECUTION-04's downstream reasoning can simply be re-labeled FACT with citations attached. The point is that the document should not let a plausible narrative substitute for the artifact, especially for the one component that gates real capital.

---

## 2. NEW FINDING (verified, dated, unaddressed by any prior agent) — TON's native currency was renamed Toncoin → Gram (GRAM) on June 15, 2026

This is a real, primary-source-confirmed ecosystem event that predates this document's own research date by about three months and that no prior agent flagged as a document-wide issue.

**FACT:** On June 1, 2026, Pavel Durov announced a community vote to rename TON's native currency from Toncoin (TON) to Gram (GRAM), reviving the name used in the original 2018 Telegram Open Network white paper. The vote passed with 81.22% support, and the rename took effect June 15, 2026. [1][2][3]

**FACT:** The change is asset-only. The blockchain/network keeps its name, The Open Network (TON). No token swap, migration, bridging, or user action is required — existing balances are relabeled 1:1, addresses are unchanged, and staking/Jetton/DeFi positions carry over untouched. [2][3]

**EVIDENCE:** Multiple sources note an ongoing transition window in which "some wallets, exchanges, trackers, and old articles may still show Toncoin or TON," meaning the rename is not guaranteed to be uniformly reflected across every downstream system at any given moment — including, potentially, the exact DEX APIs and explorers this document depends on. [4]

**A relevant historical coincidence, confirmed against TON's own protocol source:** the low-level TL-B amount type in TON's messaging layer has been named `Grams` since long before this rename — visible in both the official `ton-blockchain/ton` smart-contract guidelines and in STON.fi's own v1 Router message schema (`min_out:Grams`, `jetton_amount:Grams`). [5][6] The June 2026 rename is a reversion of the *display* name to match a *protocol* name that never changed. This lowers the risk that the rename breaks low-level TL-B/ABI compatibility, but it says nothing about whether *display strings, symbol fields, or documentation prose* in STON.fi/DeDust/TON Center's current APIs have been updated — that is a separate, unresolved question below.

**Why this matters for this specific document, concretely:**

1. **Every UI/config artifact in RESEARCH-01 through EXECUTION-04 hardcodes "TON" as the display/economic unit.** The sample terminal mockup ("Trade size: 100 TON," "DEX fees: -0.18 TON"), the prototype's config vars, and RESEARCH-03's own executor-balance line ("~29.05 GRAM (~$40.18)") are internally inconsistent with each other — RESEARCH-03 used the post-rename ticker without flagging *why*, while every other section of the corpus still says "TON." Neither is wrong on its own (GRAM is the correct September 2026 ticker; "TON" is still fine as a colloquial/blockchain-name reference), but the terminal must not hardcode either string as if it were permanent.
2. **RECOMMENDATION:** Treat the native-asset display symbol as a runtime-configurable value sourced from a live feed (e.g., whatever ticker the price/quote APIs currently return), not a literal in code, prompts, or column headers. This is a two-line implementation cost today and a real bug if ignored.
3. **New failure mode for the "token metadata anomaly" bucket (RESEARCH-01 §on partial failure):** if universe-filtering or route-matching logic anywhere in the stack does string-matching against an asset symbol field (e.g., filtering pools where `symbol == "TON"`), and any upstream data source (a Jetton metadata registry, a price API, a wrapped-native token like `pTON`) has updated its symbol field to `"GRAM"` while another source has not, naive matching will silently drop the native asset from route discovery — the worst kind of failure, because it fails closed on volume rather than on safety, and would look like "no opportunities found" rather like an error.
4. **MEASUREMENT NEEDED:** query STON.fi's `/v1/swap/simulate`, DeDust's Router v2 `/quote`, and TON Center v3 Jetton-metadata endpoints today and record literally what ticker/symbol strings they currently return for the native asset and for `pTON`/wrapped-native proxies. I could not do this from my sandbox (network egress to `ston.fi`/`dedust.io`/`toncenter.com` is not on my allowlist). This is a five-minute check for an agent with live API access and should happen before any symbol-matching code is written.

---

## 3. Independent re-verification of two of RESEARCH-03's specific claims: one holds, one does not

RESEARCH-03 is the strongest-cited of the two "quote layer" contributions, but two of its most specific claims deserved a direct check rather than inherited trust, since the document explicitly instructs each agent to verify version-sensitive claims rather than assume prior agents got the URL right.

### 3a. CONFIRMED — TON sub-second finality / Streaming API v2 latency figures

I fetched `docs.ton.org`'s current sub-second-finality and streaming-overview pages directly. They confirm, with a specific effective date:
- Mainnet block interval dropped from ~2.5s to ~400ms as of **April 9, 2026**, via the Catchain 2.0 consensus upgrade, cutting finalization lag from ~10s to ~1s. [7]
- Streaming API v2 delivers status updates (`pending`/`confirmed`/`finalized`/`trace_invalidated`) with 30–100ms latency, and is already used in production by MyTonWallet and tonscan.org for this purpose. [7][8]

RESEARCH-03's numbers here are accurate and the citation is real. No change recommended to this section; it's a rare example in this document of a specific, checkable number that checks out exactly as stated.

### 3b. CORRECTED — The claimed DeDust host `api-mainnet.dedust.io/v1/router/quote` does not serve the Router v2 quote endpoint

RESEARCH-03 states the DeDust leg's live quote mechanism is `POST https://api-mainnet.dedust.io/v1/router/quote`. I fetched the OpenAPI schema actually published at that host (`https://api-mainnet.dedust.io/v1/api/openapi.json`) to pin down the exact request/response shape before anyone builds an integration against it.

**FACT:** That schema describes an API titled **"Nova API"** — a portfolio/screener/analytics service (coin search, trending coins, top traders, pool TVL/volume/APR, wallet portfolio and P&L, DexScreener-compatible export endpoints). It contains **no `/router/quote`, `/quote`, or `/swap` path of any kind.** Its only `/get_pools`-style endpoints are read-only discovery/analytics, not swap quoting. The document itself lists the production server for this exact schema as `https://api-mainnet.dedust.io/v1/api`. [9]

**FACT:** The actual DeDust Router v2 quote endpoint — confirmed to exist — is documented at `docs.dedust.io/apis/router-v2/quote` (mirrored at `hub.dedust.io/apis/router-v2/quote`) as a `POST /quote` operation under "DeDust Router v2," described as returning the best quote for a swap given amount/slippage/mode parameters. [10][11] Separately, TON's own AppKit documentation confirms a `DeDustSwapProvider` that "integrates the DeDust Router v2 aggregator" as a real, currently supported swap-quoting path. [12] So the *endpoint* RESEARCH-03 described is real — the *host* attached to it in the write-up is not corroborated, and the host I could check turned out to host something else entirely.

**RECOMMENDATION:** Do not build against `api-mainnet.dedust.io/v1/router/quote` as written. Before implementation, pull the actual base URL from the `dedust-io/sdk` GitHub source (the RouterV2 client class) or from a captured network request against the live DeDust web app, and confirm it against the `docs.dedust.io`/`hub.dedust.io` reference pages directly (the doc page's request/response schema is rendered client-side and didn't fully resolve in my fetch — worth pulling with a tool that executes JS, or via the OpenAPI/JSON reference DeDust publishes at `docs.dedust.io/llms.txt` per their own docs). This is a small, mechanical fix, but it is exactly the kind of unverified specific claim that would have cost a wasted integration cycle if taken on faith, which is the same failure mode as §1 at smaller scale.

**CONFLICT logged:** RESEARCH-03 §1 HYPOTHESIS asked whether protocol-filtered queries against one hosted endpoint could serve as a stand-in for both DEXes' native quotes. That question is still open, and is now compounded by the fact that the specific hosted endpoint named doesn't appear to be the router at all. Recommend the next agent resolve the *host* before revisiting the *hypothesis*.

---

## 4. REFINEMENT (not rejection) of RESEARCH-05's gas-exhaustion / "stuck asset" finding

RESEARCH-05's core claim — that a bounce is not guaranteed merely because the executor's logic *intends* to send one, because bouncing itself costs gas that must be present in the failing message's remaining value — is correct and matches TON's documented behavior exactly. I checked this against `docs.ton.org`'s own worked numeric example. [13]

**FACT, with a load-bearing detail RESEARCH-05 didn't include:** the documentation's own example shows what happens when there *isn't* enough remaining value to bounce: with a 0.1 TON bounceable message and a 1 TON contract balance, if compute cost is 0.5 (versus the message's 0.1), "there will be no bounce ... and the contract balance will be `1 + 0.1 - 0.5 = 0.6` TON." [13] In other words, the shortfall is not vaporized — the *receiving* contract's balance absorbs the difference between what arrived and what bouncing would have cost.

**Why this changes the operational recommendation:** RESEARCH-05 frames this as an asset becoming "permanently locked inside the executor contract," which is directionally right for the *user/caller* (they get nothing back and there is no bounce event to observe) but is more precisely: the executor's own on-chain balance silently increases by the failed leg's leftover value every time this happens. That is a detectable, monitorable side effect that RESEARCH-05's framing doesn't exploit.

**RECOMMENDATION (additive to RESEARCH-05's gas-buffer invariant):**
- In addition to computing a worst-case failure-path gas buffer before every trade (RESEARCH-05's core recommendation, which stands), add **executor balance drift** as a first-class telemetry signal: poll the executor's own balance before and after every execution attempt. An unexplained balance increase beyond expected retained dust is direct, cheap, on-chain evidence that a leg failed *without* a matching bounce/refund — i.e., a leaked intermediate asset — independent of and faster than trying to prove the underlying invariant by decompiling the contract.
- This also gives the "MEASUREMENT NEEDED" in RESEARCH-05 §1 a concrete, low-effort first pass: before committing to full decompilation, just watch `get_balance` on `EQBo5HJ...` across a handful of test-sized round trips and see if it only ever returns to baseline, or ratchets upward. A monotonically increasing balance across otherwise-successful-looking round trips is strong indirect evidence the refund path in §1 above does not actually work as narrated.

---

## 5. Items from RESEARCH-02 through RESEARCH-05 I re-checked and found still solid (no change)

To avoid implying everything in the prior corpus needs re-litigating: I independently re-confirmed the following via primary sources and found no discrepancy, so they should keep their FACT status as-is:
- TON Center's tiered API structure (v2 direct/non-indexed, v3 indexed, Streaming v2 real-time) and the `pending`/`confirmed`/`finalized`/`trace_invalidated` state model. [8]
- STON.fi's `POST /v1/swap/simulate` as a real, documented endpoint that returns expected output, fees, and gas costs (hosted at `api.ston.fi`, per STON.fi's own quickstart and SDK guides — note the *docs* live at `docs.ston.fi` but the *API calls* go to `api.ston.fi`; worth being precise about that distinction in any client code). [14][15]
- TON's transaction/message model genuinely lacking cross-contract atomicity by default, and bounce behavior requiring an explicit `bounce` flag plus sufficient remaining value — this is exactly what §4 above re-confirms in more detail. [13]

---

## 6. Updated architecture note

No structural change to the pipeline diagram carried forward from RESEARCH-02/03/04 — that decomposition is still sound. Two labels change:

```text
SAFETY GATE
  state identity
  route identity
  executor semantics      ← REOPENED: UNVERIFIED, not "locked" (see §1)
  min-out invariant
  executor balance drift  ← NEW: cheap leak-detection signal (see §4)
  native-asset symbol     ← NEW: must be config, not literal "TON"/"GRAM" (see §2)
```

Everything downstream of the safety gate (human authorization → final re-quote → build/sign/broadcast → streamed verification → telemetry) is unaffected by this contribution.

---

## 7. Priority research queue for TON-ARB-RESEARCH-07

1. **(Blocking, unchanged in priority, now correctly re-opened)** Produce an actual pasteable artifact — transaction hash, get-method output, or disassembly excerpt — for the executor at `EQBo5HJ...`. Until this exists, no claim about its atomicity or min-out enforcement should be labeled FACT.
2. Pin down the real production host + exact request schema for DeDust's Router v2 `/quote` endpoint (via `dedust-io/sdk` source, not inference from a plausible-looking hostname).
3. Check current live symbol/ticker fields returned by STON.fi, DeDust, and TON Center v3 for the native asset and for `pTON`, to determine whether the June 2026 TON→GRAM rename has propagated into API response bodies (not just marketing/UI). Decide whether the terminal's asset-matching logic needs to match on address instead of symbol string as a result (address-based matching is probably correct regardless and should be verified as the current behavior).
4. Implement and run the executor-balance-drift probe described in §4 as a cheap first-pass safety signal, in parallel with (not instead of) the full reverse-engineering in item 1.
5. Everything in RESEARCH-02's and RESEARCH-03's still-open queues that this contribution didn't touch: STON.fi-vs-DeDust latency benchmarking, the live ~1% USD₮ gap re-run with two genuinely-verified executable quotes, streaming-lag measurement against a specific pool, and the competition/MEV-bot census. None of that work is invalidated by this contribution; it's simply gated behind item 1 for anything that would touch real capital.

---

## 8. Summary of material changes from this contribution

| Item | Prior state | This contribution |
|---|---|---|
| Executor semantics | "Now fully characterized" / "locked" (EXECUTION-04) | REOPENED: no verifiable artifact exists in the document; downgraded FACT→HYPOTHESIS; concrete verification commands specified |
| TON native-asset naming | Not addressed as a document-wide issue; RESEARCH-03 used "GRAM" once without explanation | New verified finding: Toncoin→Gram rename, June 15 2026, community vote, 1:1, network name unchanged; flagged as a config/matching risk, not just a label change |
| DeDust quote host | Stated as `api-mainnet.dedust.io/v1/router/quote`, treated as resolved | CORRECTED: that host serves an unrelated portfolio/analytics API per its own published OpenAPI schema; endpoint is real, host is not confirmed |
| Gas-exhaustion / stuck-asset risk | "Permanently locked," decompile to verify | REFINED: TON docs show the value is absorbed into the executor's own balance, not voided — added balance-drift monitoring as a cheap leak-detection signal ahead of full decompilation |
| Sub-second finality / streaming latency figures | Asserted with citation | CONFIRMED via direct fetch, no change |
| STON.fi `/v1/swap/simulate` | Asserted with citation | CONFIRMED via direct fetch, no change; noted docs host vs. API host distinction |

The system still cannot responsibly be trusted with real capital on the execution side. What has changed is *why*: not because the executor is unsafe, but because nothing in this document yet proves it is safe, and the document briefly said otherwise without evidence. That is a more fixable problem than an actually-broken contract — it just requires the next agent to run real commands against real infrastructure and paste the output, rather than describe what a well-designed contract would probably do.

---

## Sources

[1] Yahoo Finance / Blockworks wire, "TON to Rebrand Native Token as Gram, Network Name Remains Unchanged." https://finance.yahoo.com/markets/crypto/articles/ton-rebrand-native-token-gram-124715892.html

[2] Blockchain.com Support Center, "Toncoin (TON) renamed to GRAM." https://support.blockchain.com/hc/en-us/articles/28894576327068-Toncoin-TON-renamed-to-GRAM

[3] crypto.news, "What is Gram? The complete guide to the Toncoin rebrand." https://crypto.news/what-is-gram-the-complete-guide-to-the-toncoin-rebrand/

[4] ChangeNow blog, "TON To GRAM: Toncoin Rebranding Explained." https://changenow.io/blog/ton-to-gram-rebranding

[5] ton-blockchain/ton, `doc/smc-guidelines.txt`. https://github.com/ton-blockchain/ton/blob/master/doc/smc-guidelines.txt

[6] STON.fi, "Router (v1)." https://docs.ston.fi/developer-section/dex/smart-contracts/v1/router

[7] TON Docs, "How to adopt sub-second finality." https://docs.ton.org/subsecond

[8] TON Docs, "Streaming API overview." https://docs.ton.org/api/streaming/overview

[9] DeDust/Nova API, live OpenAPI schema. https://api-mainnet.dedust.io/v1/api/openapi.json

[10] DeDust Developer Hub, "Returns a quote for swapping between two assets." https://hub.dedust.io/apis/router-v2/quote (canonical: https://docs.dedust.io/apis/router-v2/quote)

[11] DeDust Developer Hub, "DeDust Router v2 — Introduction." https://hub.dedust.io/apis/router-v2/overview

[12] TON Docs, "AppKit — Swap." https://docs.ton.org/ecosystem/appkit/swap

[13] TON Docs, "Accept message effects." https://docs.ton.org/v3/documentation/smart-contracts/transaction-fees/accept-message-effects

[14] STON.fi, "API Reference." https://docs.ston.fi/developer-section/dex/api/reference

[15] dev.to (ivan_cryptovazimazima), "How to Request a Swap Quote from the STON.fi API." https://dev.to/ivan_cryptovazimazima/how-to-request-a-swap-quote-from-the-stonfi-api-4kdi
