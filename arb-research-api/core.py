"""
Core data-fetching functions for the TON DEX Arbitrage research API.

READ-ONLY BY DESIGN. Nothing in this module signs, broadcasts, or moves a
transaction. It only queries public REST endpoints (STON.fi, DeDust,
Toncenter) and returns parsed JSON. See the project README and
[[ton_arb_verification_discipline]]: every value returned here should be
treated as a live snapshot, never as a cached truth, and "unknown" fields
must be returned as such rather than guessed.

Every endpoint call in this file was verified live against the real API
during TON-ARB-RESEARCH_18 (2026-09-13) before being written, not guessed
from documentation or a prior contribution's prose description:
  - GET  https://api.dedust.io/v2/pools                    (~50k pools, no auth)
  - POST https://api.dedust.io/v2/routing/plan              (quote)
  - POST https://api.ston.fi/v1/swap/simulate                (quote)
  - GET  https://toncenter.com/api/v2/getAddressInformation  (contract data)
  - POST https://toncenter.com/api/v2/runGetMethod           (get-method call)
  - GET  https://toncenter.com/api/v2/getTransactions        (tx history)
"""

from __future__ import annotations

import os
import time
from typing import Any

import requests

USER_AGENT = "Mozilla/5.0 (compatible; TonArbTerminal/1.0)"
DEFAULT_TIMEOUT = 10

NATIVE_TON_STONFI = "EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c"
USDT_JETTON_STONFI = "EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs"
USDT_JETTON_DEDUST = "jetton:0:b113a994b5024a16719f69139328eb759596c38a25f59028b146fecdc3621dfe"

DEFAULT_DEDUST_POOL = "EQA-X_yo3fzzbDbJ_0bzFWKqtRuZFIRa1sJsveZJ1YpViO3r"
EXECUTOR_ADDRESS = "EQBo5HJbBWZlOVuBpOPSiRNu18eHgq8XmoTbwdBlZpKflg3s"


def _toncenter_headers() -> dict[str, str]:
    api_key = os.environ.get("TONCENTER_API_KEY")
    return {"X-API-Key": api_key} if api_key else {}


class UpstreamError(RuntimeError):
    """Raised when an upstream API call fails or returns an unexpected shape.

    Deliberately not swallowed into a mock fallback here — this API's job is
    to tell a caller the truth about whether live data was obtained, per the
    project's standing rule that "unknown" must never be treated as "safe."
    RESEARCH_17 found two CLI tools silently faking live output on failure;
    this module refuses to repeat that failure mode.
    """


def fetch_dedust_pools() -> list[dict[str, Any]]:
    """Full DeDust pool list (reserves, fees, assets). No auth required."""
    resp = requests.get(
        "https://api.dedust.io/v2/pools",
        headers={"User-Agent": USER_AGENT},
        timeout=DEFAULT_TIMEOUT * 3,  # ~25MB response; the 5s timeouts that
                                       # broke RESEARCH_17's tools are not repeated here
    )
    if resp.status_code != 200:
        raise UpstreamError(f"DeDust /v2/pools returned HTTP {resp.status_code}")
    return resp.json()


def get_dedust_pool_reserves(pool_address: str = DEFAULT_DEDUST_POOL) -> dict[str, Any]:
    """Reserves for one DeDust pool, found by address in the full pool list."""
    pools = fetch_dedust_pools()
    for pool in pools:
        if pool.get("address") == pool_address:
            reserves = pool.get("reserves") or [None, None]
            assets = pool.get("assets") or []
            return {
                "pool_address": pool_address,
                "assets": assets,
                "reserves_raw": reserves,
                "trade_fee": pool.get("tradeFee"),
                "total_supply": pool.get("totalSupply"),
                "fetched_at_unix": int(time.time()),
            }
    raise UpstreamError(f"Pool {pool_address} not found in live DeDust pool list")


def query_dedust_quote(from_asset: str, to_asset: str, amount_nanos: int) -> int:
    """Live DeDust routing-plan quote. Returns amountOut as an int of base units."""
    resp = requests.post(
        "https://api.dedust.io/v2/routing/plan",
        json={"from": from_asset, "to": to_asset, "amount": str(amount_nanos)},
        headers={"User-Agent": USER_AGENT, "Content-Type": "application/json"},
        timeout=DEFAULT_TIMEOUT,
    )
    data = resp.json()
    if isinstance(data, list) and data and data[0] and data[0][0]:
        return int(data[0][0]["amountOut"])
    raise UpstreamError(f"DeDust routing/plan returned unexpected shape: {data!r}")


