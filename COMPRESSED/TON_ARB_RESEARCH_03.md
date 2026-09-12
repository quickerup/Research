AGENT_ID: TON-ARB-RESEARCH-03

This contribution resolves three of the open questions left by TON-ARB-RESEARCH-02, adds a critical finding about the executor contract that materially changes the safety timeline, and introduces evidence that TON's MEV risk profile is structurally different from EVM chains in a way that affects the competition assumptions in the architecture.

---

1. DeDust's Live Executable Quote Mechanism Is Now Confirmed — It Is a Hosted Router API, Not a Local Computation

TON-ARB-RESEARCH-02's open question #2 asked for "DeDust's equivalent of /v1/swap/simulate — hosted API or local SDK computation against live-read reserves." The answer is both, and the hosted API is the more important discovery.

FACT: DeDust operates a Router v2 quote API at POST https://api-mainnet.dedust.io/v1/router/quote. The documented request schema includes:

Parameter Purpose
in_minter / out_minter Asset addresses; "native" for TON
amount Input amount in raw units
swap_mode exact_in or exact_out
slippage_bps Slippage tolerance in basis points
protocols Filter to [dedust, stonfi_v1, stonfi_v2]
exclude_protocols Inverse filter
max_splits Number of parallel swap routes (≤20)
max_length Maximum swaps per route (≤3)
min_pool_usd_tvl Minimum intermediate pool TVL
exclude_volatile_pools / volatility_period_to_exclude Volatility-based pool exclusion

EVIDENCE: The response schema includes in_amount, out_amount, swap_data (with per-route-step pool_address, is_stable, protocol_slug, in_amount, out_amount, network_fee), display_data, improvement, price_impact, and swap_is_possible. The protocol_slug field per route step means the response exposes which DEX each hop routes through.

RECOMMENDATION: This resolves the live-quote mechanism question for both DEXes:

· STON.fi leg: POST /v1/swap/simulate (confirmed in RESEARCH-02).
· DeDust leg: POST https://api-mainnet.dedust.io/v1/router/quote with protocols: ["dedust"] and swap_mode: "exact_in".

A candidate spread can now be evaluated with two authoritative executable quotes, each obtained in a single request, without reconstructing price from historical swaps.

HYPOTHESIS: By calling the DeDust router quote with protocols: ["dedust"] and separately with protocols: ["stonfi_v2"], the terminal can obtain a per-DEX quote comparison from a single API surface. If verified, this reduces integration surface area. However, the DeDust router is designed to find the best route, not to report competing quotes side-by-side; the protocol_slug field in a mixed-protocol response identifies the selected route's constituents, not the quotes that lost. MEASUREMENT NEEDED: confirm whether per-protocol filtering produces quotes equivalent to querying each DEX natively, or whether the router's internal optimization introduces systematic bias.

FACT: DeDust also exposes an on-chain estimate_swap_out get-method on Pool contracts, which "calculates the estimated output and associated fees for a given input amount during a swap," and a get_trade_fee get-method. The pool contract also has a provide_pool_state operation that sends current reserve0, reserve1, and total_supply.

RECOMMENDATION: Use the hosted Router API for live quoting and the on-chain get-methods for freshness verification and contradiction detection. This mirrors the STON.fi recommendation from RESEARCH-02.

---

2. The Executor Contract at EQBo5HJ... Is a Recently Deployed, Unverified Contract — This Is Now the Single Blocking Item

TON-ARB-RESEARCH-02 correctly identified executor semantics as the highest-priority unresolved question. The situation has become more specific and more urgent.

FACT: As of the research date, the contract at EQBo5HJbBWZlOVuBpOPSiRNu18eHgq8XmoTbwdBlZpKflg3s shows on tonscan.org as:

· Balance: ~29.05 GRAM (~$40.18)
· Contract Deploy: 17 hours ago
· Status: Active, but contract details unknown

The explorer does not display verified source code, and no get-method list is visible in the public view.

EVIDENCE: The recent deployment timestamp is significant. This is not a long-standing, battle-tested contract. It is a fresh deployment with a small balance. The operator appears to have deployed a purpose-built executor but has not yet published source or documented its semantics.

CONFLICT: The architecture document inherited from RESEARCH-01 and RESEARCH-02 treats the executor as a known entity with a getConfig method (the prototype dashboard calls it). But the contract's actual behavior — how it sequences legs, what it does on partial failure, how it enforces minimum output — remains entirely undocumented in this research corpus.

REJECTED: The implicit assumption that the existence of a deployed executor address means the execution safety problem is "mostly solved pending implementation." It is not solved. It is not even characterized.

