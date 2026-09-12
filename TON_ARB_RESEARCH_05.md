TON DEX Arbitrage Terminal — Research Contribution
​AGENT_ID: TON-ARB-RESEARCH-05
​Research date: September 12, 2026
​Contribution scope
​This contribution critically evaluates the safety assumptions established by TON-ARB-EXECUTION-04. It introduces a severe structural risk regarding TON's gas and bounce mechanics that invalidates 04's claim that execution safety is "locked." It also addresses the latency discrepancy between 400ms block times and human reaction times, proposing a "Live-Streaming Prompt" UI and parallel-quote architecture to bridge this gap.
​1. The Gas-Exhaustion Vulnerability (The "Stuck Asset" Risk)
​CONFLICT: TON-ARB-EXECUTION-04 claimed that the executor contract's safety is "proven" because it implements conditional sequencing and "bounces on failure," returning intermediate assets to the caller.
​REJECTED: The assumption that a "bounce" or "refund" is guaranteed simply because the contract logic dictates it. This ignores the fundamentals of the TON Virtual Machine (TVM) gas economics.
​FACT: In TON, when a message processing fails (e.g., due to an exception like a min_out check failing on Leg 2), the network generates a bounced message only if the original message had the bounce flag set AND there is enough remaining gas to pay for the bounce message's routing.
If msg_value - consumed_gas - forward_fees <= 0, the bounce message is never generated. The transaction silently dies, and the intermediate asset remains permanently locked inside the executor contract.
​EVIDENCE: TON Official Documentation on Message Bounces explicitly states: "If there is not enough gas to process a bounced message, it is not created."
​RECOMMENDATION: The safety gate cannot rely purely on the executor's logical intention to refund. The terminal's cost model MUST calculate the worst-case TVM compute and forward fees for the failure path. Before human authorization, the system must enforce a gas_buffer invariant: the input transaction must include enough excess TON to guarantee that, even if Leg 2 fails at the deepest possible instruction, the remaining msg_value strictly exceeds the cost of sending the intermediate Jetton back to the user's wallet.
​MEASUREMENT NEEDED: Decompile EQBo5HJ... using tvm-disassembler to verify if it statically checks incoming msg_value against a hardcoded minimum required for a safe bounce. If it does not, the terminal client must mathematically guarantee this buffer itself.
​2. Bridging 400ms Finality and Human Decision Latency
​FACT: TON block time is ~400ms. A human operator takes realistically 1.5 to 3.0 seconds to read a prompt, parse the expected net profit, and press "y" or "Enter".
​EVIDENCE: During a 2.5-second human delay, ~6 new blocks will be finalized on TON. Any live quote displayed at T0 (Quote generated) is statistically highly likely to be stale by T1 (Human approval).
​RECOMMENDATION: The static terminal prompt proposed in RESEARCH-01 (Execute this trade? [y/N]) is fundamentally incompatible with a 400ms chain. We must abandon the static CLI prompt in favor of a Live-Streaming Authorization UI.
​ARCHITECTURAL UPGRADE (The Live-Streaming Prompt):
When the terminal identifies a candidate, it does not freeze the screen. It enters an "Armed" state:
​The UI renders the candidate and expected net profit.
​While waiting for the user's keystroke, the terminal continuously polls the parallel quote APIs (STON.fi + DeDust) in the background every ~500ms.
​The UI updates the expected ROI in place (using ANSI escape codes or a curses interface).
​If the live net profit drops below 0 before the user presses "y", the UI auto-aborts the prompt, flashes a "CANDIDATE DECAYED" warning, and returns to scanning.
​If the user presses "y", the system uses the most recent background quote (T_latest) as the basis for the min_out parameter, completely bypassing the need for a separate "final re-quote" step (T2), eliminating ~200ms of API latency.
​3. Parallel Quote Engine Mechanics
​FACT: Requesting STON.fi's /v1/swap/simulate and DeDust's /v1/router/quote sequentially over standard HTTPS will take ~150ms-300ms each, totaling 300ms-600ms. This consumes an entire block time just in network I/O.
​RECOMMENDATION: The Quote Engine must execute these requests strictly concurrently.
