AGENT_ID: TON-ARB-RESEARCH-01

The point of this documentation is to serve as a continuously evolving technical research and architecture brief for building a semi-automatic TON DEX arbitrage terminal. This is not a static prompt that is handed independently to separate models and answered from scratch. It is a living research document that is passed from one model or research agent to the next, with each agent expected to read everything accumulated before it, critically evaluate it, and then add its own verified findings, corrections, challenges, measurements, architectural recommendations, and unresolved questions.

The ultimate purpose of this process is to determine, as rigorously as possible, how to build the fastest, safest, and most economically accurate practical TON DEX arbitrage system in which the machine discovers and validates opportunities but a human remains the final authorization authority for execution.

Every contribution becomes part of the accumulated knowledge available to the next agent. Therefore, nothing in this document should be treated as permanently correct merely because it was written by an earlier agent. Previous conclusions are working conclusions. They may be confirmed, refined, contradicted, or replaced as stronger evidence becomes available.

The system being designed is deliberately not intended to be a fully autonomous arbitrage bot. The intended operator experience is an interactive terminal: the operator starts the system, the system continuously searches the market, identifies the best currently executable opportunity, calculates the complete economics, presents the opportunity clearly, and asks the human whether to execute. If the human approves, the system must perform a fresh final validation immediately before execution. If the opportunity has disappeared, become stale, become unprofitable, or violates any safety condition, execution must be rejected automatically. If validation passes, the system executes, verifies the result, records the outcome, and resumes scanning.

The research task is therefore broader than simply finding price discrepancies. The central problem is to determine what information is authoritative, how quickly it can be obtained, how an actual executable round trip should be priced, how trade size should be optimized, how execution risk should be controlled, and how the entire discovery-to-execution path can be made sufficiently fast and reliable for real arbitrage.

This document should be treated as the foundational entry in that research process.

Each subsequent agent must preserve useful prior knowledge while improving the document. The next agent should not simply summarize what is already here. It should identify what is still unknown, investigate the highest-value uncertainties, test assumptions, challenge weak reasoning, and append its contribution in a way that makes the document more useful to the agent after it.

At the beginning of every response, introduce yourself using a unique classifier:

AGENT_ID: [unique identifier]

Choose a short identifier that clearly distinguishes your contribution from previous agents, such as:

"TON-ARB-RESEARCH-02"

"TON-ARB-MARKETDATA-03"

"TON-ARB-EXECUTION-04"

"TON-ARB-TONCORE-05"

Keep the same identifier throughout your response. Do not impersonate or claim to be another agent. The classifier exists solely to establish provenance for technical claims, recommendations, assumptions, disagreements, measurements, and conclusions.

When useful, classify substantive statements as:

FACT:
Something directly supported by authoritative documentation, source code, transaction evidence, measured behavior, or another strong primary source.

EVIDENCE:
The documentation, source code, transaction, benchmark, experiment, or observation supporting a claim.

ASSUMPTION:
A proposition currently being used for architectural reasoning but not yet sufficiently verified.

UNCERTAINTY:
Something unresolved, ambiguous, undocumented, version-dependent, or insufficiently measured.

CONFLICT:
A contradiction between accumulated research, documentation, implementation behavior, observed blockchain behavior, or previous agents.

RECOMMENDATION:
A proposed architectural, operational, or implementation choice.

HYPOTHESIS:
A technically plausible proposition that should be tested rather than accepted as fact.

REJECTED:
A previous assumption or design choice that should no longer be treated as valid, together with the evidence or reasoning for rejecting it.

MEASUREMENT NEEDED:
A question that cannot responsibly be settled from documentation alone and requires benchmarking, experimentation, transaction tracing, or live observation.

Do not mechanically prefix every sentence. Use these labels where they materially improve traceability and prevent assumptions from being confused with established facts.

The objective is to determine the best practical architecture for a human-authorized, semi-automatic TON DEX arbitrage terminal.

The desired workflow is:

1. The operator launches one command.
2. The terminal is already configured and funded.
3. The system continuously or repeatedly scans the relevant TON DEX market.
4. It identifies the best currently executable arbitrage candidate satisfying configured parameters.
5. It presents the opportunity in human-readable terms, including route, asset, size, expected return, fees, gas, slippage/price impact, safety margin, expected net profit, ROI, quote age, and validation state.
6. It explicitly warns the operator when the best available candidate is not actually profitable after realistic costs.
7. The operator authorizes or declines the proposed trade.
8. Authorization does not mean the system is permitted to blindly execute the previously displayed quote.
9. After authorization, the system performs a fresh final validation/re-quote immediately before execution.
10. If the opportunity has disappeared, materially deteriorated, become stale, failed a safety invariant, or become unprofitable, execution must be aborted and the reason reported.
11. If the final validation passes, the system executes through the safest appropriate execution path.
12. It verifies the resulting transaction and state.
13. It records the outcome and returns to scanning.

The human is the final authorizer.

The machine is responsible for discovery, calculation, validation, risk checks, execution mechanics, and post-trade verification.

A representative user experience is:

./ton_arb.sh

Scanning TON DEXes...

BEST OPPORTUNITY

Route: STON.fi → DeDust
Asset: TON → XYZ → TON

Trade size:         100 TON
Expected return:    100.72 TON
Gross profit:       +0.72 TON

Estimated costs:
  DEX fees:         -0.18 TON
  Gas:              -0.05 TON
  Slippage:         -0.11 TON
  Safety margin:    -0.10 TON

EXPECTED NET:       +0.28 TON
ROI:                +0.28%

Quote age:          0.6 sec
Status:             PROFITABLE

Execute this trade? [y/N]

When the best available candidate is not economically attractive, the terminal should be able to communicate that directly:

BEST AVAILABLE CANDIDATE

Expected net: -0.31 TON

WARNING:
Currently unprofitable after estimated execution costs.

Execute anyway? [y/N]:

Normal execution should default to declining.

For a candidate explicitly calculated to be economically negative, requiring an explicit confirmation such as "EXECUTE" should be considered preferable to a casual "y".

Normal mode should focus on the single best candidate. An optional scan/debug mode may expose multiple ranked candidates.

The central design principle is:

The system must distinguish between information about what happened and information about what can actually be executed now.

Historical executed swaps are useful for:

- discovery;
- calibration;
- market-universe construction;
- historical spread-frequency analysis;
- liquidity/activity estimation;
- volatility analysis;
- hot/warm/cold classification;
- strategy backtesting;
- parameter tuning.

Historical swap prices must not automatically be treated as current executable prices.

The core question is therefore not:

«“What trade recently showed a large price difference?”»

The core question is:

«“What trade can I execute right now, at this size, through this route, with sufficiently high confidence that the complete round trip remains profitable after all relevant costs and safety constraints?”»

The research must determine the fastest and most authoritative available information source for each layer of the system, including:

- live pool state;
- reserves;
- pool-specific state variables;
- direct DEX quote mechanisms;
- router quote mechanisms;
- SDK/library quote functions;
- read-only on-chain calls;
- event streams;
- indexed APIs;
- websocket or streaming infrastructure;
- recent transaction/action feeds;
- routing engines;
- local state caches;
- historical swap datasets;
- other relevant market-state sources.

For every candidate source, explicitly determine whether it answers:

“What happened?”

or:

“What can I execute now?”

Those are different questions.

The architecture should favor the lowest-latency source that provides sufficiently authoritative executable information, while using cheaper historical or observational data to narrow the search space.

The currently known prototype is a read-only TON DEX price-spread dashboard.

The existing script is:

"ton_arb_dashboard.sh"

Its purpose is to provide a live TON DEX cross-pool price-spread dashboard using TONCenter v3.

It is explicitly read-only.

It does not construct, sign, or broadcast transactions.

Its current behavior includes:

- fetching public swap history;
- making two read-only on-chain view calls against an executor contract;
- reading executor balance;
- reading executor configuration;
- tailing a local paper-engine log/dataset;
- normalizing and aggregating data;
- ranking observed spreads;
- rendering a terminal dashboard.

Current configuration includes:

"FETCH_LIMIT" default "1000"

"REFRESH_SECONDS" default "20"

"TOP_N" default "10"

"MAX_SPREAD_PCT" default "5"

"MAX_DEV_PCT" default "2.5"

"MAX_PAGES" default "5"

"EXECUTOR_ADDRESS" default:

"EQBo5HJbBWZlOVuBpOPSiRNu18eHgq8XmoTbwdBlZpKflg3s"

A blank executor address disables the executor panel.

"STALE_CEILING_S" defaults to approximately:

"max(60, 4 * REFRESH_SECONDS)"

"DATA_STALE_MULT" default "3"

"PAPER_HEARTBEAT_STALE_S" default "90"

"PAPER_DATASET_STALE_S" default "120"

"HISTORY_WINDOW_S" default "600"

"HISTORY_SAMPLE_CAP" default "40"

"HISTORY_PRUNE_IDLE_S" default "900"

"OPP_ENGINE_LOG" defaults to:

"$HOME/.tonarb/opp_engine_live.log"

"OPP_ENGINE_OUT" defaults to:

"opportunities.jsonl"

"DASHBOARD_DEBUG=1" is equivalent to "--debug".

Important implementation details already established for the prototype:

The dashboard was verified against "toncenter.com/api/v3" on September 12, 2026.

The prototype deliberately does not use "start_utime" / "end_utime" because that query pattern continued to produce HTTP 500 "context deadline exceeded".

Instead, it pulls a configured number of the most recent "jetton_swap" actions using limit/offset/sort-desc semantics and reports the actual resulting time span.

Actions are deduplicated by TONCenter "action_id" before any other processing.

Actions with "success:false" are excluded.

This matters because reverted/bounced swaps can otherwise appear in the feed with misleading one-leg asset information and misleading amounts.

Only TON-to-jetton and jetton-to-TON swaps are currently priced.

Jetton-to-jetton swaps are skipped.

The count of skipped/ineligible data is surfaced as feed-health information.

The prototype's notion of pool “price” is the most recent valid executed swap's TON amount divided by jetton amount using raw units.

This is a realized trade price.

It incorporates the actual outcome of that trade, including fee and slippage.

It is not the current reserve-derived spot price or current executable bid/ask/mid.

The prototype's executor "getConfig" does not provide a direct fee estimate.

Therefore, a "TRIGGER+" condition in the current dashboard means only that an observed historical spread exceeded a configured threshold.

It does not establish that a currently executable trade is profitable after execution costs.

Pages are fetched in parallel with per-request timeout/retry behavior.

Failed pages are dropped.

The dashboard reports "pages_ok/pages_total".

Heavy normalization, aggregation, and ranking occur in:

"ton_arb_dashboard.d/pipeline.jq"

Rendering occurs in:

"ton_arb_dashboard.d/render.jq"

Tests are under:

"ton_arb_dashboard.d/test/"

Per-asset spread history is maintained in memory/temp storage.

Restarting the dashboard resets that trend history.

The current prototype should therefore be regarded as an observation, discovery, and market-universe layer rather than an authoritative execution-trigger mechanism.

The future system should evolve beyond the prototype rather than simply adding transaction broadcasting to the historical-spread pipeline.

The working architectural hypothesis is:

MARKET DATA / LIVE DEX STATE
        ↓
UNIVERSE FILTERING
        ↓
CANDIDATE DISCOVERY
        ↓
LIVE EXECUTABLE QUOTES
        ↓
SIZE OPTIMIZATION
        ↓
FULL COST MODEL
        ↓
RISK / SAFETY VALIDATION
        ↓
OPPORTUNITY RANKING
        ↓