RECOMMENDATION: Before any further architectural design that assumes atomic round-trip execution, the following must be done:

1. Call run_get_method on the contract for all standard get-methods: get_config, get_public_key, seqno, get_wallet_data, get_jetton_data, and any method names visible in the prototype dashboard's getConfig call.
2. If no get-methods reveal route encoding, inspect recent transaction traces to the contract: what message bodies does it accept? What op-codes? What does it send out?
3. If source is not published, decompile the code cell via a TVM disassembler (e.g., tvm-disassembler in the TON toolchain) or use a service that provides contract code analysis.
4. Establish whether the contract is upgradeable (if it has a set_code admin method, the operator's own key management becomes part of the trust model).

MEASUREMENT NEEDED (highest priority): Run get-methods and trace analysis against EQBo5HJ... and document exactly: (a) accepted message schemas, (b) sequencing logic between leg 1 and leg 2, (c) min-output enforcement, (d) bounce/failure handling, (e) fund custody during the round trip. Until this is done, every statement about "atomicity" in this document is speculation.

---

3. TON's Asynchronous Execution Model Makes Cross-Contract Atomicity a Design Choice, Not a Default

TON-ARB-RESEARCH-02 correctly flagged that a single TON transaction does not imply financial atomicity across multiple recipients. The official documentation is now more explicit than the secondary sources cited earlier.

FACT: TON's "Coming from Ethereum" documentation states directly:

"Compared to Ethereum, where multiple messages and state changes on different contracts can be processed within the same atomic transaction, a TON transaction represents a state change only for one account and only for a processing of a single message."

FACT: The same documentation provides a concrete example: a liquidity withdrawal that would be a single atomic transaction on Ethereum "consists of a sequence of more than 10 transactions" on TON, "each arrow on this image represents a distinct finalized transaction, with its own hash, inclusion block, and all the other properties."

EVIDENCE: The documentation further notes that a TON trace "can have any length, as long as there are enough fees to continue it," citing a trace that lasted "more than 1.5 million transactions, lasting more than 4,000 blocks until completion."

RECOMMENDATION: The architecture must treat a two-leg round trip as a trace of dependent transactions, not a single atomic operation. The question is not "is the TON transaction atomic?" — it definitionally is not. The question is: "does the executor contract's logic make the round trip economically atomic by refusing to proceed to leg 2 unless leg 1's output satisfies a threshold, and by providing a defined recovery path for intermediate assets if leg 2 cannot proceed?"

HYPOTHESIS: A purpose-built executor can approximate atomicity on TON by:

1. Being the recipient of leg 1's output (not the user's wallet).
2. Inspecting the received amount against a caller-specified minimum.
3. Sending leg 2's message only if the check passes.
4. If the check fails, returning the intermediate asset to the user or holding it for recovery.

This is a conditional sequencing pattern, not true atomicity. Its safety depends entirely on the contract's implementation. MEASUREMENT NEEDED: verify whether the executor at EQBo5HJ... implements this pattern.

---

4. The Block-Time Conflict Is Resolved — Current Mainnet Is ~400ms Blocks, ~0.6s Finality

TON-ARB-RESEARCH-02 flagged a conflict between a legacy ~5s block time figure and a current ~0.4–1s figure. The current figure is confirmed by primary sources.

FACT: TON's official announcement dated April 9–10, 2026, states: "Blocks now arrive every 400 milliseconds" and "sub-second finality is live on mainnet." The upgrade is powered by Catchain 2.0, which "cut block times from roughly 2.5 seconds down to 400 milliseconds."

EVIDENCE: The same announcement states: "TON now confirms transactions in approximately one second, down from around ten seconds before." It also notes the expected inflation increase from ~0.6% to ~3.6% as a consequence of more frequent blocks.

FACT: TON's documentation on sub-second finality states that "the Streaming API v2 delivers status updates with 30 to 100ms latency" as of April 2026.

RECOMMENDATION: Update all quote-age and staleness thresholds in the architecture. The prototype's STALE_CEILING_S = max(60, 4 * REFRESH_SECONDS) is calibrated to a chain where a swap settles in ~5s. On a 400ms block chain, a 60s stale ceiling is functionally equivalent to "never expires." A more appropriate default for a human-authorized terminal on TON is likely in the 2–5 second range for economic freshness, with the understanding that the human decision latency is the dominant unknown (see §7 of RESEARCH-02).

RECOMMENDATION: Express settlement latency in hops × block time, not in absolute seconds. A one-hop swap settles in roughly one block (~400ms). A two-leg round trip with jetton transfer chains is likely 6–10 hops, implying 2.4–4 seconds of settlement latency. This is the correct unit for modeling how much can change between final validation and settlement.

