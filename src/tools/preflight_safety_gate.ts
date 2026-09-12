import fs from 'fs';

export interface SafetyGateOptions {
  inputPath?: string;
  mockCase?: 'VALID' | 'EXCESSIVE_SPREAD' | 'HIGH_PRICE_IMPACT' | 'EXCEEDS_MAX_TRADE' | 'UNAUDITED_EXECUTOR';
  maxTradeSizeTon?: number;
  minSpreadBps?: number;
  maxSpreadBps?: number;
  maxPriceImpactPct?: number;
}

export interface SafetyCheckResult {
  status: 'PASS' | 'FAIL';
  reasons: string[];
  warnings: string[];
  metrics: {
    spreadBps: number;
    leg1PriceImpactPct: number;
    leg2PriceImpactPct: number;
    tradeSizeTon: number;
    customExecutorTargeted: boolean;
    executorAudited: boolean;
  };
}

export const MOCK_SAFETY_TEST_CASES = {
  VALID: {
    trade_size_ton: 10,
    spread_bps: 300,
    leg1_price_impact: 0.001,
    leg2_price_impact: 0.001,
    target_executor: false,
    executor_audited: false
  },
  EXCESSIVE_SPREAD: {
    trade_size_ton: 10,
    spread_bps: 2500, // 25% > max 20% limit
    leg1_price_impact: 0.001,
    leg2_price_impact: 0.001,
    target_executor: false,
    executor_audited: false
  },
  HIGH_PRICE_IMPACT: {
    trade_size_ton: 10,
    spread_bps: 300,
    leg1_price_impact: 0.015, // 1.5% > max 0.5% limit
    leg2_price_impact: 0.001,
    target_executor: false,
    executor_audited: false
  },
  EXCEEDS_MAX_TRADE: {
    trade_size_ton: 100, // 100 TON > max 50 TON limit
    spread_bps: 300,
    leg1_price_impact: 0.001,
    leg2_price_impact: 0.001,
    target_executor: false,
    executor_audited: false
  },
  UNAUDITED_EXECUTOR: {
    trade_size_ton: 10,
    spread_bps: 300,
    leg1_price_impact: 0.001,
    leg2_price_impact: 0.001,
    target_executor: true,
    executor_audited: false // Unaudited executor targeted!
  }
};

export function evaluateSafetyGate(data: any, options: SafetyGateOptions = {}): SafetyCheckResult {
  const maxTradeCap = options.maxTradeSizeTon ?? 50;
  const minSpread = options.minSpreadBps ?? 150; // 1.5%
  const maxSpread = options.maxSpreadBps ?? 2000; // 20.0%
  const maxPriceImpact = options.maxPriceImpactPct ?? 0.005; // 0.5%

  const tradeSize = data.trade_size_ton ?? data.amountTon ?? 0;
  const spreadBps = data.spread_bps ?? Math.round((data.pathA?.netRoiPct ?? 0) * 100);
  const leg1Impact = data.leg1_price_impact ?? 0.0001;
  const leg2Impact = data.leg2_price_impact ?? 0.0001;
  const targetExecutor = data.target_executor ?? false;
  const executorAudited = data.executor_audited ?? false;

  const reasons: string[] = [];
  const warnings: string[] = [];

  // Invariant 1: Spread Sanity Check
  if (spreadBps > maxSpread) {
    reasons.push(`Spread of ${spreadBps} bps (${(spreadBps / 100).toFixed(2)}%) exceeds maximum sanity threshold of ${maxSpread} bps (${(maxSpread / 100).toFixed(2)}%). High risk of stale quote / corrupted pool.`);
  } else if (spreadBps < minSpread) {
    reasons.push(`Spread of ${spreadBps} bps (${(spreadBps / 100).toFixed(2)}%) is below minimum profitable threshold of ${minSpread} bps.`);
  }

  // Invariant 2: Price Impact Check
  if (leg1Impact > maxPriceImpact) {
    reasons.push(`Leg 1 price impact (${(leg1Impact * 100).toFixed(3)}%) exceeds maximum tolerance threshold (${(maxPriceImpact * 100).toFixed(2)}%).`);
  }
  if (leg2Impact > maxPriceImpact) {
    reasons.push(`Leg 2 price impact (${(leg2Impact * 100).toFixed(3)}%) exceeds maximum tolerance threshold (${(maxPriceImpact * 100).toFixed(2)}%).`);
  }

  // Invariant 3: Maximum Trade Size Check
  if (tradeSize > maxTradeCap) {
    reasons.push(`Trade size of ${tradeSize} TON exceeds maximum safe cap of ${maxTradeCap} TON.`);
  }

  // Invariant 4: Custom Executor Audit Verification
  if (targetExecutor && !executorAudited) {
    reasons.push(`Targeting custom executor contract 'EQBo5HJbBWZlOVuBpOPSiRNu18eHgq8XmoTbwdBlZpKflg3s' which is enabled=true but UNAUDITED. Must use client-side sequential execution instead.`);
  }

  if (targetExecutor) {
    warnings.push(`Notice: Custom executor contract is owner-gated. Ensure caller is authorized owner.`);
  }

  const status = reasons.length === 0 ? 'PASS' : 'FAIL';

  return {
    status,
    reasons,
    warnings,
    metrics: {
      spreadBps,
      leg1PriceImpactPct: leg1Impact * 100,
      leg2PriceImpactPct: leg2Impact * 100,
      tradeSizeTon: tradeSize,
      customExecutorTargeted: targetExecutor,
      executorAudited
    }
  };
}

