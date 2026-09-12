import axios from 'axios';
import { performance } from 'perf_hooks';

export interface BenchmarkerOptions {
  samples: number;
  delayMs: number;
  mock: boolean;
}

export interface LatencyStats {
  samples: number;
  p50: number;
  p90: number;
  p95: number;
  p99: number;
  min: number;
  max: number;
  mean: number;
  stdDev: number;
  stalenessAlerts: number;
}

export interface BenchmarkReport {
  stonfi: LatencyStats;
  dedust: LatencyStats;
}

export const MOCK_LATENCIES = {
  stonfi: [250, 270, 310, 290, 410, 800, 260, 280, 300, 320, 275, 295, 315, 305, 285, 265, 330, 340, 290, 280, 270, 310, 325, 350, 290, 270, 280, 300, 310, 1120],
  dedust: [180, 210, 190, 220, 650, 200, 195, 205, 215, 225, 185, 195, 205, 210, 200, 190, 230, 240, 205, 195, 185, 215, 220, 250, 200, 190, 200, 210, 220, 850]
};

function calculateStats(latencies: number[]): LatencyStats {
  const sorted = [...latencies].sort((a, b) => a - b);
  const n = sorted.length;

  const getPercentile = (pct: number) => {
    const idx = Math.ceil((pct / 100) * n) - 1;
    return sorted[Math.max(0, Math.min(n - 1, idx))];
  };

  const min = sorted[0];
  const max = sorted[n - 1];
  const mean = sorted.reduce((sum, v) => sum + v, 0) / n;

  const variance = sorted.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / n;
  const stdDev = Math.sqrt(variance);
  const stalenessAlerts = sorted.filter(v => v > 1000).length;

  return {
    samples: n,
    p50: getPercentile(50),
    p90: getPercentile(90),
    p95: getPercentile(95),
    p99: getPercentile(99),
    min,
    max,
    mean,
    stdDev,
    stalenessAlerts
  };
}

export async function benchmarkLatency(options: BenchmarkerOptions): Promise<BenchmarkReport> {
  const stonfiLatencies: number[] = [];
  const dedustLatencies: number[] = [];

  if (options.mock) {
    stonfiLatencies.push(...MOCK_LATENCIES.stonfi.slice(0, options.samples));
    dedustLatencies.push(...MOCK_LATENCIES.dedust.slice(0, options.samples));
  } else {
    const stonfiUrl = `https://api.ston.fi/v1/swap/simulate?offer_address=EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c&ask_address=EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs&units=1000000000&slippage_tolerance=0.005`;
    const dedustUrl = `https://api.dedust.io/v2/routing/plan`;
    const dedustPayload = {
      from: 'native',
      to: 'jetton:0:b113a994b5024a16719f69139328eb759596c38a25f59028b146fecdc3621dfe',
      amount: '1000000000'
    };
    const headers = { 'User-Agent': 'Mozilla/5.0 (compatible; TonArbTerminal/1.0)' };

    for (let i = 0; i < options.samples; i++) {
      // Benchmark STON.fi
      try {
        const t0 = performance.now();
        await axios.post(stonfiUrl, {}, { headers, timeout: 5000 });
        const t1 = performance.now();
        stonfiLatencies.push(t1 - t0);
      } catch (err) {
        stonfiLatencies.push(1500); // Penalty for timeout/failure
      }

      // Benchmark DeDust
      try {
        const t0 = performance.now();
        await axios.post(dedustUrl, dedustPayload, { headers: { ...headers, 'Content-Type': 'application/json' }, timeout: 5000 });
        const t1 = performance.now();
        dedustLatencies.push(t1 - t0);
      } catch (err) {
        dedustLatencies.push(1500);
      }

      if (options.delayMs > 0 && i < options.samples - 1) {
        await new Promise(resolve => setTimeout(resolve, options.delayMs));
      }
    }
  }

  return {
    stonfi: calculateStats(stonfiLatencies),
    dedust: calculateStats(dedustLatencies)
  };
}

async function main() {
  const args = process.argv.slice(2);
  let samples = 30;
  let delayMs = 200;
  let mock = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--samples' && args[i + 1]) samples = parseInt(args[++i], 10);
    if (args[i] === '--delay-ms' && args[i + 1]) delayMs = parseInt(args[++i], 10);
    if (args[i] === '--mock') mock = true;
  }

  console.log(`=== DEX API Latency & Jitter Benchmarker ===`);
  console.log(`Samples: ${samples} | Delay: ${delayMs}ms | Mode: ${mock ? 'MOCK' : 'LIVE (with mock fallback)'}`);

  const report = await benchmarkLatency({ samples, delayMs, mock });

  console.log(`\n--- STON.fi Latency Statistics ---`);
  console.log(`Samples: ${report.stonfi.samples}`);
  console.log(`Min: ${report.stonfi.min.toFixed(2)}ms | Mean: ${report.stonfi.mean.toFixed(2)}ms | Max: ${report.stonfi.max.toFixed(2)}ms | StdDev: ${report.stonfi.stdDev.toFixed(2)}ms`);
  console.log(`p50: ${report.stonfi.p50.toFixed(2)}ms | p90: ${report.stonfi.p90.toFixed(2)}ms | p95: ${report.stonfi.p95.toFixed(2)}ms | p99: ${report.stonfi.p99.toFixed(2)}ms`);
  console.log(`Staleness Alerts (>1000ms): ${report.stonfi.stalenessAlerts}`);

  console.log(`\n--- DeDust Latency Statistics ---`);
  console.log(`Samples: ${report.dedust.samples}`);
  console.log(`Min: ${report.dedust.min.toFixed(2)}ms | Mean: ${report.dedust.mean.toFixed(2)}ms | Max: ${report.dedust.max.toFixed(2)}ms | StdDev: ${report.dedust.stdDev.toFixed(2)}ms`);
  console.log(`p50: ${report.dedust.p50.toFixed(2)}ms | p90: ${report.dedust.p90.toFixed(2)}ms | p95: ${report.dedust.p95.toFixed(2)}ms | p99: ${report.dedust.p99.toFixed(2)}ms`);
  console.log(`Staleness Alerts (>1000ms): ${report.dedust.stalenessAlerts}`);
}

if (require.main === module) {
  main().catch(err => {
    console.error(`Fatal error in latency_benchmarker:`, err);
    process.exit(1);
  });
}
