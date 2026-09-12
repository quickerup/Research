AGENT_ID: TON-ARB-RESEARCH-11

I inspected Research-master.zip in full at the structural/content level. The archive contains 10 research documents covering RESEARCH-01 through RESEARCH-10, about 200 KB of Markdown, with RESEARCH-10 being a compression/digest rather than a new research contribution.

What the corpus establishes

The project is now substantially beyond the initial architecture stage. The strongest current conclusions are:

Objective: a human-authorized, semi-automatic TON DEX arbitrage terminal, primarily evaluating STON.fi ↔ DeDust opportunities.

Execution philosophy: discovery and validation are automated, but the human remains the final authorization authority.

Quote sources: both DEX sides now have identified executable-quote paths.

STON.fi: /v1/swap/simulate

DeDust: /v2/routing/plan


TON timing: the research treats the chain as a low-latency environment, making stale quotes and human approval latency major concerns.

Safety: asset identity must use contract/type identity rather than symbols; TON/GRAM symbol collisions are explicitly recognized as a production safety hazard.

Economic model: quoted output, protocol fees, router/network fees, price impact, gas, minimum output, and safety margins must be represented separately to avoid double-counting.

State freshness: state identity is preferred over a simple wall-clock quote TTL.

Failure policy: PASS / FAIL / UNKNOWN, with UNKNOWN → execution blocked.

Executor: the deployed contract is real and contains owner-gated dispatch handlers. Earlier conclusions that it was nonexistent/placeholder were subsequently corrected through live queries and local TVM emulation.

Critical limitation: the executor's post-authorization behavior is still not fully understood, so its safety cannot yet be assumed.

Research boundary: no deployment, signing, fund movement, or autonomous execution.


The most important unresolved questions

The compression document identifies seven remaining items. I agree with its prioritization, but I would reorder them slightly:

P0 — Establish whether there is actually an executable arbitrage opportunity now.

Run a matched-time, matched-size cross-DEX quote experiment using the two now-established endpoints. This is the project's original objective and has not yet been completed with both quote systems simultaneously.

P0 — Establish symmetric confidence in both quote adapters.

STON.fi has not yet received the same live-test + source-code cross-check treatment that DeDust received. Until that is done, a calculated spread is only as trustworthy as its weaker quote.

P1 — Determine executor ownership and stored configuration.

Read-only inspection of its persistent data should establish the owner/admin address and other stored state. This requires no signing and should be done before considering the executor architecturally trustworthy.

P1 — Decide whether the custom executor should even be used.

The two competing architectures are:

1. Finish/audit the existing executor, or


2. Avoid it initially and orchestrate sequential DEX transactions from the client, enforcing minimum-output, deadline, balance, and profitability invariants client-side.



I would currently favor option 2 for the first safe prototype, unless further inspection demonstrates that the executor has a compelling atomic/conditional capability that materially improves execution safety.

P2 — Benchmark reality rather than theorize about latency.

Measure:

STON.fi quote p50/p95/p99 latency

DeDust quote p50/p95/p99 latency

concurrent versus sequential requests

Streaming-event arrival lag

quote-to-state-change lag

opportunity half-life

human approval latency


P2 — Measure competition.

The corpus correctly identifies MEV/competition as an empirical unknown. A monitoring period should determine how often attractive opportunities disappear because another transaction captured the underlying price discrepancy.

One particularly important methodological conclusion

The archive contains several examples of confident but incorrect conclusions being overturned by direct evidence.

That makes the following rule especially important for TON-ARB-RESEARCH-11:

> No claim about executable behavior should be promoted to FACT without an inspectable artifact.



For contracts, that means transaction traces, get-method results, sandbox execution, or equivalent evidence—not inferred semantics from raw opcode patterns.

For APIs, it means an actual request/response plus source/documentation cross-check—not guessed URLs.

For arbitrage, it means a matched-time executable quote pair, not historical prices or independently timestamped market data.

My assessment of the project state

The research has reached the point where more architecture speculation has diminishing value.

The highest-value next step is now empirical:

Take the confirmed STON.fi and DeDust quote mechanisms and produce one rigorous, reproducible cross-DEX arbitrage measurement.

That experiment should answer:

input size → quote A → intermediate asset → quote B → final native-asset amount → all embedded/explicit costs → gas → net P&L → ROI

and record timestamps and quote/state identifiers for both sides.

If that experiment produces no executable positive opportunities across sensible trade sizes, that is itself an important result: it would tell us whether the project needs to focus on latency/competition rather than further refining the theoretical arbitrage calculator.

If it does produce positive opportunities, we can immediately move to measuring how long they remain executable.

So, as TON-ARB-RESEARCH-11, my recommended immediate mission is:

> Validate the complete live cross-DEX economic pipeline before touching execution.



That is the cleanest way to turn the accumulated research from an architecture brief into evidence about whether the proposed terminal can actually find money-making opportunities.
