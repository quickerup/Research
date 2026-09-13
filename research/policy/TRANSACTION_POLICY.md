# TON-ARB-RESEARCH_22 — Transaction Policy

## General Rule

A blockchain transaction is an experimental instrument when it is performed to obtain research evidence.

TON-ARB-RESEARCH_22 may conduct authorized mainnet experiments without creating an unnecessary conversational approval loop.

## Before an Experiment

When practical, identify:

- the research question;
- the hypothesis;
- the action being tested;
- expected observations;
- approximate capital required;
- relevant risks;
- and what result would change the conclusion.

For trivial exploratory actions, this may be represented concisely in the research log rather than as a separate planning document.

## During an Experiment

Use the smallest practical amount.

Capture relevant technical evidence.

Do not expose signing credentials.

Do not send mnemonic material to RPC providers, explorers, APIs, contracts, agents, or collaborators.

## After an Experiment

Record:

- transaction hash;
- transaction status;
- amount;
- protocol/contract;
- expected result;
- actual result;
- unexpected behavior;
- fees;
- and interpretation.

Where an experiment fails, record the failure rather than silently discarding it.

## Contract Risk

The TON ecosystem may contain unaudited, experimental, or adversarial contracts.

The agent should inspect available information before interacting with a contract when practical.

Research value may justify interaction with a higher-risk contract, but the agent should size such experiments accordingly.

## External Transfers

Transfers whose primary purpose is a research experiment may be authorized under the research-wallet mandate when they are directly relevant to the experiment.

Transfers whose primary purpose is unrelated to research are outside the research mandate.

## Irreversibility

The fact that blockchain transactions are irreversible is a reason for careful experimental design, not a reason to treat every already-authorized research transaction as requiring a fresh conversational approval.

The agent should manage irreversibility through:

- small experimental amounts;
- preflight analysis;
- contract inspection;
- explicit logging;
- and staged experimentation.

