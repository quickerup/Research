# arb-research-api

A small read-only Flask API wrapping this project's live data sources
(STON.fi, DeDust, Toncenter) so other tools — including the scheduled
GitHub Actions in `.github/workflows/` — can pull research data over HTTP
instead of each reimplementing the same requests + parsing.

This directory does not sign or broadcast anything, and never will without
that being surfaced to the user first (see the root `README.md`'s standing
rules and [[ton_arb_project]]). Every route is read-only.

## Setup

```
cd arb-research-api
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python app.py            # serves on http://127.0.0.1:8080
```

Optional env vars:
- `TONCENTER_API_KEY` — raises Toncenter's rate limit (not required for the
  unauthenticated public rate, same as the existing TypeScript tools).
- `PORT`, `HOST` — override the bind address/port (defaults to
  `127.0.0.1:8080`; set `HOST=0.0.0.0` only if you actually intend to expose
  this beyond localhost, e.g. behind your own reverse proxy).

## Endpoints

| Route | Method | Purpose |
|---|---|---|
| `/health` | GET | Liveness check. |
| `/reserves/dedust?pool=<address>` | GET | Live reserves for one DeDust pool (defaults to the TON/USD₮ pool this project has tracked since RESEARCH_11). |
| `/executor/status?address=<address>` | GET | Live `getConfig()` read of the (unaudited, still-unused) executor contract. |
| `/pool/transactions?pool=<address>&limit=<n>` | GET | Raw Toncenter transaction history for a pool — intentionally unclassified; see TON-ARB-RESEARCH_17 §1 for why a naive swap classifier on this data produced false negatives. |
| `/quote/stonfi?offer_address=&ask_address=&units=&slippage=` | GET | Live STON.fi swap-simulate quote. |
| `/spread?amount=<TON>&slippage=<pct>` | GET | Live matched dual-DEX quote for one trade size (Path A / Path B, mirrors `src/tools/dual_dex_simulator.ts`). Informational only — not a trade signal. |

Every route either returns real, freshly-fetched data or a non-2xx error —
none of them silently fall back to mock data on failure. That fallback
behavior is what caused two of the five CLI tools in `src/tools/` to report
fake "LIVE" results in TON-ARB-RESEARCH_17; this API deliberately does not
repeat it. A caller that wants mock/offline data should use the CLI tools'
`--mock` flag instead.

## Testing

There is no live-network mocking here by design (see above), so tests
should either hit the real read-only endpoints (as TON-ARB-RESEARCH_17 and
_18 did manually) or stub `requests` at the test layer — do not add a
silent mock-fallback path to `core.py` to make testing easier.
