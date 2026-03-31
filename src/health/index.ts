/**
 * Health Check & Monitoring Module
 *
 * Provides health checks for AEM connectivity, WASM availability,
 * and system readiness for video rendering.
 */

import { getAemConfig, fetchAemSpotlight } from "../aem/aemClient";
import { warmupSpotlightWasm, isWasmAvailable } from "../wasm/spotlightEffects";
import { getTelemetryStatus, trackPerformance } from "../telemetry";

export interface HealthStatus {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  version: string;
  checks: {
    aem: ComponentHealth;
    wasm: ComponentHealth;
    telemetry: ComponentHealth;
    system: ComponentHealth;
  };
  details?: Record<string, unknown>;
}

export interface ComponentHealth {
  status: "up" | "down" | "degraded";
  latencyMs?: number;
  message?: string;
  lastChecked: string;
}

const VERSION = process.env.npm_package_version || "0.2.0";

/**
 * Check AEM GraphQL endpoint health
 */
export const checkAemHealth = async (): Promise<ComponentHealth> => {
  const startTime = Date.now();
  const config = getAemConfig();

  try {
    if (config.useMock || !config.baseUrl) {
      return {
        status: "up",
        latencyMs: Date.now() - startTime,
        message: "Using mock data (AEM not configured)",
        lastChecked: new Date().toISOString(),
      };
    }

    // Attempt to fetch content
    await fetchAemSpotlight({ ...config, strictMode: true });

    const latency = Date.now() - startTime;
    trackPerformance("health_check_aem", latency, "ms", { status: "success" });

    return {
      status: "up",
      latencyMs: latency,
      message: `Connected to ${config.baseUrl}`,
      lastChecked: new Date().toISOString(),
    };
  } catch (error) {
    const latency = Date.now() - startTime;
    const message = error instanceof Error ? error.message : String(error);

    trackPerformance("health_check_aem", latency, "ms", { status: "error", error: message });

    // Degraded if fallback is available, unhealthy if strict mode
    return {
      status: config.strictMode ? "down" : "degraded",
      latencyMs: latency,
      message: `AEM error: ${message}`,
      lastChecked: new Date().toISOString(),
    };
  }
};

/**
 * Check WASM module health
 */
export const checkWasmHealth = async (): Promise<ComponentHealth> => {
  const startTime = Date.now();

  try {
    await warmupSpotlightWasm();
    const available = isWasmAvailable();
    const latency = Date.now() - startTime;

    trackPerformance("health_check_wasm", latency, "ms", { available });

    return {
      status: available ? "up" : "degraded",
      latencyMs: latency,
      message: available ? "WASM loaded successfully" : "WASM unavailable, using JS fallback",
      lastChecked: new Date().toISOString(),
    };
  } catch (error) {
    const latency = Date.now() - startTime;
    const message = error instanceof Error ? error.message : String(error);

    return {
      status: "degraded", // WASM is optional, JS fallback exists
      latencyMs: latency,
      message: `WASM error (using JS fallback): ${message}`,
      lastChecked: new Date().toISOString(),
    };
  }
};

/**
 * Check telemetry system health
 */
export const checkTelemetryHealth = (): ComponentHealth => {
  const status = getTelemetryStatus();

  return {
    status: "up",
    message: status.enabled
      ? `Telemetry enabled (${status.backend}), ${status.bufferedEvents} events buffered`
      : "Telemetry disabled",
    lastChecked: new Date().toISOString(),
  };
};

/**
 * Check system resources
 */
export const checkSystemHealth = (): ComponentHealth => {
  try {
    const memUsage = process.memoryUsage();
    const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
    const heapTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024);
    const heapPercentage = Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100);

    // Consider degraded if heap usage > 80%
    const status = heapPercentage > 90 ? "down" : heapPercentage > 80 ? "degraded" : "up";

    return {
      status,
      message: `Heap: ${heapUsedMB}MB / ${heapTotalMB}MB (${heapPercentage}%)`,
      lastChecked: new Date().toISOString(),
    };
  } catch {
    return {
      status: "up",
      message: "System metrics unavailable",
      lastChecked: new Date().toISOString(),
    };
  }
};

/**
 * Run all health checks
 */
export const runHealthChecks = async (): Promise<HealthStatus> => {
  const [aem, wasm] = await Promise.all([checkAemHealth(), checkWasmHealth()]);

  const telemetry = checkTelemetryHealth();
  const system = checkSystemHealth();

  const checks = { aem, wasm, telemetry, system };

  // Determine overall status
  const statuses = Object.values(checks).map((c) => c.status);
  let overallStatus: HealthStatus["status"] = "healthy";

  if (statuses.includes("down")) {
    overallStatus = "unhealthy";
  } else if (statuses.includes("degraded")) {
    overallStatus = "degraded";
  }

  return {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    version: VERSION,
    checks,
    details: {
      nodeVersion: process.version,
      platform: process.platform,
      uptime: process.uptime(),
    },
  };
};

/**
 * Simple liveness check (fast, for k8s probes)
 */
export const livenessCheck = (): { alive: boolean; timestamp: string } => ({
  alive: true,
  timestamp: new Date().toISOString(),
});

/**
 * Readiness check (can we serve requests?)
 */
export const readinessCheck = async (): Promise<{
  ready: boolean;
  timestamp: string;
  reason?: string;
}> => {
  try {
    const aemHealth = await checkAemHealth();

    // Ready if AEM is up or degraded (has fallback)
    const ready = aemHealth.status !== "down";

    return {
      ready,
      timestamp: new Date().toISOString(),
      reason: ready ? undefined : aemHealth.message,
    };
  } catch (error) {
    return {
      ready: false,
      timestamp: new Date().toISOString(),
      reason: error instanceof Error ? error.message : "Unknown error",
    };
  }
};

/**
 * Format health status for CLI output
 */
export const formatHealthStatus = (status: HealthStatus): string => {
  const lines: string[] = [
    `Health Status: ${status.status.toUpperCase()}`,
    `Version: ${status.version}`,
    `Timestamp: ${status.timestamp}`,
    "",
    "Component Checks:",
  ];

  for (const [name, check] of Object.entries(status.checks)) {
    const icon = check.status === "up" ? "✓" : check.status === "degraded" ? "⚠" : "✗";
    const latency = check.latencyMs ? ` (${check.latencyMs}ms)` : "";
    lines.push(`  ${icon} ${name}: ${check.status}${latency}`);
    if (check.message) {
      lines.push(`    ${check.message}`);
    }
  }

  return lines.join("\n");
};