export function runPreflightSafetyGate(options: SafetyGateOptions): SafetyCheckResult {
  let data: any = null;

  if (options.inputPath && fs.existsSync(options.inputPath)) {
    const content = fs.readFileSync(options.inputPath, 'utf-8');
    data = JSON.parse(content);
  } else {
    const mockCase = options.mockCase ?? 'VALID';
    data = MOCK_SAFETY_TEST_CASES[mockCase];
  }

  return evaluateSafetyGate(data, options);
}

async function main() {
  const args = process.argv.slice(2);
  let inputPath: string | undefined = undefined;
  let mockCase: 'VALID' | 'EXCESSIVE_SPREAD' | 'HIGH_PRICE_IMPACT' | 'EXCEEDS_MAX_TRADE' | 'UNAUDITED_EXECUTOR' = 'VALID';

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--input' && args[i + 1]) inputPath = args[++i];
    if (args[i] === '--mock-case' && args[i + 1]) {
      mockCase = args[++i] as any;
    }
  }

  console.log(`=== Client-Side Pre-Flight Safety Gate ===`);
  console.log(`Source: ${inputPath ? inputPath : 'Mock Case [' + mockCase + ']'}`);

  const res = runPreflightSafetyGate({ inputPath, mockCase });

  console.log(`\nSTATUS: ${res.status}`);
  console.log(`Metrics:`);
  console.log(`  Trade Size: ${res.metrics.tradeSizeTon} TON`);
  console.log(`  Spread: ${res.metrics.spreadBps} bps`);
  console.log(`  Leg 1 Price Impact: ${res.metrics.leg1PriceImpactPct.toFixed(3)}%`);
  console.log(`  Leg 2 Price Impact: ${res.metrics.leg2PriceImpactPct.toFixed(3)}%`);
  console.log(`  Custom Executor Targeted: ${res.metrics.customExecutorTargeted} (Audited: ${res.metrics.executorAudited})`);

  if (res.warnings.length > 0) {
    console.log(`\nWarnings:`);
    res.warnings.forEach(w => console.log(`  [WARNING] ${w}`));
  }

  if (res.reasons.length > 0) {
    console.log(`\nRejection Reasons:`);
    res.reasons.forEach(r => console.log(`  [REJECT] ${r}`));
  }

  if (res.status === 'FAIL') {
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(err => {
    console.error(`Fatal error in preflight_safety_gate:`, err);
    process.exit(1);
  });
}
