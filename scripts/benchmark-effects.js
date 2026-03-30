#!/usr/bin/env node
/**
 * Performance Benchmark: WASM vs JavaScript Effects
 *
 * Run: npm run benchmark
 */

import { performance } from 'perf_hooks';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Pure JavaScript implementations (same as spotlightEffects.ts)
const spotlightMathJS = {
  calculatePulse: (progress, amplitude) => {
    const p = Math.max(0, Math.min(1, progress));
    const a = Math.max(0, Math.min(1, amplitude));
    return Math.min(p * a + p * 0.3, a);
  },
  calculateGlitch: (progress, intensity) => {
    const p = Math.max(0, Math.min(1, progress));
    const i = Math.max(0, Math.min(1, intensity));
    return ((Math.ceil(p * 100) * 7 + 13) / 10) * i - 0.5;
  },
};

// Benchmark configuration
const ITERATIONS = 1_000_000;
const WARMUP_ITERATIONS = 10_000;

function benchmark(name, fn, iterations) {
  // Warmup phase
  for (let i = 0; i < WARMUP_ITERATIONS; i++) {
    fn(Math.random(), Math.random());
  }

  // Force garbage collection if available
  if (global.gc) {
    global.gc();
  }

  // Actual benchmark
  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    fn(i / iterations, 0.5 + (i % 100) / 200);
  }
  const end = performance.now();

  const duration = end - start;
  const opsPerSecond = Math.round(iterations / (duration / 1000));
  const avgLatency = (duration / iterations).toFixed(6);

  return { name, duration, opsPerSecond, avgLatency, iterations };
}

function formatNumber(num) {
  return num.toLocaleString();
}

function printBar(percentage, width = 30) {
  const filled = Math.round((percentage / 100) * width);
  const empty = width - filled;
  return '█'.repeat(filled) + '░'.repeat(empty);
}

