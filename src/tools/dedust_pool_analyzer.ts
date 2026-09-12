import axios from 'axios';

export interface PoolAnalyzerOptions {
  pool: string;
  limit: number;
  mock: boolean;
  apiKey?: string;
}

export interface TradeSummary {
  utime: number;
  lt: string;
  hash: string;
  type: 'TON->USDT' | 'USDT->TON' | 'UNKNOWN';
  tonAmountNanos: bigint;
  usdtAmountUnits: bigint;
  impliedPriceUsdtPerTon: number | null;
  success: boolean;
}

export interface AnalysisReport {
  poolAddress: string;
  totalTransactionsParsed: number;
  swapTradesCount: number;
  tonToUsdtCount: number;
  usdtToTonCount: number;
  averageImpliedPrice: number | null;
  priceTrend: 'UPWARD' | 'DOWNWARD' | 'FLAT' | 'INSUFFICIENT_DATA';
  recentTrades: TradeSummary[];
}

export const MOCK_POOL_TRANSACTIONS = [
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

export async function analyzeDeDustPool(options: PoolAnalyzerOptions): Promise<AnalysisReport> {
  let rawTxs: any[] = [];

  if (options.mock) {
    rawTxs = MOCK_POOL_TRANSACTIONS;
  } else {
    try {
      const url = `https://toncenter.com/api/v2/getTransactions?address=${options.pool}&limit=${options.limit}&archival=true`;
      const headers: Record<string, string> = {};
      if (options.apiKey) {
        headers['X-API-Key'] = options.apiKey;
      }
      const response = await axios.get(url, { headers, timeout: 5000 });
      if (response.data && response.data.ok) {
        rawTxs = response.data.result;
      } else {
        throw new Error(`Toncenter API returned error: ${JSON.stringify(response.data)}`);
      }
    } catch (err: any) {
      // Fallback to mock if network fails or mock requested
      console.warn(`[WARN] Network request failed (${err.message}). Falling back to mock data.`);
      rawTxs = MOCK_POOL_TRANSACTIONS;
    }
  }

  const trades: TradeSummary[] = [];
  let tonToUsdtCount = 0;
  let usdtToTonCount = 0;
  let totalPriceSum = 0;

  for (const tx of rawTxs) {
    const inMsg = tx.in_msg || {};
    const outMsgs = tx.out_msgs || [];

    const inValue = BigInt(inMsg.value || '0');
    let outValueSum = BigInt(0);
    let usdtAmount = BigInt(0);

    for (const out of outMsgs) {
      const val = BigInt(out.value || '0');
      outValueSum += val;
      // Heuristic for USDT jetton units vs TON nanos
      if (out.message && out.message.toLowerCase().includes('usdt')) {
        usdtAmount += val;
      }
    }

    let tradeType: 'TON->USDT' | 'USDT->TON' | 'UNKNOWN' = 'UNKNOWN';
    let tonAmount = BigInt(0);
    let usdtUnits = BigInt(0);

    if (inMsg.message && inMsg.message.toLowerCase().includes('ton to usdt')) {
      tradeType = 'TON->USDT';
      tonAmount = inValue;
      usdtUnits = usdtAmount > 0n ? usdtAmount : BigInt(outMsgs[0]?.value || '0');
      tonToUsdtCount++;
    } else if (inMsg.message && inMsg.message.toLowerCase().includes('usdt')) {
      tradeType = 'USDT->TON';
      usdtUnits = inValue;
      tonAmount = outValueSum;
      usdtToTonCount++;
    } else if (inValue > 0n && outValueSum > 0n) {
      // General heuristic: if inValue > 1e6 and outValue > 1e6
      if (inValue > 1_000_000_000n && outValueSum < 1_000_000_000n) {
        tradeType = 'TON->USDT';
        tonAmount = inValue;
        usdtUnits = outValueSum;
        tonToUsdtCount++;
      } else if (inValue < 1_000_000_000n && outValueSum > 1_000_000_000n) {
        tradeType = 'USDT->TON';
        usdtUnits = inValue;
        tonAmount = outValueSum;
        usdtToTonCount++;
      }
    }

    let impliedPrice: number | null = null;
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

  let priceTrend: 'UPWARD' | 'DOWNWARD' | 'FLAT' | 'INSUFFICIENT_DATA' = 'INSUFFICIENT_DATA';
  if (swapTrades.length >= 2) {
    const firstPrice = swapTrades[swapTrades.length - 1].impliedPriceUsdtPerTon!;
    const lastPrice = swapTrades[0].impliedPriceUsdtPerTon!;
    const diffPct = ((lastPrice - firstPrice) / firstPrice) * 100;
    if (diffPct > 0.5) priceTrend = 'UPWARD';
    else if (diffPct < -0.5) priceTrend = 'DOWNWARD';
    else priceTrend = 'FLAT';
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
  let apiKey: string | undefined = undefined;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--pool' && args[i + 1]) pool = args[++i];
    if (args[i] === '--limit' && args[i + 1]) limit = parseInt(args[++i], 10);
    if (args[i] === '--mock') mock = true;
    if (args[i] === '--api-key' && args[i + 1]) apiKey = args[++i];
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
