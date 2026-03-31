#!/usr/bin/env node

/**
 * Health Check CLI Script
 *
 * Usage:
 *   node scripts/health-check.js         # Full health check
 *   node scripts/health-check.js --live  # Liveness probe only
 *   node scripts/health-check.js --ready # Readiness probe only
 *   node scripts/health-check.js --json  # JSON output
 */

import("../src/health/index.ts")
  .catch(() => {
    // Fallback for non-ts-node environments
    console.error("TypeScript support required. Run with: npx tsx scripts/health-check.js");
    process.exit(1);
  })
  .then(async (health) => {
    const args = process.argv.slice(2);
    const jsonOutput = args.includes("--json");

    try {
      if (args.includes("--live")) {
        const result = health.livenessCheck();
        if (jsonOutput) {
          console.log(JSON.stringify(result, null, 2));
        } else {
          console.log(result.alive ? "ALIVE" : "DEAD");
        }
        process.exit(result.alive ? 0 : 1);
      }

      if (args.includes("--ready")) {
        const result = await health.readinessCheck();
        if (jsonOutput) {
          console.log(JSON.stringify(result, null, 2));
        } else {
          console.log(result.ready ? "READY" : `NOT READY: ${result.reason}`);
        }
        process.exit(result.ready ? 0 : 1);
      }

      // Full health check
      const status = await health.runHealthChecks();

      if (jsonOutput) {
        console.log(JSON.stringify(status, null, 2));
      } else {
        console.log(health.formatHealthStatus(status));
      }

      // Exit code based on status
      const exitCode =
        status.status === "healthy" ? 0 : status.status === "degraded" ? 0 : 1;
      process.exit(exitCode);
    } catch (error) {
      console.error("Health check failed:", error);
      process.exit(1);
    }
  });
