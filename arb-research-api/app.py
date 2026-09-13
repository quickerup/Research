"""
arb-research-api — read-only HTTP wrapper around this project's research
data sources (STON.fi, DeDust, Toncenter).

WHAT THIS IS: a small Flask API so research findings (pool reserves, live
quotes, executor status, spread calculations) can be pulled by other tools
in this repo — including the scheduled GitHub Actions in .github/workflows/
— without every caller reimplementing HTTP + parsing logic. All of the
actual fetching/parsing lives in core.py; this file only wires it to routes.

WHAT THIS IS NOT: nothing here signs a transaction, holds a private key, or
executes a trade. Every route is a GET or read-only query. This is
consistent with, and does not change, the project's standing rule (see
README.md): a human is the final authorization authority for every trade,
and no code in this repository moves funds. If a future contribution adds
an endpoint that could move funds, it must be surfaced to the user before
being merged, per [[ton_arb_project]].

Run locally:
    pip install -r requirements.txt
    python app.py                 # dev server on :8080
    FLASK_ENV=production gunicorn -w 2 -b 0.0.0.0:8080 app:app   # prod-ish
"""

from __future__ import annotations

import os

from flask import Flask, jsonify, request

import core

app = Flask(__name__)


def _error_response(exc: Exception, status: int = 502):
    return jsonify({"ok": False, "error": str(exc)}), status


@app.get("/health")
def health():
    return jsonify({"ok": True, "service": "arb-research-api"})


@app.get("/reserves/dedust")
def dedust_reserves():
    pool = request.args.get("pool", core.DEFAULT_DEDUST_POOL)
    try:
        return jsonify({"ok": True, "data": core.get_dedust_pool_reserves(pool)})
    except core.UpstreamError as exc:
        return _error_response(exc)


@app.get("/executor/status")
def executor_status():
    address = request.args.get("address", core.EXECUTOR_ADDRESS)
    try:
        return jsonify({"ok": True, "data": core.get_executor_config(address)})
    except core.UpstreamError as exc:
        return _error_response(exc)


@app.get("/pool/transactions")
def pool_transactions():
    pool = request.args.get("pool", core.DEFAULT_DEDUST_POOL)
    limit = int(request.args.get("limit", 50))
    try:
        return jsonify({"ok": True, "data": core.get_pool_transactions(pool, limit)})
    except core.UpstreamError as exc:
        return _error_response(exc)


@app.get("/quote/stonfi")
def stonfi_quote():
    try:
        offer = request.args["offer_address"]
        ask = request.args["ask_address"]
        units = int(request.args["units"])
    except (KeyError, ValueError) as exc:
        return jsonify({"ok": False, "error": f"missing/invalid query param: {exc}"}), 400
    slippage = float(request.args.get("slippage", 0.005))
    try:
        return jsonify({"ok": True, "data": core.query_stonfi_quote(offer, ask, units, slippage)})
    except core.UpstreamError as exc:
        return _error_response(exc)


@app.get("/spread")
def spread():
    try:
        amount_ton = float(request.args.get("amount", 10))
        slippage = float(request.args.get("slippage", 0.005))
    except ValueError as exc:
        return jsonify({"ok": False, "error": f"invalid query param: {exc}"}), 400
    try:
        return jsonify({"ok": True, "data": core.compute_dual_dex_spread(amount_ton, slippage)})
    except core.UpstreamError as exc:
        return _error_response(exc)


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    host = os.environ.get("HOST", "127.0.0.1")  # opt in to 0.0.0.0 explicitly if deploying
    app.run(host=host, port=port, debug=False)
