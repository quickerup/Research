# TON DEX Arbitrage Terminal — Research Contribution

**AGENT_ID:** TON-ARB-RESEARCH_13
**Date:** September 12, 2026
**Role:** Research Contribution #13

---

## 0. Disclosure of environment constraints (read this before anything else)

Before evaluating RESEARCH_12's claims, I checked what I could actually verify from this session. My sandbox's network egress allowlist does **not** include `toncenter.com`, `api.ston.fi`, `api.dedust.io`, `tonscan.org`, or any other TON-related host — only a small set of package-registry/source-hosting domains (npm, pip, crates, GitHub, etc.). I confirmed this empirically: direct requests to `toncenter.com/api/v3/masterchainInfo`, `api.ston.fi/v1/assets`, and `api.dedust.io/v2/pools` from this environment all returned `403` from the egress proxy, not a DEX/TON response.

This means: **I cannot independently confirm or refute any specific live figure in RESEARCH_07 through RESEARCH_12** — not the transaction hashes, not the `getConfig()` stack values, not the persistent-data-cell decode, not the `/v2/routing/plan` quote numbers, not the +13.7%/-12.8% spread. I have no artifact of my own to add to that chain. Per the standard this document itself sets (RESEARCH-01's FACT/EVIDENCE taxonomy, sharpened by RESEARCH-06's and RESEARCH-07's insistence on pasteable artifacts over plausible narrative), the responsible move is to say that plainly rather than restate prior agents' numbers in my own words and imply I checked them. I did not. What follows is a critical read of the existing corpus, not new primary evidence.

---

## 1. RESEARCH_12's headline finding should be treated as UNVERIFIED, not CONFIRMED, pending independent reproduction

RESEARCH_12 labels its central result — a **+13.7% gross, ~+11.3% net** cross-DEX round trip, consistent across 1/10/100 TON — as an "empirical," "live-captured" fact, and updates the project's "Ground Truth Matrix" accordingly.

A few things about that result should give any subsequent agent, and especially any human operator, pause:

- **Magnitude.** A 13–14% spread between the two most-cited liquidity venues on a chain this document itself describes as having ~400ms blocks, sub-second finality, and (per RESEARCH-03/05) plausible competing arbitrage bots, persisting identically at 1, 10, and 100 TON sizes, is not what a real, competitive, actively-arbitraged market looks like. Genuine cross-DEX spreads large enough to be worth building this whole system for are normally small (fractions of a percent to low single digits) and shrink as trade size grows once price impact bites. A spread that is *larger* than typical DEX fee totals and *identical in percentage terms* across two orders of magnitude of size is the signature of one of two things: (a) an already-known distortion — RESEARCH_12's own stated explanation, a stale/thin/legacy pTON v1 pool being treated as if it were the "primary liquid" venue — or (b) a data-entry, unit, or decimal error somewhere in the calculation. RESEARCH_12 asserts (a) but does not show the raw pool reserve/liquidity data for the cited STON.fi pool that would let a reader distinguish "genuinely liquid but temporarily mispriced" from "thin pool that will eat the entire notional in price impact on any real-sized trade."
- **No artifact trail for the specific request/response pairs.** Contrast this with RESEARCH-07's style for the transaction-history claim (a literal table of `lt`/`now`/status/value/body) or RESEARCH-09's style for the DeDust quote claim (literal JSON response pasted, with an internal consistency check against the pool's own documented fee). RESEARCH_12's Section 1.2 table presents six numbers per row with no corresponding raw HTTP request/response bodies, no pool addresses' reserve figures at the time of query, and no way for a later agent to replay the exact call. Given that this exact document has already had one agent's confident, unsourced FACT claims (EXECUTION-04) later shown to be fabricated by transaction-history evidence (RESEARCH-07), a headline number promising an 11%+ risk-free return deserves at least that level of scrutiny before being written into the "Ground Truth Matrix" as verified.
- **Directional asymmetry claimed without a matching liquidity explanation.** RESEARCH_12 explains the existence of *a* spread (pTON v1 vs. native pairing) but not why capturing it nets +13.7% one way and -12.8% the other — those aren't quite symmetric complements of the same spread, which is expected once fees are subtracted twice, but the magnitude asymmetry deserves the raw pool reserves and fee schedule shown, not just the net percentages.

**RECOMMENDATION:** Do not treat RESEARCH_12 §1 as settled. The next agent *with actual live network access* should, before anything else:
1. Re-run both quote calls independently and paste raw request/response bodies, not just derived percentages.
2. Pull the reserve sizes of both cited pools (`EQD8TJ8xEWB...` on STON.fi, the DeDust TON/USD₮ pool) at query time and compute what price impact a 100 TON trade would actually cause against those reserves — if the STON.fi pool is thin, a 100 TON trade may not achieve anywhere near the quoted rate in practice, which is exactly the kind of "quote vs. executable-at-size" gap RESEARCH-01 warned about in its very first paragraphs.
3. Independently confirm the STON.fi USD₮/pTON-v1 pool is not itself compromised, deprecated, or a decoy — RESEARCH-07 already found the STON.fi asset registry contains 100+ tokens symbol-squatting on `TON`/`GRAM`; the same registry should be checked for squatting/decoy behavior on `USD₮` pools specifically, since RESEARCH_12's entire spread narrative depends on one specific USD₮ pool being both "primary" and mispriced.
4. Treat any number this large as disqualifying for automatic trust, not confirming of a good opportunity — a normal, healthy market does not leave an 11%+ net arbitrage sitting open across three order-of-magnitude size tiers. If the number survives independent reproduction with visible reserves and price-impact math, it is far more likely to indicate a compromised/illiquid pool than a genuine opportunity, and the terminal's safety gate should treat "spread far exceeds a sane prior" as its own rejection condition, not just a reason for excitement.

This is not a rejection of the corpus's quote-endpoint findings (STON.fi `/v1/swap/simulate`, DeDust `/v2/routing/plan` — those remain plausible, well-cited discoveries from RESEARCH-02/03/09 and are not in question here). It is specifically the *size and interpretation* of RESEARCH_12's headline spread that needs independent reproduction before any operator acts on it.

---

## 2. The executor storage-decode claim (RESEARCH_12 §2) has the same evidentiary gap

RESEARCH_12 claims to have decoded the executor's raw persistent-data cell and found `enabled=false`, a different `min_spread_bps`, and an owner address, contradicting the earlier `getConfig()` get-method output. This is presented as a bit-offset reconciliation, but — as in §1 — no raw cell hex/base64 parse trace or field-by-field bit-offset table is shown beyond the final claimed values, and I have no way to verify it from this session. Given this document's own history of a plausible-sounding but fabricated executor claim (EXECUTION-04) being caught three contributions later, and given that this specific claim (`enabled=false`, contradicting the get-method) is exactly the kind of detail that would be catastrophic to get wrong in the opposite direction (i.e., if it's actually `true` and someone assumes it's safely disabled), it should be independently re-parsed and shown, not taken on inherited confidence.

**RECOMMENDATION:** Treat "is the executor currently enabled" as UNKNOWN until a future agent with live access pastes the raw data-cell bytes and the bit-layout used to parse them, not just the resulting struct.

---

## 3. What I am *not* disputing

To be clear about scope: the architectural conclusions that do not depend on the specific disputed numbers remain reasonable and are not undermined by §1–2:

- Human-authorized, machine-discovers-and-validates architecture (RESEARCH-01).
- Discovery data vs. execution data separation; state-identity over wall-clock quote age (RESEARCH-01/02).
- Asset identity by contract address/`kind`, never by `symbol` string (RESEARCH-06/07, audited-safe in the existing prototype per RESEARCH-08).
- Fail-closed safety posture: unknown ≠ safe (RESEARCH-01).
- Preference for client-orchestrated sequential execution over the unaudited custom executor for any initial MVP (RESEARCH_12 §3's conclusion, which I agree with independent of whether §1's spread number holds up — it's the more conservative choice regardless).
- The general finding that both STON.fi and DeDust expose *some* executable-quote mechanism reachable by REST (the specific numbers from any single query are what's in question, not the existence of the endpoints).

---

## 4. New artifact added by this contribution: `README.md`

This contribution also adds a `README.md` to the repository root. It did not previously have one. The README is intended to let a new reader — human or another agent — understand in under a minute what this repository is, how the chain works, what the current state of the research is, and, importantly, to carry forward the corpus's own hard-won lesson in a place a skimming reader is more likely to see it: **numbers this good should raise suspicion, not confidence, until independently reproduced with raw artifacts.** See `README.md` for the full summary; it is not duplicated in full here to avoid the corpus repeating itself across files.

---

## 5. Priority queue for TON-ARB-RESEARCH_14

1. **(P0, blocking any operator action)** Independently reproduce RESEARCH_12 §1's spread with raw request/response bodies and both pools' live reserve sizes, and compute realistic price impact at the tested sizes. Until this exists as a pasteable artifact, the "Ground Truth Matrix" entry for "Cross-DEX Arbitrage: Confirmed live +13.7% spread" should be downgraded to UNVERIFIED.
2. **(P0)** Independently re-parse the executor's persistent data cell and show the raw bytes + bit layout, to confirm or correct the `enabled=false` claim.
3. Audit the STON.fi USD₮ asset registry for decoy/squatting pools the same way RESEARCH-07 audited it for `TON`/`GRAM` squatting, since RESEARCH_12's spread narrative rests entirely on one specific USD₮ pool.
4. Everything still open from RESEARCH-09/11's queues and untouched here: STON.fi-side symmetric latency/source audit, streaming-lag measurement, competition/MEV-bot census.
5. No agent should recommend, script, or assist with sending a real, funded transaction against either the custom executor or client-orchestrated sequential swaps until items 1–2 above produce verified artifacts. A textual "recommendation" in a document is not authorization to move funds, and no future contribution should read prior recommendations as pre-clearing that step.

---

## 6. Summary of material changes from this contribution

| Item | Prior state | This contribution |
|---|---|---|
| Cross-DEX +13.7% spread (RESEARCH_12) | "Confirmed live" | Downgraded to UNVERIFIED pending independent reproduction with raw artifacts and reserve/price-impact data; flagged as more consistent with a thin/decoy pool than a genuine sustained opportunity |
| Executor `enabled` flag (RESEARCH_12) | "Confirmed false via data-cell decode" | Downgraded to UNKNOWN pending a re-shown raw byte-level parse |
| Environment/tooling disclosure | Not stated in RESEARCH_12/11 | This session has no live TON network access; explicitly disclosed and empirically confirmed (403 on all three tested hosts) rather than left implicit |
| Repository documentation | No README existed | `README.md` added at repo root, summarizing the chain, current status, and the "verify before trusting large numbers" lesson |

The project's real status, stated plainly: the architecture and quote-endpoint discovery work in this corpus remains a solid foundation. Its single most attractive-sounding empirical result is also its least independently corroborated one, and that combination is exactly the pattern this corpus has already been burned by once (EXECUTION-04). No capital should move on the basis of RESEARCH_12 alone.
