# data/

Machine-generated research data, appended to by the scheduled
`reserve-snapshot.yml` GitHub Action (see `scripts/snapshot_reserves.py`
and root `README.md` §"Automation & Tooling Infrastructure"). Not hand-
edited. Each file is JSON Lines (one JSON object per line, newest last).

## `reserve_snapshots.jsonl`

One row per snapshot of the DeDust TON/USD₮ pool this project has tracked
since RESEARCH_11 (`EQA-X_yo3fzzbDbJ_0bzFWKqtRuZFIRa1sJsveZJ1YpViO3r` unless
overridden):

```json
{"timestamp_utc": "...", "pool_address": "...", "ton_reserve": 201799.30, "usdt_reserve": 317806.16, "implied_price_usdt_per_ton": 1.57486, "trade_fee": "0.1"}
```

This is the time series TON-ARB-RESEARCH_17 §8 asked for (15–30 min
snapshots over hours) to determine whether the ~14% DeDust/STON.fi spread
is widening, narrowing, or noisy. Don't hand-wave a trend from two points —
plot or diff a real range of rows before making a claim about direction.

## `executor_snapshots.jsonl`

One row per snapshot of the (unaudited, owner-gated) executor contract's
live `getConfig()` state:

```json
{"timestamp_utc": "...", "contract_address": "...", "enabled": true, "min_spread_bps": 200, "max_trade_nanos": 50000000000, "last_transaction_lt": "103104091000005", "block_seqno": 92351929}
```

`last_transaction_lt` unchanged across rows means the contract still hasn't
processed a real trade (true as of every contribution through 18). If it
ever changes, that's a real event worth investigating, not a snapshot to
skim past.