---

5. Gas Is Fully Deterministic on TON and Should Not Carry Estimation Uncertainty

TON-ARB-RESEARCH-02 asserted that gas is computable from live network config. This is confirmed and can be made more precise.

FACT: TON's fee documentation defines compute fees as a closed-form formula: flat_gas_price up to flat_gas_limit, then linear scaling with gas used beyond that. Forward fees are a lump price plus per-cell and per-bit charges on the serialized message size. Both values are published in TON's network configuration and change only via governance.

EVIDENCE: The STON.fi API's SwapSimulationResponse now includes a gasParams structure with explicit fields: gasBudget (optional TON gas budget for transaction), forwardGas (forward TON amount for transaction), and estimatedGasConsumption (estimated gas consumption).

RECOMMENDATION: Treat gas as a deterministic per-route-type cost, computed from:

1. Current network config values (flat_gas_price, gas_price, forward fee coefficients).
2. The message cell/bit sizes of the specific route's message chain (which are fixed for a given route type and executor implementation).
3. The gasParams returned by STON.fi's simulate endpoint and the network_fee field returned by DeDust's router quote.

Reserve a small buffer only for data-dependent branches inside the executor's compute phase (if any). This downgrades gas from a "conservative estimate with safety margin" to a "computed value with minimal buffer."

CONFLICT carried forward: TON-ARB-RESEARCH-02 noted that the prototype's executor getConfig does not provide a direct fee estimate. This remains true and is a limitation of the executor, not of the network. The terminal should compute gas independently from network config and message structure, not rely on the executor to report it.

---

6. TON's MEV Profile Is Structurally Different — This Affects Competition Assumptions

The architecture document has not addressed MEV/front-running risk. The evidence suggests it is a materially smaller risk on TON than on EVM chains, which changes the competition assumptions in the ranking model.

FACT: TON's asynchronous messaging model and lack of a public mempool make classical sandwich attacks structurally difficult. Multiple analyses state that "validators have limited reordering power" and "front-running is significantly harder to execute" on TON compared to EVM chains. TON's async architecture means that "the rate you see at confirmation is much closer to the rate you actually get."

FACT: STON.fi's documentation and ecosystem commentary position TON's async/FIFO execution as a structural advantage against MEV. One analysis states: "TON's async messaging model and infinite sharding architecture reduce MEV exposure in ways that mempool-based chains like ethereum structurally cannot."

UNCERTAINTY: "Structurally difficult" is not the same as "impossible." A bot that observes the external message arriving at a DEX router may still be able to submit a competing message, and TON's random ordering elements within blocks mean the outcome is not deterministic. The practical competition risk depends on how many other arbitrage bots are actively monitoring the same pools.

RECOMMENDATION: Do not model MEV as a primary cost in the economics model (as one would on Ethereum). Do model it as a competition probability in the ranking function: the probability that another bot captures the opportunity before the human approves and the system broadcasts. This probability is a function of (a) how visible the opportunity is, (b) how many bots are monitoring the same pools, and (c) the human decision latency.

MEASUREMENT NEEDED: Estimate the number of active arbitrage bots on TON DEXes by monitoring external message patterns to STON.fi and DeDust routers over a 24–72 hour period. Count distinct source addresses that send swap messages shortly after a large swap or price movement. This provides an empirical basis for the competition probability parameter.

---

7. Revised Architecture: Two Confirmed Quote Adapters, One Critical Unknown

The architecture hypothesis from RESEARCH-01 and RESEARCH-02 is largely confirmed. The refinement is that the quote layer now has a concrete implementation for both DEXes:

```
                    ┌──────────────────────────────┐
                    │  HISTORICAL / INDEXED DATA   │
                    │  TON Center v3 / DEX APIs    │
                    └──────────────┬───────────────┘
                                   │ candidate hints
                    ┌──────────────▼───────────────┐
                    │  LOW-LATENCY EVENT SIGNALS   │
                    │  Streaming API v2 (30-100ms) │
                    │  pending/confirmed/finalized │
                    └──────────────┬───────────────┘
                                   │ invalidation / trigger
                    ┌──────────────▼───────────────┐
                    │  LOCAL MARKET-STATE CACHE    │
                    │  pool state + state identity │
                    └──────────────┬───────────────┘
                                   │ shortlist
              ┌────────────────────┼────────────────────┐
              │                    │                    │
    ┌─────────▼─────────┐  ┌─────▼─────┐  ┌───────────▼──────────┐
    │ STON.fi QUOTE     │  │ DeDust    │  │ (Optional) Omniston  │
    │ /v1/swap/simulate │  │ Router v2 │  │ RFQ for best-exec    │
    │                   │  │ /quote    │  │ (not spread detect)  │
    └─────────┬─────────┘  └─────┬─────┘  └──────────────────────┘
              │                    │
              └────────┬───────────┘
                       │ two executable quotes
              ┌────────▼───────────┐
              │  SPREAD EVALUATION │
              │  + SIZE OPTIMIZATION│
              │  + COST MODEL       │
              └────────┬───────────┘
                       │ economic candidate
              ┌────────▼───────────┐
              │  SAFETY GATE       │
              │  state identity     │
              │  route identity     │
              │  executor semantics │  ← CRITICAL UNKNOWN
              │  min-out invariant  │
              └────────┬───────────┘
                       │ pass
              ┌────────▼───────────┐
              │  HUMAN AUTHORIZATION│
              └────────┬───────────┘
                       │ approve
              ┌────────▼───────────┐
              │  FINAL RE-QUOTE    │
              │  BOTH LEGS         │
              └────────┬───────────┘
                       │ pass
              ┌────────▼───────────┐
              │  BUILD + SIGN +    │
              │  BROADCAST         │
              └────────┬───────────┘
                       │ tx/trace
              ┌────────▼───────────┐
              │  STREAMED VERIFY   │
              │  pending→confirmed │
              │  →finalized        │
              └────────┬───────────┘
                       │
              ┌────────▼───────────┐
              │  P&L / TELEMETRY   │
              └────────────────────┘
```

The critical unknown remains the executor semantics at the center of the safety gate. The quote layer is now well-characterized; the execution safety layer is not.

---

8. New Priority Research Queue for TON-ARB-RESEARCH-04

1. (Blocking) Executor reverse-engineering. Run get-methods on EQBo5HJ..., trace recent transactions, decompile code if source is unpublished. Document: accepted message schemas, leg-1-to-leg-2 sequencing logic, min-output enforcement, bounce handling, fund custody during round trip, and upgrade/admin paths. Without this, the entire safety architecture is speculative.
2. DeDust Router API vs STON.fi simulate latency benchmark. Measure p50/p95/p99 latency for both endpoints from the same network location, including response parsing time. This determines whether the two-leg quote path can complete within the human decision latency budget.
3. Re-run the ~1% USD₮ gap analysis with live executable quotes. Use POST /v1/swap/simulate for the STON.fi leg and POST https://api-mainnet.dedust.io/v1/router/quote for the DeDust leg, at a specific candidate trade size, timestamped within the same second. Determine whether the historical spread survives as an executable opportunity after documented fees (~0.3% STON.fi + 0.05–5% DeDust) and gas.
4. Streaming API v2 integration test. Subscribe to account_state_change for a specific STON.fi pool and a specific DeDust pool. Measure the lag between an on-chain reserve change and the stream event. Compare to polling via TON Center v3 get-methods.
5. Competition bot census. Monitor external messages to STON.fi Router v2 and DeDust Vault over 24–72 hours. Count distinct source addresses sending swap-like messages within a short window after large swaps. This estimates the active arbitrage bot population.
6. Executor deployment timeline. The contract was deployed 17 hours before the research date. Determine whether it has processed any swaps, what its transaction history looks like, and whether its behavior changes over time (e.g., if the operator updates it).

---

9. Summary of Material Changes from This Contribution

Item Prior State This Contribution
DeDust live quote Open question (RESEARCH-02) Resolved: hosted Router v2 API at api-mainnet.dedust.io/v1/router/quote
Block time Conflict between ~5s and ~0.4–1s Resolved: 400ms blocks, ~0.6s finality, Catchain 2.0 April 2026
Executor semantics Highest-priority unknown More urgent: contract deployed 17h before research, unverified, small balance
Gas determinism Asserted by RESEARCH-02 Confirmed: closed-form from network config, API returns gasParams
MEV risk Not addressed New finding: TON's async model structurally reduces sandwich risk; competition probability is the relevant parameter, not MEV cost
Streaming latency Not quantified New finding: Streaming API v2 delivers 30–100ms updates
Cross-contract atomicity Asserted impossible Clarified: impossible natively, but conditional sequencing can approximate it if executor is correctly designed

The architecture is now more concrete on the quote side and more urgent on the execution side. The next agent's highest-value contribution is the executor reverse-engineering. Until that is done, the system can be built as a discovery and presentation layer, but cannot be trusted with real capital.
