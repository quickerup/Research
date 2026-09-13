"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MOCK_POOL_TRANSACTIONS = void 0;
exports.analyzeDeDustPool = analyzeDeDustPool;
const axios_1 = __importDefault(require("axios"));
const core_1 = require("@ton/core");
exports.MOCK_POOL_TRANSACTIONS = [
    {
        utime: 1726182000,
        transaction_id: { lt: "102923871000001", hash: "abc123hash01" },
        fee: "10000000",
        in_msg: {
            source: "EQC_USER1",
            value: "10000000000",
            message: "DeDust Swap TON to USDT"
        },
        out_msgs: [
            {
                destination: "EQC_USER1",
                value: "15750000",
                message: "Transfer 15.75 USDT"
            }
        ]
    },
    {
        utime: 1726182300,
        transaction_id: { lt: "102923871000002", hash: "abc123hash02" },
        fee: "10000000",
        in_msg: {
            source: "EQC_USER2",
            value: "50000000000",
            message: "DeDust Swap TON to USDT"
        },
        out_msgs: [
            {
                destination: "EQC_USER2",
                value: "78750000",
                message: "Transfer 78.75 USDT"
            }
        ]
    },
    {
        utime: 1726182600,
        transaction_id: { lt: "102923871000003", hash: "abc123hash03" },
        fee: "10000000",
        in_msg: {
            source: "EQC_USER3",
            value: "157400000",
            message: "Transfer 157.4 USDT to DeDust Pool"
        },
        out_msgs: [
            {
                destination: "EQC_USER3",
                value: "100000000000",
                message: "DeDust Payout 100 TON"
            }
        ]
    }
];
const TON_VAULT_ADDR = 'EQDa4VOnTYlLvDJ0gZjNYm5PXfSmmtL6Vs6A_CZEtXCNICq_';
const USDT_VAULT_ADDR = 'EQAYqo4u7VF0fa4DPAebk4g9lBytj2VFny7pzXR0trjtXQaO';
async function analyzeDeDustPool(options) {
    let rawTxs = [];
    if (options.mock) {
        rawTxs = exports.MOCK_POOL_TRANSACTIONS;
    }
    else {
        try {
            const url = `https://toncenter.com/api/v2/getTransactions?address=${options.pool}&limit=${options.limit}&archival=true`;
            const headers = {};
            if (options.apiKey) {
                headers['X-API-Key'] = options.apiKey;
            }
            const response = await axios_1.default.get(url, { headers, timeout: 15000 });
            if (response.data && response.data.ok) {
                rawTxs = response.data.result;
            }
            else {
                throw new Error(`Toncenter API returned error: ${JSON.stringify(response.data)}`);
            }
        }
        catch (err) {
            // Fallback to mock if network fails or mock requested
            console.warn(`[WARN] Network request failed (${err.message}). Falling back to mock data.`);
            rawTxs = exports.MOCK_POOL_TRANSACTIONS;
        }
    }
    const trades = [];
    let tonToUsdtCount = 0;
    let usdtToTonCount = 0;
    let totalPriceSum = 0;
    for (const tx of rawTxs) {
        const inMsg = tx.in_msg || {};
        const outMsgs = tx.out_msgs || [];
        let tradeType = 'UNKNOWN';
        let tonAmount = BigInt(0);
        let usdtUnits = BigInt(0);
        let decodedViaOpcode = false;
        // Try cell/opcode parsing for real DeDust transactions
        if (inMsg.msg_data && inMsg.msg_data.body) {
            try {
                const cell = core_1.Cell.fromBase64(inMsg.msg_data.body);
                const s = cell.beginParse();
                if (s.remainingBits >= 32) {
                    const op = s.loadUint(32);
                    if (op === 0x61ee542d) { // DeDust Pool.SWAP
                        const queryId = s.loadUintBig(64);
                        const amount0 = s.loadCoins();
                        let srcAddressStr = '';
                        try {
                            srcAddressStr = core_1.Address.parse(inMsg.source).toString();
                        }
                        catch (e) {
                            srcAddressStr = inMsg.source || '';
                        }
                        const tonVaultParsed = core_1.Address.parse(TON_VAULT_ADDR).toString();
                        const usdtVaultParsed = core_1.Address.parse(USDT_VAULT_ADDR).toString();
                        if (srcAddressStr === tonVaultParsed) {
                            tradeType = 'TON->USDT';
                            tonAmount = amount0;
                            tonToUsdtCount++;
                            decodedViaOpcode = true;
                            // Extract payout USDT units from 0xad4eb6f5 out_msg to USDT_VAULT
                            for (const out of outMsgs) {
                                if (out.msg_data && out.msg_data.body) {
                                    try {
                                        let destStr = '';
                                        try {
                                            destStr = core_1.Address.parse(out.destination).toString();
                                        }
                                        catch (e) {
                                            destStr = out.destination || '';
                                        }
                                        if (destStr === usdtVaultParsed) {
                                            const outCell = core_1.Cell.fromBase64(out.msg_data.body);
                                            const os = outCell.beginParse();
                                            if (os.remainingBits >= 32 && os.loadUint(32) === 0xad4eb6f5) {
                                                os.loadUintBig(64); // queryId
                                                usdtUnits = os.loadCoins();
                                                break;
                                            }
                                        }
                                    }
                                    catch (e) { }
                                }
                            }
                        }
                        else if (srcAddressStr === usdtVaultParsed) {
                            tradeType = 'USDT->TON';
                            usdtUnits = amount0;
                            usdtToTonCount++;
                            decodedViaOpcode = true;
                            // Extract payout TON nanos from 0xad4eb6f5 out_msg to TON_VAULT
                            for (const out of outMsgs) {
                                if (out.msg_data && out.msg_data.body) {
                                    try {
                                        let destStr = '';
                                        try {
                                            destStr = core_1.Address.parse(out.destination).toString();
                                        }
                                        catch (e) {
                                            destStr = out.destination || '';
                                        }
                                        if (destStr === tonVaultParsed) {
                                            const outCell = core_1.Cell.fromBase64(out.msg_data.body);
                                            const os = outCell.beginParse();
                                            if (os.remainingBits >= 32 && os.loadUint(32) === 0xad4eb6f5) {
                                                os.loadUintBig(64); // queryId
                                                tonAmount = os.loadCoins();
                                                break;
                                            }
                                        }
                                    }
                                    catch (e) { }
                                }
                            }
                        }
                    }
                }
            }
            catch (e) {
                // Fall back to text/heuristic matching
            }
        }
        if (!decodedViaOpcode) {
            const inValue = BigInt(inMsg.value || '0');
            let outValueSum = BigInt(0);
            let usdtAmount = BigInt(0);
            for (const out of outMsgs) {
                const val = BigInt(out.value || '0');
                outValueSum += val;
                if (out.message && out.message.toLowerCase().includes('usdt')) {
                    usdtAmount += val;
                }
            }
            if (inMsg.message && inMsg.message.toLowerCase().includes('ton to usdt')) {
                tradeType = 'TON->USDT';
                tonAmount = inValue;
                usdtUnits = usdtAmount > 0n ? usdtAmount : BigInt(outMsgs[0]?.value || '0');
                tonToUsdtCount++;
            }
            else if (inMsg.message && inMsg.message.toLowerCase().includes('usdt')) {
                tradeType = 'USDT->TON';
                usdtUnits = inValue;
                tonAmount = outValueSum;
                usdtToTonCount++;
            }
            else if (inValue > 0n && outValueSum > 0n) {
                if (inValue > 1000000000n && outValueSum < 1000000000n) {
                    tradeType = 'TON->USDT';
                    tonAmount = inValue;
                    usdtUnits = outValueSum;
                    tonToUsdtCount++;
                }
                else if (inValue < 1000000000n && outValueSum > 1000000000n) {
                    tradeType = 'USDT->TON';
                    usdtUnits = inValue;
                    tonAmount = outValueSum;
                    usdtToTonCount++;
                }
            }
        }
        let impliedPrice = null;
        if (tonAmount > 0n && usdtUnits > 0n) {
            const tonFloat = Number(tonAmount) / 1e9;
            const usdtFloat = Number(usdtUnits) / 1e6;
            impliedPrice = usdtFloat / tonFloat;
            totalPriceSum += impliedPrice;
        }
        trades.push({
            utime: tx.utime || 0,
            lt: tx.transaction_id?.lt || '0',
            hash: tx.transaction_id?.hash || '',
            type: tradeType,
            tonAmountNanos: tonAmount,
            usdtAmountUnits: usdtUnits,
            impliedPriceUsdtPerTon: impliedPrice,
            success: true
        });
    }
    const swapTrades = trades.filter(t => t.impliedPriceUsdtPerTon !== null);
    const avgPrice = swapTrades.length > 0 ? totalPriceSum / swapTrades.length : null;
    let priceTrend = 'INSUFFICIENT_DATA';
    if (swapTrades.length >= 2) {
        const firstPrice = swapTrades[swapTrades.length - 1].impliedPriceUsdtPerTon;
        const lastPrice = swapTrades[0].impliedPriceUsdtPerTon;
        const diffPct = ((lastPrice - firstPrice) / firstPrice) * 100;
        if (diffPct > 0.5)
            priceTrend = 'UPWARD';
        else if (diffPct < -0.5)
            priceTrend = 'DOWNWARD';
        else
            priceTrend = 'FLAT';
    }
    return {
        poolAddress: options.pool,
        totalTransactionsParsed: rawTxs.length,
        swapTradesCount: swapTrades.length,
        tonToUsdtCount,
        usdtToTonCount,
        averageImpliedPrice: avgPrice,
        priceTrend,
        recentTrades: trades
    };
}
async function main() {
    const args = process.argv.slice(2);
    let pool = 'EQA-X_yo3fzzbDbJ_0bzFWKqtRuZFIRa1sJsveZJ1YpViO3r';
    let limit = 50;
    let mock = false;
    let apiKey = undefined;
    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--pool' && args[i + 1])
            pool = args[++i];
        if (args[i] === '--limit' && args[i + 1])
            limit = parseInt(args[++i], 10);
        if (args[i] === '--mock')
            mock = true;
        if (args[i] === '--api-key' && args[i + 1])
            apiKey = args[++i];
    }
    console.log(`=== DeDust Pool Analyzer ===`);
    console.log(`Target Pool: ${pool}`);
    console.log(`Mode: ${mock ? 'MOCK' : 'LIVE (with mock fallback)'}`);
    const report = await analyzeDeDustPool({ pool, limit, mock, apiKey });
    console.log(`\nParsed Transactions: ${report.totalTransactionsParsed}`);
    console.log(`Identified Swaps: ${report.swapTradesCount} (TON->USDT: ${report.tonToUsdtCount}, USDT->TON: ${report.usdtToTonCount})`);
    console.log(`Average Implied Price: ${report.averageImpliedPrice ? report.averageImpliedPrice.toFixed(4) + ' USDT/TON' : 'N/A'}`);
    console.log(`Price Trend: ${report.priceTrend}`);
    console.log(`\nRecent Trades Summary:`);
    console.table(report.recentTrades.map(t => ({
        lt: t.lt,
        type: t.type,
        ton: (Number(t.tonAmountNanos) / 1e9).toFixed(2),
        usdt: (Number(t.usdtAmountUnits) / 1e6).toFixed(2),
        impliedPrice: t.impliedPriceUsdtPerTon ? t.impliedPriceUsdtPerTon.toFixed(4) : 'N/A'
    })));
}
if (require.main === module) {
    main().catch(err => {
        console.error(`Fatal error in dedust_pool_analyzer:`, err);
        process.exit(1);
    });
}
