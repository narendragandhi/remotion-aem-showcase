/**
 * Telemetry & Observability Module
 *
 * Provides render metrics, error tracking, and performance monitoring
 * for the Remotion AEM Showcase.
 *
 * Supports multiple backends:
 * - Console (default, development)
 * - Adobe Analytics (production)
 * - Custom webhook (CI/CD integration)
 */

export interface RenderMetrics {
  compositionId: string;
  width: number;
  height: number;
  durationFrames: number;
  fps: number;
  startTime: number;
  endTime?: number;
  renderTimeMs?: number;
  sceneCount: number;
  effectsUsed: string[];
  wasmEnabled: boolean;
  status: "started" | "completed" | "failed";
  errorMessage?: string;
  errorStack?: string;
}

export interface AemFetchMetrics {
  endpoint: string;
  contentFragmentPath: string;
  startTime: number;
  endTime?: number;
  latencyMs?: number;
  status: "success" | "fallback" | "error";
  usedMock: boolean;
  sceneCount?: number;
  errorMessage?: string;
}

export interface TelemetryConfig {
  enabled: boolean;
  backend: "console" | "webhook" | "custom";
  webhookUrl?: string;
  sampleRate?: number; // 0-1, percentage of events to send
  includeStackTraces?: boolean;
  customHandler?: (event: TelemetryEvent) => void | Promise<void>;
}

export type TelemetryEvent =
  | { type: "render"; data: RenderMetrics }
  | { type: "aem_fetch"; data: AemFetchMetrics }
  | { type: "error"; data: ErrorEvent }
  | { type: "performance"; data: PerformanceEvent };

export interface ErrorEvent {
  errorType: string;
  errorMessage: string;
  errorStack?: string;
  context: Record<string, unknown>;
  timestamp: number;
  recoverable: boolean;
  recovered: boolean;
}

export interface PerformanceEvent {
  metric: string;
  value: number;
  unit: "ms" | "bytes" | "count" | "percent";
  context: Record<string, unknown>;
  timestamp: number;
}

// Singleton configuration
let config: TelemetryConfig = {
  enabled: process.env.TELEMETRY_ENABLED === "true",
  backend: (process.env.TELEMETRY_BACKEND as TelemetryConfig["backend"]) || "console",
  webhookUrl: process.env.TELEMETRY_WEBHOOK_URL,
  sampleRate: parseFloat(process.env.TELEMETRY_SAMPLE_RATE || "1"),
  includeStackTraces: process.env.TELEMETRY_INCLUDE_STACKS !== "false",
};

// Event buffer for batching
const eventBuffer: TelemetryEvent[] = [];
const BUFFER_FLUSH_INTERVAL = 5000; // 5 seconds
const BUFFER_MAX_SIZE = 50;

let flushTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Configure telemetry settings
 */
export const configureTelemetry = (newConfig: Partial<TelemetryConfig>): void => {
  config = { ...config, ...newConfig };

  if (config.enabled && !flushTimer) {
    flushTimer = setInterval(flushEvents, BUFFER_FLUSH_INTERVAL);
  } else if (!config.enabled && flushTimer) {
    clearInterval(flushTimer);
    flushTimer = null;
  }
};

/**
 * Check if event should be sampled
 */
const shouldSample = (): boolean => {
  return Math.random() < (config.sampleRate ?? 1);
};

/**
 * Send event to configured backend
 */
const sendEvent = async (event: TelemetryEvent): Promise<void> => {
  if (!config.enabled || !shouldSample()) return;

  switch (config.backend) {
    case "console":
      console.log(`[Telemetry] ${event.type}:`, JSON.stringify(event.data, null, 2));
      break;

    case "webhook":
      if (config.webhookUrl) {
        try {
          await fetch(config.webhookUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(event),
          });
        } catch (error) {
          console.warn("[Telemetry] Webhook delivery failed:", error);
        }
      }
      break;

    case "custom":
      if (config.customHandler) {
        await config.customHandler(event);
      }
      break;
  }
};

/**
 * Buffer event for batch sending
 */
const bufferEvent = (event: TelemetryEvent): void => {
  eventBuffer.push(event);

  if (eventBuffer.length >= BUFFER_MAX_SIZE) {
    flushEvents();
  }
};

