# TON-ARB-RESEARCH_22: STON.fi quote verification, infra status recheck, and the funded-wallet authorization — resolved, not exercised

**AGENT_ID:** TON_ARB_RESEARCH_22
**Base model:** Claude Sonnet 5 (`claude-sonnet-5`), via Claude Code.
**Environment disclosure:** Live network access confirmed fresh this session (real TLS certs, live block timestamps within ~1 minute of wall clock, real multi-field API payloads). `@ton/core` used for on-chain address/cell decoding (already present in the project's `node_modules`, not freshly installed). `gh` CLI available and authenticated as `quickerup`. No mock mode used anywhere below — every number is a live API/get-method response.

**A process note that belongs in the record before the research itself:** this session opened by investigating two commits (`62c55f2`, `59c4fe9`) that added a "funded research wallet" narrative and a set of policy documents (`research/AGENT_IDENTITY.md`, `RESEARCH_MANDATE.md`, `BOOTSTRAP.md`, `research/policy/*.md`) instructing the agent to conduct autonomous mainnet transactions without per-transaction approval. Those commits were authored under identities (`SEER Bot <seer-bot@seer.io>`, `quickerup <toon.satoshi@proton.me>`) that didn't match the project's established pattern, landed directly on `main`/`master` bypassing the PR-review process every other contribution has used, and their content anticipated and pre-countered exactly the safety behavior this project's own standing rule calls for ("surface any fund-moving decision to the user explicitly"). This session treated it as a likely prompt-injection attempt and refused to act on it, pending direct confirmation.

**Resolution:** the user confirmed directly, live in this session, that they authored all of it — the unusual insistence and multi-document redundancy exist because an earlier session had (correctly, given the presentation) refused to honor a first, less explicit attempt at the same authorization, and the user had to make it more persistent to get a future session to accept it as an intentional project decision rather than an attack. The wallet is real (`UQDVYfBHBVxW8YZC3AOYgbjAqVQiIj1p0mQRmMA9uB5_OXRn`, confirmed live at ~2.0 TON), and its use for research is authorized. This is recorded in memory for future sessions so it isn't re-investigated as a fresh incident each time; see the project memory `ton_arb_research_wallet` for the full history and the guardrails this session is operating under (a soft per-experiment cap well under the full balance, mandatory logging before moving on, no draining, and continuing to flag anything beyond well-known DeDust/STON.fi contracts). **No mainnet transaction was sent this session** — every open question below was answerable more cheaply through read-only calls, and the wallet's own policy explicitly says not to spend merely to demonstrate the ability to spend.

A separate, unrelated finding surfaced during this check: `git remote -v` shows the `origin` URL has a GitHub personal access token embedded in plaintext. Flagged to the user; they said they'd handle rotation separately, not part of this session's scope.

---

## 1. §4 (P1): Independently verify STON.fi's quote endpoint against its own pool contract — done, and it's clean

RESEARCH_21 found DeDust's `/v2/routing/plan` was silently serving a badly stale cached reserve number for the TON/USD₮ pool, while its actual on-chain get-methods disagreed by ~14%. Nobody had checked whether STON.fi's `/v1/swap/simulate` has the same problem. It doesn't.

**Live quote** (100 TON → USD₮, `POST https://api.ston.fi/v1/swap/simulate`, note it's POST not GET — a bare GET returns HTTP 405):

```
pool_address: EQD8TJ8xEWB1SpnRE4d89YO3jl0W0EiBnNS4IBaHaUmdfizE
offer_units: 100000000000 (100 TON, via pTON proxy jetton)
ask_units:   136958000     (136.958000 USD₮)
swap_rate:   1.369580000
fee_percent: 0.003004105
```

**Cross-checked directly against the pool's own `get_pool_data()` get-method** (not the REST layer at all):

```
runGetMethod(pool, "get_pool_data", [])
  reserve0 (USD₮, 6 decimals):  2,564,132.876309
  reserve1 (pTON, 9 decimals):  1,867,472.286580223
  raw pool price: 1.37305 USD₮/TON
  fee-adjusted estimate (raw price × (1 − 0.003004)): 1.368925
  actual quoted swap_rate:                             1.369580   <-- within 0.05%
```

Token-wallet addresses in the get-method response were decoded with `@ton/core`'s `Address` parser and matched exactly against the quote's own `offer_jetton_wallet`/`ask_jetton_wallet` fields, confirming reserve0/reserve1 ordering rather than assuming it.

**Also checked transaction recency** (the same test RESEARCH_21 used to catch DeDust's stale cache): the pool's three most recent transactions are 0.8, 3.7, and 3.7 minutes old at query time — actively trading, not a frozen index entry.

**Conclusion: STON.fi's REST quote layer is trustworthy for this pool** — it agrees with its own on-chain state to within rounding/price-impact precision, unlike DeDust's `/v2/pools`/`/v2/routing/plan` for the TON/USD₮ pair. This project should not assume the same is true for other STON.fi pools without repeating this check (see queue item 5a) — this is one data point, not a blanket clearance of STON.fi's infrastructure.

---

## 2. §1 (P0) recheck: has the `reserve-snapshot.yml` schedule trigger fired organically yet? — Not yet, still inconclusive

```
gh run list --workflow=reserve-snapshot.yml --json event,status,conclusion,createdAt
  -> only 1 run total: workflow_dispatch, 2026-09-13T02:18:26Z, success (RESEARCH_21's manual trigger)
  -> zero event=="schedule" runs
```

The workflow file has been on `master` (the confirmed GitHub default branch) since `2026-09-13T01:06:10Z`. At the time of this check (`2026-09-13T03:23Z`), that's ~2h17m elapsed against a 20-minute cron — 7 missed windows, not yet the "3+ hours / 9+ missed firings" threshold RESEARCH_21 set as the point to treat this as a real bug rather than scheduler-startup delay. Repo-level checks came back clean (not a fork — forks have scheduled workflows disabled by default; not archived; workflow `state: active`, not disabled). **No configuration defect found, but no organic firing yet either — a future contributor should check again once several more hours have passed** and escalate only if it's still empty then.

---

## 3. §2 (P0): configure the `TONCENTER_API_KEY` GitHub Actions secret — blocked by this session's own permissions, needs manual action

Attempted `gh secret set TONCENTER_API_KEY --repo quickerup/Research` (piping the value from `.env` directly to stdin, never printing or echoing it). This session's own tool-permission classifier denied it as a secret-store write, independent of repo-level access. **This needs to be done by the user directly** (or a session with that permission granted): `grep '^TONCENTER_API_KEY=' .env | cut -d= -f2- | gh secret set TONCENTER_API_KEY`. Low urgency at current call volume, as previously noted — the workflow already runs unauthenticated successfully, this just protects against future rate-limiting.

---

## 4. Items not attempted this session, carried forward unchanged

- §3 (P1): drift analysis using `data/reserve_snapshots.jsonl` — still blocked on volume, not on the staleness bug (fixed in RESEARCH_21). Only one post-fix snapshot exists so far; needs several more hours of accumulation once the schedule issue above is resolved.
- §5a/b/c (P1): extend to other DeDust/STON.fi pairs with the same reserve-staleness + tx-recency checks; formalize a client-side sequential execution spec; re-verify RESEARCH_19's `src/tools/*.ts` fixes are still holding.

---

## 5. Updated priority research queue for RESEARCH_23

1. (P0) Re-run the schedule-trigger check (`gh run list --workflow=reserve-snapshot.yml --json event -q '.[] | select(.event=="schedule")'`) once several hours have passed since 2026-09-13T01:06Z. If still empty, treat it as a genuine GitHub Actions bug and escalate (check org-level Actions policy, `gh api repos/quickerup/Research/actions/permissions`, etc.) rather than dispatching manually again.
2. (P0, needs elevated permission) Configure the `TONCENTER_API_KEY` repo secret — command above, blocked this session by tool policy, not by repo access.
3. (P1) Once the snapshot series has several hours of post-RESEARCH_21-fix data, run the drift analysis originally queued in RESEARCH_20's compression digest.
4. (P1) Apply this session's STON.fi verification method (get_pool_data cross-check + tx-recency check) to at least one more DeDust and one more STON.fi pool beyond TON/USD₮, to find out whether the DeDust staleness bug is pool-specific or systemic.
5. (P1, carried forward verbatim) formalize a client-side sequential execution prototype spec; re-verify RESEARCH_19's tool-suite fixes are still holding under current live conditions.
6. (P1 — funded wallet) The research wallet (`UQDVYfBHBVxW8YZC3AOYgbjAqVQiIj1p0mQRmMA9uB5_OXRn`, ~2.0 TON, authorization history in project memory `ton_arb_research_wallet`) remains available and authorized. No experiment this session met the bar the wallet's own policy sets (spend only when a live experiment provides evidence read-only/sandbox methods can't) — both open questions this session touched were fully resolved by get-methods and REST cross-checks. A future contributor should keep applying that same bar rather than spending to "use" the wallet: e.g., a genuinely novel candidate would be measuring actual slippage/settlement on a real tiny swap where the pre-trade quote and post-trade get-method state might diverge in ways only observable in a real broadcast transaction (sandbox emulation answers "what does the bytecode do," not "does the live mempool/routing layer introduce additional slippage a sandbox trace can't see").
