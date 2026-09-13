"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchDedustPoolReserves = fetchDedustPoolReserves;
exports.constantProductSwapOut = constantProductSwapOut;
exports.getPtonMasterAddress = getPtonMasterAddress;
const axios_1 = __importDefault(require("axios"));
// Confirmed live 2026-09-13 (RESEARCH_24): DeDust's `/v2/pools` and `/v2/routing/plan`
// REST endpoints are DeDust's own documented-as-legacy API tier (docs.dedust.io still
// publishes them, but they are not what dedust.io's own frontend calls). A live
// side-by-side check against the pool's own `get_reserves()` get-method found `/v2/pools`
// reporting reserves that implied a price 15.7% off the true on-chain price at the same
// instant, with `lastPrice: null` and zero-valued 24h stats for a pool doing real,
// continuous swap volume. The `/v4/api/get_pools` screener below is what dedust.io
// actually renders from, confirmed to reproduce the on-chain `get_reserves()` values
// exactly (bit-for-bit reserve match, not just "close").
const DEDUST_V4_BASE = 'https://mainnet.api.dedust.io/v4/api';
async function fetchDedustPoolReserves(poolAddress) {
    const response = await axios_1.default.post(`${DEDUST_V4_BASE}/get_pools`, {
        offset: 0,
        limit: 1,
        sort_by: 'volume_24h',
        sort_direction: 'desc',
        pool_addresses: [poolAddress]
    }, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 5000
    });
    const row = response.data?.pool_rows?.[0]?.pools?.[0];
    if (!row || !Array.isArray(row.reserves) || row.reserves.length !== 2) {
        throw new Error(`DeDust v4 get_pools returned no usable row for ${poolAddress}: ${JSON.stringify(response.data)}`);
    }
    return {
        nativeReserve: BigInt(row.reserves[0]),
        jettonReserve: BigInt(row.reserves[1]),
        feeBps: Number(row.trade_fee),
        lastActivityAt: row.last_activity_at
    };
}
// Standard constant-product-with-fee swap output (matches DeDust's volatile/CPMM pools,
// e.g. `lp_fee` + `protocol_fee` = `trade_fee` = 10 => 0.10% for the TON/USDT pool).
function constantProductSwapOut(amountIn, reserveIn, reserveOut, feeBps) {
    const FEE_DENOM = 10000n;
    const amountInWithFee = amountIn * (FEE_DENOM - BigInt(feeBps));
    const numerator = amountInWithFee * reserveOut;
    const denominator = reserveIn * FEE_DENOM + amountInWithFee;
    return numerator / denominator;
}
// STON.fi's own placeholder for "native TON" (`EQAAAA...M9c`, used in its `/v1/pools`
// listing's `token1_address`) is not a real address and is rejected outright by
// `/v1/swap/simulate` ("invalid jetton address"). The real value is the pTON master
// address for whichever router will actually serve the trade, and it's version-specific
// (confirmed live 2026-09-13: 50 of 51 routers on `/v1/routers` are major_version 2 and
// share one pton_master_address; exactly 1 is major_version 1 with a different one).
// Rather than hardcode either, resolve it live and prefer the highest major_version,
// since that's what nearly every current pool uses.
let cachedPtonMasterAddress = null;
async function getPtonMasterAddress() {
    if (cachedPtonMasterAddress)
        return cachedPtonMasterAddress;
    const response = await axios_1.default.get('https://api.ston.fi/v1/routers', { timeout: 5000 });
    const routers = response.data?.router_list;
    if (!Array.isArray(routers) || routers.length === 0) {
        throw new Error(`STON.fi /v1/routers returned no routers: ${JSON.stringify(response.data)}`);
    }
    const best = routers.reduce((a, b) => (b.major_version > a.major_version ? b : a));
    cachedPtonMasterAddress = best.pton_master_address;
    return cachedPtonMasterAddress;
}