/**
 * Flush buffered events
 */
const flushEvents = async (): Promise<void> => {
  if (eventBuffer.length === 0) return;

  const events = [...eventBuffer];
  eventBuffer.length = 0;

  for (const event of events) {
    await sendEvent(event);
  }
};

// ============================================================================
// Public API
// ============================================================================

/**
 * Track render start
 */
export const trackRenderStart = (metrics: Omit<RenderMetrics, "status" | "startTime">): RenderMetrics => {
  const fullMetrics: RenderMetrics = {
    ...metrics,
    startTime: Date.now(),
    status: "started",
  };

  bufferEvent({ type: "render", data: fullMetrics });
  return fullMetrics;
};

/**
 * Track render completion
 */
export const trackRenderComplete = (metrics: RenderMetrics): void => {
  const endTime = Date.now();
  const updatedMetrics: RenderMetrics = {
    ...metrics,
    endTime,
    renderTimeMs: endTime - metrics.startTime,
    status: "completed",
  };

  bufferEvent({ type: "render", data: updatedMetrics });
};

/**
 * Track render failure
 */
export const trackRenderError = (metrics: RenderMetrics, error: Error): void => {
  const endTime = Date.now();
  const updatedMetrics: RenderMetrics = {
    ...metrics,
    endTime,
    renderTimeMs: endTime - metrics.startTime,
    status: "failed",
    errorMessage: error.message,
    errorStack: config.includeStackTraces ? error.stack : undefined,
  };

  bufferEvent({ type: "render", data: updatedMetrics });
};

/**
 * Track AEM fetch operation
 */
export const trackAemFetch = (
  endpoint: string,
  contentFragmentPath: string,
  usedMock: boolean
): { complete: (sceneCount: number) => void; error: (message: string) => void } => {
  const startTime = Date.now();

  return {
    complete: (sceneCount: number) => {
      const metrics: AemFetchMetrics = {
        endpoint,
        contentFragmentPath,
        startTime,
        endTime: Date.now(),
        latencyMs: Date.now() - startTime,
        status: usedMock ? "fallback" : "success",
        usedMock,
        sceneCount,
      };
      bufferEvent({ type: "aem_fetch", data: metrics });
    },
    error: (message: string) => {
      const metrics: AemFetchMetrics = {
        endpoint,
        contentFragmentPath,
        startTime,
        endTime: Date.now(),
        latencyMs: Date.now() - startTime,
        status: "error",
        usedMock,
        errorMessage: message,
      };
      bufferEvent({ type: "aem_fetch", data: metrics });
    },
  };
};

/**
 * Track custom error
 */
export const trackError = (
  errorType: string,
  error: Error,
  context: Record<string, unknown> = {},
  recoverable = true,
  recovered = false
): void => {
  const event: ErrorEvent = {
    errorType,
    errorMessage: error.message,
    errorStack: config.includeStackTraces ? error.stack : undefined,
    context,
    timestamp: Date.now(),
    recoverable,
    recovered,
  };

  bufferEvent({ type: "error", data: event });
};

/**
 * Track performance metric
 */
export const trackPerformance = (
  metric: string,
  value: number,
  unit: PerformanceEvent["unit"],
  context: Record<string, unknown> = {}
): void => {
  const event: PerformanceEvent = {
    metric,
    value,
    unit,
    context,
    timestamp: Date.now(),
  };

  bufferEvent({ type: "performance", data: event });
};

/**
 * Create a performance timer
 */
export const createTimer = (
  metricName: string,
  context: Record<string, unknown> = {}
): { stop: () => number } => {
  const startTime = performance.now();

  return {
    stop: () => {
      const duration = performance.now() - startTime;
      trackPerformance(metricName, duration, "ms", context);
      return duration;
    },
  };
};

/**
 * Flush all pending events (call before process exit)
 */
export const flushTelemetry = async (): Promise<void> => {
  await flushEvents();
};

/**
 * Get telemetry status
 */
export const getTelemetryStatus = (): {
  enabled: boolean;
  backend: string;
  bufferedEvents: number;
} => ({
  enabled: config.enabled,
  backend: config.backend,
  bufferedEvents: eventBuffer.length,
});