HUMAN APPROVAL
        ↓
FRESH FINAL RE-QUOTE
        ↓
FINAL SAFETY CHECKS
        ↓
EXECUTION
        ↓
ON-CHAIN VERIFICATION
        ↓
P&L / TELEMETRY / HISTORY
        ↓
BACK TO SCANNING

This architecture is a hypothesis, not an immutable requirement.

Each subsequent agent should determine whether this decomposition is correct, incomplete, unnecessarily complicated, or missing an important layer.

A major research objective is minimizing the time between:

1. a relevant market condition changing;
2. the system recognizing that change;
3. obtaining an executable route;
4. determining the best trade size;
5. determining true expected net profit;
6. presenting the result to the human;
7. receiving authorization;
8. performing final validation;
9. executing.

Latency should be treated as a first-class architectural concern.

Research should identify where latency actually occurs, including:

- event/indexer propagation;
- RPC latency;
- quote computation;
- network round trips;
- sequential versus parallel requests;
- serialization/deserialization;
- local computation;
- route enumeration;
- cache misses;
- transaction construction;
- signing;
- broadcast;
- inclusion/finality;
- post-trade verification.

Distinguish:

Detection latency:
time from relevant on-chain state change to local awareness.

Qualification latency:
time required to establish that a candidate satisfies the strategy.

Quote latency:
time required to obtain a current executable quote.

Decision latency:
time between opportunity presentation and human approval.

Execution latency:
time from final approval/revalidation to transaction broadcast.

Settlement/verification latency:
time until the outcome can be reliably confirmed.

The research should identify which of these actually dominate the opportunity-loss budget.

Where appropriate, investigate:

- event-driven monitoring;
- polling;
- push subscriptions;
- incremental state updates;
- local state mirrors;
- parallel quote requests;
- asynchronous execution;
- precomputation;
- caching;
- hot/warm/cold market tiers;
- adaptive refresh rates;
- selective route evaluation;
- quote memoization where safe;
- invalidation on relevant pool-state changes.

Do not assume event-driven infrastructure is automatically superior.

Compare it against the actual guarantees, freshness, availability, ordering, failure modes, and operational complexity of the relevant TON and DEX systems.

A central market-search problem is deciding how much of the universe to inspect continuously.

A possible hot/warm/cold model is:

HOT:
High-liquidity, high-activity, historically productive markets that deserve aggressive monitoring and frequent executable quotes.

WARM:
Potentially productive markets monitored less aggressively and promoted to hot based on activity, liquidity, volatility, or observed opportunities.

COLD:
Markets that do not currently justify expensive continuous evaluation but are periodically rescanned or promoted based on new information.

This tiering is only a hypothesis until supported by measurements and observed opportunity distribution.

Research should determine whether the best candidate universe is better constructed from:

- liquidity thresholds;
- historical volume;
- swap frequency;
- volatility;
- pool age;
- route connectivity;
- current reserve changes;
- recent state events;
- prior arbitrage frequency;
- observed spread persistence;
- token quality/risk;
- DEX-specific characteristics;
- route graph topology;
- available capital;
- gas economics;
- or some combination.

The objective is not to find the largest nominal spread.

The ranking objective should ultimately be closer to:

maximize expected executable net profit subject to explicit risk and safety constraints.

For every candidate, the economic model should attempt to calculate:

input amount
→ exact executable buy quote
→ acquired asset amount
→ exact executable sell quote
→ gross return
→ DEX fees
→ gas
→ routing costs
→ expected price impact
→ slippage allowance
→ safety margin
→ expected net return
→ ROI

The model must account for the actual route being proposed.

A generic pool price is not a substitute for the route's executable result.

The system should evaluate multiple trade sizes rather than assuming a fixed notional such as 100 TON.

At minimum, research should investigate how to determine:

- minimum viable size;
- maximum safe size;
- economically optimal size;
- liquidity-constrained size;
- price-impact-constrained size;
- route-dependent size;
- capital-constrained size;
- gas-efficient size.

