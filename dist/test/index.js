"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = __importDefault(require("assert"));
const dedust_pool_analyzer_1 = require("../src/tools/dedust_pool_analyzer");
const dual_dex_simulator_1 = require("../src/tools/dual_dex_simulator");
const executor_verifier_1 = require("../src/tools/executor_verifier");
const latency_benchmarker_1 = require("../src/tools/latency_benchmarker");
const preflight_safety_gate_1 = require("../src/tools/preflight_safety_gate");
async function runAllTests() {
    console.log(`====================================================`);
    console.log(` Running Offline Test Suite for RESEARCH_16 Tools`);
    console.log(`====================================================\n`);
    let passedCount = 0;
    let failedCount = 0;
    async function test(name, fn) {
        try {
            await fn();
            console.log(`[PASS] ${name}`);
            passedCount++;
        }
        catch (err) {
            console.error(`[FAIL] ${name}: ${err.message}`);
            failedCount++;
        }
    }
    // Test 1: DeDust Pool Analyzer Mock Mode
    await test('dedust_pool_analyzer: offline mock parsing and trend analysis', async () => {
        const report = await (0, dedust_pool_analyzer_1.analyzeDeDustPool)({
            pool: 'EQA-X_yo3fzzbDbJ_0bzFWKqtRuZFIRa1sJsveZJ1YpViO3r',
            limit: 50,
            mock: true
        });
        assert_1.default.strictEqual(report.totalTransactionsParsed, 3, 'Should parse 3 mock transactions');
        assert_1.default.strictEqual(report.swapTradesCount, 3, 'Should identify 3 swap trades');
        assert_1.default.strictEqual(report.tonToUsdtCount, 2, 'Should count 2 TON->USDT swaps');
        assert_1.default.strictEqual(report.usdtToTonCount, 1, 'Should count 1 USDT->TON swap');
        (0, assert_1.default)(report.averageImpliedPrice !== null && report.averageImpliedPrice > 1.5, 'Implied price should be > 1.5');
    });
    // Test 2: Dual-DEX Simulator Mock Mode
    await test('dual_dex_simulator: offline mock quote simulation across 1, 10, 100 TON', async () => {
        const results = await (0, dual_dex_simulator_1.simulateDualDexArbitrage)({
            amounts: [1, 10, 100],
            slippage: 0.005,
            mock: true
        });
        assert_1.default.strictEqual(results.length, 3, 'Should return 3 quote results');
        // 10 TON check. Mock data was recalibrated in RESEARCH_25 from the debunked ~14%
        // DeDust-legacy-tier spread to the corrected ~1.345-1.347 consensus (RESEARCH_23 §0,
        // RESEARCH_24 §0/§2), so both paths now show small negative gross P&L (fee-driven
        // noise between two near-parity venues), not a one-sided ~13.7% "opportunity."
        const res10 = results[1];
        assert_1.default.strictEqual(res10.amountTon, 10);
        (0, assert_1.default)(Math.abs(res10.pathA.grossProfitTon) < 0.1, 'Path A gross P&L should be small (near-parity venues)');
        (0, assert_1.default)(res10.pathA.grossProfitTon < 0, 'Path A should show negative profit');
        (0, assert_1.default)(res10.pathB.grossProfitTon < 0, 'Path B should show negative profit');
    });
    // Test 3: Executor Verifier Mock Mode & TVM Logic
    await test('executor_verifier: offline storage parsing & 419-bit exact match', async () => {
        const res = await (0, executor_verifier_1.verifyExecutorContract)({
            address: 'EQBo5HJbBWZlOVuBpOPSiRNu18eHgq8XmoTbwdBlZpKflg3s',
            mock: true
        });
        assert_1.default.strictEqual(res.enabled, true, 'Executor must be enabled=true');
        assert_1.default.strictEqual(res.minSpreadBps, 200, 'min_spread_bps must be 200');
        assert_1.default.strictEqual(res.maxTradeNanos, 50000000000n, 'max_trade_nanos must be 50 TON');
        assert_1.default.strictEqual(res.gasReserveNanos, 500000000n, 'gas_reserve_nanos must be 0.5 TON');
        assert_1.default.strictEqual(res.totalBitsParsed, 419, 'Storage slice must consume exactly 419 bits');
        assert_1.default.strictEqual(res.sandboxMatch, true, 'Sandbox emulator verification must pass');
    });
    // Test 4: Latency Benchmarker Mock Mode
    await test('latency_benchmarker: offline percentile statistical calculations', async () => {
        const report = await (0, latency_benchmarker_1.benchmarkLatency)({
            samples: 30,
            delayMs: 0,
            mock: true
        });
        assert_1.default.strictEqual(report.stonfi.samples, 30, 'STON.fi samples count must be 30');
        assert_1.default.strictEqual(report.dedust.samples, 30, 'DeDust samples count must be 30');
        (0, assert_1.default)(report.stonfi.p50 > 0 && report.stonfi.p95 > 0, 'Percentiles must be positive');
        assert_1.default.strictEqual(report.stonfi.stalenessAlerts, 1, 'Mock STON.fi data has 1 latency > 1000ms');
    });
    // Test 5: Preflight Safety Gate Invariant Evaluation
    await test('preflight_safety_gate: invariant check matrix (VALID, EXCESSIVE_SPREAD, HIGH_IMPACT, MAX_TRADE, UNAUDITED_EXECUTOR)', async () => {
        const validRes = (0, preflight_safety_gate_1.runPreflightSafetyGate)({ mockCase: 'VALID' });
        assert_1.default.strictEqual(validRes.status, 'PASS', 'Valid case should PASS');
        const excessiveRes = (0, preflight_safety_gate_1.runPreflightSafetyGate)({ mockCase: 'EXCESSIVE_SPREAD' });
        assert_1.default.strictEqual(excessiveRes.status, 'FAIL', 'Excessive spread (>20%) should FAIL');
        const highImpactRes = (0, preflight_safety_gate_1.runPreflightSafetyGate)({ mockCase: 'HIGH_PRICE_IMPACT' });
        assert_1.default.strictEqual(highImpactRes.status, 'FAIL', 'High price impact should FAIL');
        const maxTradeRes = (0, preflight_safety_gate_1.runPreflightSafetyGate)({ mockCase: 'EXCEEDS_MAX_TRADE' });
        assert_1.default.strictEqual(maxTradeRes.status, 'FAIL', 'Trade size exceeding max cap should FAIL');
        const unauditedRes = (0, preflight_safety_gate_1.runPreflightSafetyGate)({ mockCase: 'UNAUDITED_EXECUTOR' });
        assert_1.default.strictEqual(unauditedRes.status, 'FAIL', 'Targeting unaudited executor should FAIL');
    });
    console.log(`\n----------------------------------------------------`);
    console.log(` Summary: ${passedCount} PASSED, ${failedCount} FAILED out of ${passedCount + failedCount} tests.`);
    console.log(`----------------------------------------------------\n`);
    if (failedCount > 0) {
        process.exit(1);
    }
}
runAllTests().catch(err => {
    console.error(`Test runner encountered fatal error:`, err);
    process.exit(1);
});
