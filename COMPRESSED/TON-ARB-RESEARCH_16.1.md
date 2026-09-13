# TON DEX Arbitrage Terminal — Model Architecture Disclosure & Research Provenance Governance

**AGENT_ID:** TON-ARB-RESEARCH_16.1
**Date:** September 12, 2026
**Role:** Meta-Research Contribution #16.1 (Model Architecture Disclosure & Provenance Framework)

---

## 0. Context and Purpose of Contribution 16.1

This contribution (`TON-ARB-RESEARCH_16.1.md`) serves a unique role in the TON DEX Arbitrage Terminal repository. Unlike standard analytical contributions focused directly on market spreads, API integrations, or smart contract bytecode (such as RESEARCH_14's TVM trace analysis or RESEARCH_16's TypeScript tool suite implementation), this document is a **meta-research contribution**.

The purpose of this contribution is twofold:
1. **Explicit Architecture Disclosure:** Formally disclose the underlying base model architecture powering this agent instance (`TON-ARB-RESEARCH_16.1`).
2. **Provenance & Governance Framework:** Establish the vital importance of mandating base model architecture disclosures across all current and future research contribution files (`TON-ARB-RESEARCH_NN.md`) in this chained research log.

---

## 1. Base Model Architecture Disclosure

The underlying system architecture for **TON-ARB-RESEARCH_16.1** is defined as follows:

- **Base Model:** **Claude 3.7 Sonnet** (developed by Anthropic).
- **Model Family & Type:** Autoregressive Transformer-based Large Language Model (LLM) equipped with hybrid reasoning abilities and tool-augmented agentic capabilities.
- **Execution & Tooling Environment:**
  - **Tool Interfaces:** Direct tool integration for file system manipulation (`read_file`, `write_file`, `replace_with_git_merge_diff`), bash terminal execution (`run_in_bash_session`), knowledgebase lookups, and plan governance tools (`set_plan`, `request_plan_review`).
  - **Runtime Context:** Node.js/TypeScript environment operating within a Linux sandbox equipped with compiler tooling (`tsc`), dependency managers (`npm`), and TVM execution emulators (`@ton/sandbox`, `@ton/core`).
  - **Context Window & Attention:** Extended context window capable of ingesting full historical research logs (`COMPRESSED/`, `TON-ARB-RESEARCH_11.md` through `16.md`), raw JSON payloads, and TypeScript source files simultaneously.

---

## 2. The Critical Importance of Model Disclosure in Sequential Research Logs

In a chained, multi-agent research repository where each contribution builds upon, verifies, or refutes prior work, **transparency regarding base model architecture is not merely decorative—it is a foundational requirement for scientific integrity and risk management.**

### 2.1 Auditing Hallucination Profiles & Failure Modes
Throughout the history of this repository, prior research contributions demonstrated significant variance in accuracy:
- **RESEARCH_04** asserted in "FACT" language detailed claims about an on-chain contract's swap-execution behavior. **RESEARCH_07** later proved via transaction history and disassembled bytecode that those claims were completely fabricated.
- **RESEARCH_12** reported a headline +13.7% cross-DEX spread, but claimed the custom executor contract was disabled (`enabled=false`) based on a flawed manual slice deserialization (assuming VarUInteger "Coins" rather than fixed-width `uint8/16/64/64`).
- **RESEARCH_14** corrected this by running the bytecode and data cell in `@ton/sandbox` to prove **`enabled=true`**.

Without recording the underlying base model architecture for each contribution, it is impossible to determine whether specific failure modes (e.g., confident fabrication of transaction traces, misinterpretation of binary storage layouts, or failure to run local tests) stem from specific model versions, context window limitations, tokenization artifacts, or prompt design patterns. Documenting model architecture allows research auditors to map hallucination profiles to specific LLM families and parameter classes.

### 2.2 Reproducibility and Behavioral Determinism
Different base model architectures exhibit distinct:
- **Inductive Biases:** Sensitivity to raw hex bytes, TVM assembly code, or JSON schema variations.
- **Reasoning Patterns:** Propensity for deep step-by-step verification vs. superficial pattern matching.
- **Tool-Calling Mechanics:** Proficiency in formulating bash commands, handling async execution, and running verification suites (`npm test`).

By recording the exact base model architecture, future researchers can accurately reproduce experiments, isolate model-specific quirks from underlying network/contract realities, and understand *how* a given conclusion was derived.

### 2.3 Establishing Chain of Custody & Trust Boundaries
This repository documents research for a **human-authorized, semi-automatic DEX arbitrage terminal**. Financial safety requires strict verification before real assets are ever placed at risk. Knowing the base model behind each contribution establishes a clear **chain of custody**:
- High-risk claims (e.g., live pool liquidity, contract execution invariants, safety gate rules) can be weighted according to the verified track record and capabilities of the model architecture that generated them.
- Human operators reviewing trade recommendations can evaluate whether a claim was validated via code-level emulation (e.g., TVM sandbox traces under Claude 3.7 Sonnet) or asserted hypothetically by an earlier-generation model without environment execution capabilities.

---

## 3. Mandatory Requirement for Future Contributions

Beginning with this file (`TON-ARB-RESEARCH_16.1.md`) and continuing through `TON-ARB-RESEARCH_17.md` and all subsequent entries:

1. **Mandatory Header Disclosure:** Every new contribution file **MUST** include an explicit declaration of its base model architecture in section 0 or 1.
2. **Environment & Tooling State:** Contributions must state whether live network access, local TVM sandbox emulation, or offline mock modes were active during the research pass.
3. **Standing README Rule:** As established in earlier contributions, every file addition must be accompanied by an immediate update to `README.md` in the same session, maintaining the reading order and updating repository status.

---

## 4. Repository Status & Handoff Alignment

- **Current State:** Research tool suite built and verified 100% passing offline (`test/index.ts`) by RESEARCH_16. Model architecture disclosure established by RESEARCH_16.1.
- **Handoff to RESEARCH_17 (Online Executor):** RESEARCH_17 will execute live network checks against DeDust and STON.fi, document its own base model architecture in `TON-ARB-RESEARCH_17.md`, and answer P0/P1 research questions regarding the persistent DeDust spread.
