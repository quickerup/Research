"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MOCK_SIMULATOR_DATA = void 0;
exports.queryStonfi = queryStonfi;
exports.queryDeDust = queryDeDust;
exports.simulateDualDexArbitrage = simulateDualDexArbitrage;
const axios_1 = __importDefault(require("axios"));
exports.MOCK_SIMULATOR_DATA = {
    1: {
        stonfiUsdt: 1.377746,
        dedustUsdt: 1.575724,
        stonfiTonBack: 1.137119,
        dedustTonBack: 0.872601
    },
    10: {
        stonfiUsdt: 13.777396,
        dedustUsdt: 15.756539,
        stonfiTonBack: 11.370624,
        dedustTonBack: 8.725633
    },
    100: {
        stonfiUsdt: 137.767315,
        dedustUsdt: 157.495174,
        stonfiTonBack: 113.649135,
        dedustTonBack: 87.218159
    }
};
const ESTIMATED_GAS_TON = 0.25;
const NATIVE_TON_STONFI = 'EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c';
const USDT_JETTON_STONFI = 'EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs';
const USDT_JETTON_DEDUST = 'jetton:0:b113a994b5024a16719f69139328eb759596c38a25f59028b146fecdc3621dfe';
async function queryStonfi(from, to, amountNanos, slippage) {
    const url = `https://api.ston.fi/v1/swap/simulate?offer_address=${from}&ask_address=${to}&units=${amountNanos.toString()}&slippage_tolerance=${slippage}`;
    const response = await axios_1.default.post(url, {}, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; TonArbTerminal/1.0)' },
        timeout: 5000
    });
    if (response.data && response.data.ask_units) {
        return BigInt(response.data.ask_units);
    }
    throw new Error(`Stonfi query failed: ${JSON.stringify(response.data)}`);
}
async function queryDeDust(from, to, amountNanos) {
    const url = `https://api.dedust.io/v2/routing/plan`;
    const response = await axios_1.default.post(url, {
        from,
        to,
        amount: amountNanos.toString()
    }, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; TonArbTerminal/1.0)',
            'Content-Type': 'application/json'
        },
        timeout: 5000
    });
    if (Array.isArray(response.data) && response.data[0] && response.data[0][0]) {
        const plan = response.data[0][0];
        return BigInt(plan.amountOut);
    }
    throw new Error(`DeDust query failed: ${JSON.stringify(response.data)}`);
}
async function simulateDualDexArbitrage(options) {
    const results = [];
    for (const amountTon of options.amounts) {
        let leg1DeDustUsdt = 0;
        let leg2StonfiTon = 0;
        let leg1StonfiUsdt = 0;
        let leg2DeDustTon = 0;
        if (options.mock) {
            const mockEntry = exports.MOCK_SIMULATOR_DATA[amountTon] || {
                stonfiUsdt: amountTon * 1.3777,
                dedustUsdt: amountTon * 1.5757,
                stonfiTonBack: amountTon * 1.137,
                dedustTonBack: amountTon * 0.872
            };
            leg1DeDustUsdt = mockEntry.dedustUsdt;
            leg2StonfiTon = mockEntry.stonfiTonBack;
            leg1StonfiUsdt = mockEntry.stonfiUsdt;
            leg2DeDustTon = mockEntry.dedustTonBack;
        }
        else {
            try {
                const amountNanos = BigInt(Math.round(amountTon * 1e9));
                // Path A Leg 1: DeDust TON -> USDT
                const leg1DeDustNanos = await queryDeDust('native', USDT_JETTON_DEDUST, amountNanos);
                leg1DeDustUsdt = Number(leg1DeDustNanos) / 1e6;
                // Path A Leg 2: STON.fi USDT -> TON
                const leg2StonfiNanos = await queryStonfi(USDT_JETTON_STONFI, NATIVE_TON_STONFI, leg1DeDustNanos, options.slippage);
                leg2StonfiTon = Number(leg2StonfiNanos) / 1e9;
                // Path B Leg 1: STON.fi TON -> USDT
                const leg1StonfiNanos = await queryStonfi(NATIVE_TON_STONFI, USDT_JETTON_STONFI, amountNanos, options.slippage);
                leg1StonfiUsdt = Number(leg1StonfiNanos) / 1e6;
                // Path B Leg 2: DeDust USDT -> TON
                const leg2DeDustNanos = await queryDeDust(USDT_JETTON_DEDUST, 'native', leg1StonfiNanos);
                leg2DeDustTon = Number(leg2DeDustNanos) / 1e9;
            }
            catch (err) {
                console.warn(`[WARN] Network query for ${amountTon} TON failed (${err.message}). Falling back to mock data.`);
                const mockEntry = exports.MOCK_SIMULATOR_DATA[amountTon] || exports.MOCK_SIMULATOR_DATA[10];
                leg1DeDustUsdt = mockEntry.dedustUsdt;
                leg2StonfiTon = mockEntry.stonfiTonBack;
                leg1StonfiUsdt = mockEntry.stonfiUsdt;
                leg2DeDustTon = mockEntry.dedustTonBack;
            }
        }
        const pathAGrossProfit = leg2StonfiTon - amountTon;
        const pathAGrossRoiPct = (pathAGrossProfit / amountTon) * 100;
        const pathANetProfit = pathAGrossProfit - ESTIMATED_GAS_TON;
        const pathANetRoiPct = (pathANetProfit / amountTon) * 100;
        const pathBGrossProfit = leg2DeDustTon - amountTon;
        const pathBGrossRoiPct = (pathBGrossProfit / amountTon) * 100;
        const pathBNetProfit = pathBGrossProfit - ESTIMATED_GAS_TON;
        const pathBNetRoiPct = (pathBNetProfit / amountTon) * 100;
        results.push({
            amountTon,
            stonfiQuoteUsdt: leg1StonfiUsdt,
            dedustQuoteUsdt: leg1DeDustUsdt,
            pathA: {
                description: 'DeDust TON->USDT -> STON.fi USDT->TON',
                leg1DeDustTonToUsdt: leg1DeDustUsdt,
                leg2StonfiUsdtToTon: leg2StonfiTon,
                grossProfitTon: pathAGrossProfit,
                grossRoiPct: pathAGrossRoiPct,
                netProfitTon: pathANetProfit,
                netRoiPct: pathANetRoiPct
            },
            pathB: {
                description: 'STON.fi TON->USDT -> DeDust USDT->TON',
                leg1StonfiTonToUsdt: leg1StonfiUsdt,
                leg2DeDustUsdtToTon: leg2DeDustTon,
                grossProfitTon: pathBGrossProfit,
                grossRoiPct: pathBGrossRoiPct,
                netProfitTon: pathBNetProfit,
                netRoiPct: pathBNetRoiPct
            }
        });
    }
    return results;
}
async function main() {
    const args = process.argv.slice(2);
    let amounts = [1, 10, 100];
    let slippage = 0.005;
    let mock = false;
    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--amounts' && args[i + 1]) {
            amounts = args[++i].split(',').map(s => parseFloat(s.trim()));
        }
        if (args[i] === '--slippage' && args[i + 1]) {
            slippage = parseFloat(args[++i]);
        }
        if (args[i] === '--mock')
            mock = true;
    }
    console.log(`=== Dual-DEX Matched Quote & Arbitrage Simulator ===`);
    console.log(`Amounts: ${amounts.join(', ')} TON | Slippage: ${slippage * 100}% | Mode: ${mock ? 'MOCK' : 'LIVE (with mock fallback)'}`);
    const results = await simulateDualDexArbitrage({ amounts, slippage, mock });
    for (const res of results) {
        console.log(`\n--- Size: ${res.amountTon} TON ---`);
        console.log(`1 TON Quote: STON.fi = ${(res.stonfiQuoteUsdt / res.amountTon).toFixed(4)} USDT | DeDust = ${(res.dedustQuoteUsdt / res.amountTon).toFixed(4)} USDT`);
        console.log(`Path A (${res.pathA.description}):`);
        console.log(`  Leg 1 (DeDust): ${res.pathA.leg1DeDustTonToUsdt.toFixed(4)} USDT`);
        console.log(`  Leg 2 (STON.fi): ${res.pathA.leg2StonfiUsdtToTon.toFixed(6)} TON`);
        console.log(`  Gross P&L: ${res.pathA.grossProfitTon > 0 ? '+' : ''}${res.pathA.grossProfitTon.toFixed(6)} TON (${res.pathA.grossRoiPct.toFixed(3)}%)`);
        console.log(`  Net P&L (est 0.25 gas): ${res.pathA.netProfitTon > 0 ? '+' : ''}${res.pathA.netProfitTon.toFixed(6)} TON (${res.pathA.netRoiPct.toFixed(3)}%)`);
        console.log(`Path B (${res.pathB.description}):`);
        console.log(`  Leg 1 (STON.fi): ${res.pathB.leg1StonfiTonToUsdt.toFixed(4)} USDT`);
        console.log(`  Leg 2 (DeDust): ${res.pathB.leg2DeDustUsdtToTon.toFixed(6)} TON`);
        console.log(`  Gross P&L: ${res.pathB.grossProfitTon > 0 ? '+' : ''}${res.pathB.grossProfitTon.toFixed(6)} TON (${res.pathB.grossRoiPct.toFixed(3)}%)`);
        console.log(`  Net P&L (est 0.25 gas): ${res.pathB.netProfitTon > 0 ? '+' : ''}${res.pathB.netProfitTon.toFixed(6)} TON (${res.pathB.netRoiPct.toFixed(3)}%)`);
    }
}
if (require.main === module) {
    main().catch(err => {
        console.error(`Fatal error in dual_dex_simulator:`, err);
        process.exit(1);
    });
}