def query_stonfi_quote(offer_address: str, ask_address: str, units: int, slippage: float = 0.005) -> dict[str, Any]:
    """Live STON.fi swap-simulate quote. Returns the full parsed response."""
    resp = requests.post(
        "https://api.ston.fi/v1/swap/simulate",
        params={
            "offer_address": offer_address,
            "ask_address": ask_address,
            "units": str(units),
            "slippage_tolerance": slippage,
        },
        headers={"User-Agent": USER_AGENT},
        timeout=DEFAULT_TIMEOUT,
    )
    data = resp.json()
    if "ask_units" not in data:
        raise UpstreamError(f"STON.fi swap/simulate returned unexpected shape: {data!r}")
    return data


def get_executor_config(address: str = EXECUTOR_ADDRESS) -> dict[str, Any]:
    """Live getConfig() call against the (unaudited, never-used) executor contract.

    Read-only get-method call. This function cannot send funds through the
    contract and does not attempt to; it exists purely to answer "is it
    still enabled and still unused," the question RESEARCH_12/14/17 each
    re-verified live and independently.
    """
    resp = requests.post(
        "https://toncenter.com/api/v2/runGetMethod",
        json={"address": address, "method": "getConfig", "stack": []},
        headers={"Content-Type": "application/json", **_toncenter_headers()},
        timeout=DEFAULT_TIMEOUT,
    )
    data = resp.json()
    if not data.get("ok"):
        raise UpstreamError(f"Toncenter runGetMethod failed: {data!r}")
    stack = data["result"]["stack"]

    def as_int(entry: list[str]) -> int:
        return int(entry[1], 16)

    enabled, min_spread_bps, max_trade_nanos, gas_reserve_nanos = (as_int(s) for s in stack[:4])
    return {
        "contract_address": address,
        "enabled": enabled == 1,
        "min_spread_bps": min_spread_bps,
        "max_trade_nanos": max_trade_nanos,
        "gas_reserve_nanos": gas_reserve_nanos,
        "last_transaction_lt": data["result"]["last_transaction_id"]["lt"],
        "block_seqno": data["result"]["block_id"]["seqno"],
        "fetched_at_unix": int(time.time()),
    }


def get_pool_transactions(pool_address: str = DEFAULT_DEDUST_POOL, limit: int = 50) -> list[dict[str, Any]]:
    """Raw Toncenter transaction history for a pool. Not swap-classified here —
    see TON-ARB-RESEARCH_17 §1 for why a naive text/heuristic classifier on
    this data silently produced false negatives; this function deliberately
    returns raw data rather than repeating that guess.
    """
    resp = requests.get(
        "https://toncenter.com/api/v2/getTransactions",
        params={"address": pool_address, "limit": limit, "archival": "true"},
        headers=_toncenter_headers(),
        timeout=DEFAULT_TIMEOUT,
    )
    data = resp.json()
    if not data.get("ok"):
        raise UpstreamError(f"Toncenter getTransactions failed: {data!r}")
    return data["result"]


def compute_dual_dex_spread(amount_ton: float, slippage: float = 0.005) -> dict[str, Any]:
    """Live matched-quote spread between DeDust and STON.fi for one trade size.

    Mirrors src/tools/dual_dex_simulator.ts's Path A / Path B definitions.
    This computes a *hypothetical* P&L for research purposes only — it does
    not place, size, or authorize any trade. Per the project's standing
    rule, no output of this function is a green light to trade.
    """
    amount_nanos = int(round(amount_ton * 1e9))
    estimated_gas_ton = 0.25

    leg1_dedust_nanos = query_dedust_quote("native", USDT_JETTON_DEDUST, amount_nanos)
    leg2_stonfi = query_stonfi_quote(USDT_JETTON_STONFI, NATIVE_TON_STONFI, leg1_dedust_nanos, slippage)
    leg2_stonfi_ton = int(leg2_stonfi["ask_units"]) / 1e9

    leg1_stonfi = query_stonfi_quote(NATIVE_TON_STONFI, USDT_JETTON_STONFI, amount_nanos, slippage)
    leg1_stonfi_nanos = int(leg1_stonfi["ask_units"])
    leg2_dedust_nanos = query_dedust_quote(USDT_JETTON_DEDUST, "native", leg1_stonfi_nanos)
    leg2_dedust_ton = leg2_dedust_nanos / 1e9

    path_a_gross = leg2_stonfi_ton - amount_ton
    path_b_gross = leg2_dedust_ton - amount_ton

    return {
        "amount_ton": amount_ton,
        "path_a": {
            "description": "DeDust TON->USDT -> STON.fi USDT->TON",
            "gross_profit_ton": path_a_gross,
            "net_profit_ton": path_a_gross - estimated_gas_ton,
        },
        "path_b": {
            "description": "STON.fi TON->USDT -> DeDust USDT->TON",
            "gross_profit_ton": path_b_gross,
            "net_profit_ton": path_b_gross - estimated_gas_ton,
        },
        "fetched_at_unix": int(time.time()),
    }