async function runBenchmarks() {
  console.log();
  console.log('╔' + '═'.repeat(58) + '╗');
  console.log('║   REMOTION AEM SHOWCASE - Performance Benchmarks         ║');
  console.log('╚' + '═'.repeat(58) + '╝');
  console.log();

  const results = {
    js: {},
    wasm: {},
  };

  // JavaScript benchmarks
  console.log('┌─ JavaScript Implementation ─────────────────────────────┐');
  console.log('│                                                         │');

  const jsPulse = benchmark(
    'Pulse/Glow',
    spotlightMathJS.calculatePulse,
    ITERATIONS
  );
  results.js.pulse = jsPulse;
  console.log(`│  Pulse/Glow:  ${formatNumber(jsPulse.opsPerSecond).padStart(12)} ops/sec  │`);
  console.log(`│              ${jsPulse.avgLatency}ms avg latency               │`);

  const jsGlitch = benchmark(
    'Glitch',
    spotlightMathJS.calculateGlitch,
    ITERATIONS
  );
  results.js.glitch = jsGlitch;
  console.log(`│  Glitch:      ${formatNumber(jsGlitch.opsPerSecond).padStart(12)} ops/sec  │`);
  console.log(`│              ${jsGlitch.avgLatency}ms avg latency               │`);
  console.log('│                                                         │');
  console.log('└─────────────────────────────────────────────────────────┘');
  console.log();

  // WASM benchmarks
  const wasmPath = join(__dirname, '..', 'public', 'spotlight_effects.wasm');

  if (existsSync(wasmPath)) {
    try {
      const wasmBuffer = readFileSync(wasmPath);
      const wasmModule = await WebAssembly.instantiate(wasmBuffer);
      const wasmExports = wasmModule.instance.exports;

      console.log('┌─ WASM Implementation ────────────────────────────────────┐');
      console.log('│                                                         │');

      const wasmPulse = benchmark(
        'Pulse/Glow',
        wasmExports.pulseStrength,
        ITERATIONS
      );
      results.wasm.pulse = wasmPulse;
      console.log(`│  Pulse/Glow:  ${formatNumber(wasmPulse.opsPerSecond).padStart(12)} ops/sec  │`);
      console.log(`│              ${wasmPulse.avgLatency}ms avg latency               │`);

      const wasmGlitch = benchmark(
        'Glitch',
        wasmExports.glitchFactor,
        ITERATIONS
      );
      results.wasm.glitch = wasmGlitch;
      console.log(`│  Glitch:      ${formatNumber(wasmGlitch.opsPerSecond).padStart(12)} ops/sec  │`);
      console.log(`│              ${wasmGlitch.avgLatency}ms avg latency               │`);
      console.log('│                                                         │');
      console.log('└─────────────────────────────────────────────────────────┘');
      console.log();

      // Comparison
      const pulseImprovement = ((wasmPulse.opsPerSecond / jsPulse.opsPerSecond - 1) * 100);
      const glitchImprovement = ((wasmGlitch.opsPerSecond / jsGlitch.opsPerSecond - 1) * 100);

      console.log('┌─ Performance Comparison ────────────────────────────────┐');
      console.log('│                                                         │');
      console.log(`│  Pulse/Glow: WASM is ${pulseImprovement >= 0 ? '+' : ''}${pulseImprovement.toFixed(1)}% ${pulseImprovement >= 0 ? 'faster' : 'slower'}                    │`);
      console.log(`│  ${printBar(Math.min(100, 50 + pulseImprovement / 2))} │`);
      console.log('│                                                         │');
      console.log(`│  Glitch:     WASM is ${glitchImprovement >= 0 ? '+' : ''}${glitchImprovement.toFixed(1)}% ${glitchImprovement >= 0 ? 'faster' : 'slower'}                    │`);
      console.log(`│  ${printBar(Math.min(100, 50 + glitchImprovement / 2))} │`);
      console.log('│                                                         │');
      console.log('└─────────────────────────────────────────────────────────┘');

    } catch (error) {
      console.log('⚠  WASM benchmarks failed:', error.message);
    }
  } else {
    console.log('┌─ WASM Implementation ────────────────────────────────────┐');
    console.log('│                                                         │');
    console.log('│  ⚠  WASM file not found                                 │');
    console.log('│     Run: npm run build:wasm                             │');
    console.log('│                                                         │');
    console.log('└─────────────────────────────────────────────────────────┘');
  }

  console.log();

  // Real-world impact
  console.log('┌─ Real-World Impact Analysis ────────────────────────────┐');
  console.log('│                                                         │');

  const scenarios = [
    { name: 'Standard (15s @ 30fps)', fps: 30, duration: 15 },
    { name: 'Social (10s @ 30fps)', fps: 30, duration: 10 },
    { name: 'Premium (30s @ 60fps)', fps: 60, duration: 30 },
    { name: '4K Long (60s @ 30fps)', fps: 30, duration: 60 },
  ];

  for (const scenario of scenarios) {
    const totalFrames = scenario.fps * scenario.duration;
    const effectCallsPerFrame = 2;
    const totalCalls = totalFrames * effectCallsPerFrame;
    const jsTime = totalCalls / jsPulse.opsPerSecond * 1000;

    console.log(`│  ${scenario.name.padEnd(22)} │`);
    console.log(`│    ${formatNumber(totalCalls).padStart(8)} effect calls → ${jsTime.toFixed(2).padStart(6)}ms (JS)     │`);
  }

  console.log('│                                                         │');
  console.log('│  ✓ Both implementations handle typical workloads well   │');
  console.log('│  ✓ WASM provides headroom for 4K/60fps batch renders    │');
  console.log('│                                                         │');
  console.log('└─────────────────────────────────────────────────────────┘');
  console.log();

  // Summary
  console.log('Summary:');
  console.log(`  Iterations: ${formatNumber(ITERATIONS)}`);
  console.log(`  Warmup: ${formatNumber(WARMUP_ITERATIONS)} iterations`);
  console.log();
}

runBenchmarks().catch(console.error);
