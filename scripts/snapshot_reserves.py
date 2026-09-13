#!/usr/bin/env python3
"""
Append one live reserve/executor snapshot to data/*.jsonl.

This exists to answer TON-ARB-RESEARCH_17's P0 queue item #2 ("take
snapshots of this pool's reserves every 15-30 minutes over several hours
to build a real time series before treating 'actively widening' as
established rather than noise") without requiring a human to keep a
session open for hours. It is invoked on a schedule by
.github/workflows/reserve-snapshot.yml.

Deliberately fails loudly (non-zero exit, no data written) rather than
falling back to mock or partial data on any upstream error — see
core.py's UpstreamError docstring and the project's standing "unknown is
never safe" rule. A missing data point in the time series is honest; a
faked one is not.

This script only reads public data. It does not sign or broadcast
anything.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime, timezone

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "arb-research-api"))
import core  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--pool", default=core.DEFAULT_DEDUST_POOL)
    parser.add_argument("--executor", default=core.EXECUTOR_ADDRESS)
    parser.add_argument("--reserves-out", default="data/reserve_snapshots.jsonl")
    parser.add_argument("--executor-out", default="data/executor_snapshots.jsonl")
    args = parser.parse_args()

    now_iso = datetime.now(timezone.utc).isoformat()

    try:
        reserves = core.get_dedust_pool_reserves(args.pool)
        ton_reserve_raw, usdt_reserve_raw = (int(x) for x in reserves["reserves_raw"])
        ton_reserve = ton_reserve_raw / 1e9
        usdt_reserve = usdt_reserve_raw / 1e6
        implied_price_usdt_per_ton = usdt_reserve / ton_reserve if ton_reserve else None
    except core.UpstreamError as exc:
        print(f"FATAL: reserve fetch failed, no snapshot written: {exc}", file=sys.stderr)
        return 1

    try:
        executor = core.get_executor_config(args.executor)
    except core.UpstreamError as exc:
        print(f"FATAL: executor status fetch failed, no snapshot written: {exc}", file=sys.stderr)
        return 1

    reserve_row = {
        "timestamp_utc": now_iso,
        "pool_address": args.pool,
        "ton_reserve": ton_reserve,
        "usdt_reserve": usdt_reserve,
        "implied_price_usdt_per_ton": implied_price_usdt_per_ton,
        "trade_fee": reserves["trade_fee"],
    }
    executor_row = {
        "timestamp_utc": now_iso,
        "contract_address": args.executor,
        "enabled": executor["enabled"],
        "min_spread_bps": executor["min_spread_bps"],
        "max_trade_nanos": executor["max_trade_nanos"],
        "last_transaction_lt": executor["last_transaction_lt"],
        "block_seqno": executor["block_seqno"],
    }

    for path, row in ((args.reserves_out, reserve_row), (args.executor_out, executor_row)):
        os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
        with open(path, "a") as f:
            f.write(json.dumps(row) + "\n")

    print(f"[{now_iso}] TON/USD₮ pool: {ton_reserve:.2f} TON / {usdt_reserve:.2f} USDT "
          f"(implied {implied_price_usdt_per_ton:.5f} USDT/TON) | "
          f"executor enabled={executor['enabled']} last_tx_lt={executor['last_transaction_lt']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