The system should recognize that:

- larger trades may produce more absolute profit but worse ROI;
- smaller trades may have better ROI but insufficient absolute profit;
- a trade can be profitable at 10 TON and unprofitable at 100 TON;
- identical apparent spreads can produce very different net outcomes;
- the optimal size may occur between the minimum and maximum feasible amounts.

The optimization method should be researched rather than assumed.

Potential approaches include:

- discrete size grids;
- binary search around a profitability boundary;
- numerical optimization;
- route-specific analytical models;
- incremental quote probing;
- reserve-curve simulation;
- DEX-specific quote APIs.

Determine the fastest method that remains sufficiently accurate for live decision-making.

The cost model must explicitly represent uncertainty.

Distinguish among:

- deterministic costs;
- estimated costs;
- conservative bounds;
- uncertain externalities;
- safety reserves;
- costs already embedded in quotes;
- costs payable separately.

Particular attention is required for:

- DEX swap fees;
- protocol fees;
- router fees;
- TON gas;
- forwarding fees;
- message fees;
- storage/state costs where applicable;
- token-specific transfer behavior;
- transaction failure costs;
- slippage;
- price impact;
- route-level fee accumulation;
- execution overhead;
- failed transaction consequences;
- MEV/front-running or ordering risks where applicable.

Do not double-count costs already incorporated into an executable quote.

Do not omit costs merely because they are difficult to estimate.

When exact values are unavailable, document the estimation method and uncertainty.

Conservative safety margins are preferable to falsely precise profitability.

The terminal should distinguish at least:

PROFITABLE

MARGINAL

UNPROFITABLE

STALE

VALIDATION FAILED

EXECUTION BLOCKED

or equivalent unambiguous states.

A large headline spread must never obscure a negative expected-net result.

The execution architecture is a critical research area.

The currently known executor address is:

"EQBo5HJbBWZlOVuBpOPSiRNu18eHgq8XmoTbwdBlZpKflg3s"

Future research must establish, using primary-source evidence where possible:

- what the executor actually does;
- how it represents routes;
- how it handles intermediate tokens;
- whether the complete round trip is atomic;
- what happens on partial failure;
- what minimum-output protections exist;
- how slippage constraints are expressed;
- whether deadline/expiry protections exist;
- whether the executor can validate final output;
- what authentication/authorization mechanism exists;
- how funds are held;
- how balances are handled;
- whether arbitrary routes can be supplied;
- whether contracts can be upgraded;
- what upgrade/admin risks exist;
- whether ownership/key-management assumptions are acceptable;
- whether the executor can prevent accidental loss;
- what happens to excess funds;
- what happens when one leg succeeds and another fails;
- whether transaction-level atomicity actually covers the intended arbitrage sequence.

Do not assume that “one TON transaction” automatically means the entire intended financial operation is atomically safe.

Determine exactly what atomicity exists at the message, contract, and multi-step execution levels.

The ideal execution path should enforce as many critical safety invariants as practical at the contract level rather than relying solely on the client.

Potential invariants include:

- maximum input amount;
- minimum final output;
- minimum net economic outcome where enforceable;
- deadline/expiry;
- expected route identity;
- expected asset identity;
- expected pool identity where necessary;
- authorized executor/initiator;
- protection against unauthorized route mutation;
- protection against unexpected token addresses;
- protection against excessive slippage;
- protection against malformed route data;
- protection against leftover intermediate assets;
- replay protection where relevant;
- controlled handling of bounced or failed messages;
- deterministic recovery of unused funds;
- emergency-stop capability where appropriate.

The exact set must be derived from the actual executor and DEX semantics.

The human confirmation path must account for opportunity decay.

The system should distinguish:

Quote generated:     T0
Human approval:      T1
Final validation:    T2
Broadcast:           T3

The system should define explicit freshness and validity conditions rather than relying solely on a vague quote-age threshold.

A quote should be rejected when:

- its age exceeds configured tolerance;
- relevant pool state has changed;
- the route is no longer available;
- expected output falls below minimum;
- expected profit falls below threshold;
- gas/cost estimates materially change;
- wallet or executor conditions change;
- any safety invariant fails.

A numerically recent quote based on stale underlying pool state is still stale.

Final pre-execution validation should occur as close as technically practical to transaction construction and broadcast.

Research should investigate whether transaction construction can be partially prepared before human approval without introducing unacceptable stale-state, security, or correctness risks.

The operator should receive enough information to make a rational decision quickly.

At minimum, the candidate presentation should communicate:

- route;
- input asset;
- intermediate asset;
- output asset;
- proposed input amount;
- expected output;
- gross profit;
- DEX fees;
- gas;
- slippage/price impact;
- safety margin;
- expected net profit;
- ROI;
- quote timestamp/age;
- quote source;
- final-validation status;
- relevant confidence/risk indicator;
- whether all machine-side execution conditions currently pass.

A candidate should be actionable rather than merely interesting.

The scanner should avoid presenting opportunities that cannot realistically survive the transition from observation to execution.

The likely processing pipeline is:

cheap market-state signal
→ cheap candidate filter
→ live quote
→ exact/near-exact route evaluation
→ size optimization
→ full cost calculation
→ safety validation
→ ranking

Research should quantify where each filter can safely occur without eliminating profitable opportunities.

The system must be designed for partial failure.

Potential failures include:

- RPC timeout;
- API timeout;
- stale indexer;
- missing page;
- event loss;
- websocket disconnect;
- malformed data;
- reverted swap;
- bounced message;
- stale quote;
- route disappearance;
- insufficient liquidity;
- gas-estimation error;
- wallet-balance change;
- executor-state mismatch;
- token metadata anomaly;
- DEX contract upgrade;
- transaction rejection;
- transaction inclusion delay;
- ambiguous transaction outcome;
- unexpected post-trade state.

The scanner may degrade gracefully when data sources fail.

The execution path should fail closed.

The system should not execute merely because a required check could not be performed.

“Unknown” should not be treated as equivalent to “safe.”

The design should explicitly define behavior when:

- one data provider is unavailable;
- live state disagrees with an indexer;
- quote sources disagree;
- a cache is stale;
- only partial route information is available;
- gas estimation is uncertain;
- execution confirmation is ambiguous.

Observability should be designed in from the beginning.

At minimum, record:

- candidate discovery timestamp;
- source timestamps;
- quote request timestamp;
- quote response timestamp;
- state identifiers;
- selected route;
- selected trade size;
- estimated costs;
- expected profit;
- human approval timestamp;
- final validation result;
- transaction hash;
- execution result;
- realized output;
- realized P&L;
- expected-versus-realized discrepancy;
- rejection reason;
- failure reason;
- elapsed time through each stage.

This telemetry should allow empirical answers to:

- How many apparent opportunities were actually executable?
- How many disappeared before approval?
- How many failed final validation?
- How many were profitable before gas but unprofitable after gas?
- How accurate were quote estimates?
- How much expected profit was lost to latency?
- Which DEX/pool combinations produced the most realized opportunities?
- Which route types failed most frequently?
- Which trade sizes produced the best realized returns?
- How often did historical spreads correspond to executable arbitrage?
- What fraction of scanner alerts were false positives?

Historical data should remain part of the system.

It can support:

- market discovery;
- historical spread distributions;
- opportunity frequency;
- token/pool activity classification;
- hot/warm/cold classification;
- parameter calibration;
- volatility estimation;
- liquidity/activity priors;
- false-positive analysis;
- expected opportunity lifetime;
- scanner scheduling;
- backtesting;
- post-trade analytics;
- model calibration;
- failure analysis.

Historical executed prices must remain clearly labeled as historical realized observations.

Historical data should never be presented in a manner that implies it is the current executable price.

The system should strongly consider separating:

DISCOVERY DATA

from:

EXECUTION DATA.

A discovery signal may say:

«Pool A and Pool B recently exhibited a 1.4% realized price difference.»

The execution engine must independently establish:

«Given the current state, route, trade size, costs, and safety constraints, can I actually execute this round trip for positive expected net return?»

Only the second condition should be execution-eligible.

Opportunity ranking should account for both profitability and execution risk.

Potential variables include:

- expected net TON profit;
- ROI;
- probability of successful execution;
- quote confidence;
- time-to-execution;
- liquidity depth;
- expected price impact;
- route complexity;
- token risk;
- historical opportunity persistence;
- estimated competition;
- capital efficiency;
- gas efficiency.

The exact ranking function is not fixed.

Agents should investigate whether simple expected-net-profit ranking is sufficient or whether risk-adjusted ranking produces materially better realized performance.

The primary optimization target remains actual executable value, not nominal spread.

The architecture should be evidence-driven.

When researching TON, TON DEXes, APIs, SDKs, routers, indexers, wallets, executors, smart contracts, and transaction semantics, prefer primary sources:

- official protocol documentation;
- official DEX documentation;
- official SDK source code;
- official repositories;
- deployed/verified contract source;
- contract interfaces;
- direct blockchain transaction traces;
- direct RPC/API behavior;
- reproducible benchmarks.

Secondary sources may provide useful context, but important architectural conclusions should not rest solely on blogs, forum posts, social-media claims, or unverified assertions.

When a claim is version-sensitive or likely to have changed, verify it against current sources.

When documentation conflicts with observed behavior, explicitly document the conflict.

When possible, provide concrete:

- API requests/responses;
- source-code references;
- contract methods;
- transaction traces;
- benchmark measurements;
- latency measurements;
- state-transition examples;
- failure cases.

Do not invent precision.

Do not claim that something takes a particular number of milliseconds unless it has actually been measured or reliably documented.

Do not call a source “real-time” without explaining what freshness and propagation guarantees that means.

Do not assume that the easiest API to query is the canonical source.

The research must distinguish among:

- canonical chain state;
- indexed chain state;
- cached state;
- derived market state;
- simulated quotes;
- executable quotes;
- historical execution outcomes.

A source can be extremely fast without being authoritative.

A source can be authoritative while being too slow for the strategy.

The optimal architecture may therefore require multiple information sources rather than one universal source.

Determine what information requires:

- strongest consistency;
- lowest latency;
- highest availability;
- highest confidence;
- lowest computational cost.

These requirements may differ by subsystem.

Every subsequent agent inheriting this document must follow this process:

1. Read the entire accumulated prompt.
2. Treat prior material as working knowledge, not immutable truth.
3. Identify the most consequential unresolved questions.
4. Separate established facts from assumptions.
5. Challenge previous conclusions where warranted.
6. Research the highest-value uncertainties.
7. Prefer primary evidence.
8. Add substantive technical findings.
9. Preserve valid prior conclusions.
10. Correct or reject invalid prior conclusions.
11. Record conflicts explicitly.
12. Identify measurements that still need to be performed.
13. Improve the architecture where evidence supports doing so.
14. Leave useful questions or research targets for the next agent.
15. Do not merely restate previous contributions.
16. Do not silently erase earlier reasoning; explain material revisions so later agents can understand why the architecture changed.

When adding new research, favor information that changes an architectural decision, eliminates an incorrect assumption, identifies a previously overlooked risk, provides a measurable performance advantage, or materially improves execution safety.

The final objective of this continuously evolving process is to answer, with evidence rather than intuition:

If you had to build this TON arbitrage terminal today, with the highest possible number of genuinely executable opportunities, the lowest practical detection-to-execution latency, accurate full-route economics, strong execution safety, and a human as the final authorizer, what architecture would you choose, why would you choose it, what evidence supports it, and what would you measure before trusting it with real capital?

The next agent should continue from this document rather than starting over.
