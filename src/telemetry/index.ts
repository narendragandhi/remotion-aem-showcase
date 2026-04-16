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
  backend: "console" | "webhook" | "adobe-analytics" | "custom";
  webhookUrl?: string;
  adobeAnalyticsRsid?: string;
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
  adobeAnalyticsRsid: process.env.ADOBE_ANALYTICS_RSID,
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

    case "adobe-analytics":
      await sendToAdobeAnalytics(event, config.adobeAnalyticsRsid);
      break;

    case "custom":
      if (config.customHandler) {
        await config.customHandler(event);
      }
      break;
  }
};

/**
 * Maps a TelemetryEvent to Adobe Analytics Data Insertion API payload fields.
 * Uses eVar/event numbering conventions; adjust to match your report suite config.
 */
const buildAdobeAnalyticsPayload = (
  event: TelemetryEvent,
  rsid: string
): Record<string, unknown> => {
  const base = {
    reportSuiteID: rsid,
    timestamp: Math.floor(Date.now() / 1000),
    userAgent: "remotion-aem-showcase/0.2.0",
    pageName: "remotion-render",
    channel: "video-render",
  };

  switch (event.type) {
    case "render": {
      const d = event.data;
      return {
        ...base,
        pageName: `remotion-render:${d.compositionId}`,
        events: d.status === "completed" ? "event1" : d.status === "failed" ? "event2" : "",
        eVar1: d.compositionId,
        eVar2: `${d.width}x${d.height}`,
        eVar3: d.status,
        prop1: String(d.sceneCount),
        prop2: d.effectsUsed.join(","),
        prop3: d.wasmEnabled ? "wasm" : "js-fallback",
        ...(d.renderTimeMs ? { eVar4: String(Math.round(d.renderTimeMs)) } : {}),
      };
    }
    case "aem_fetch": {
      const d = event.data;
      return {
        ...base,
        pageName: "remotion-render:aem-fetch",
        events: d.status === "success" ? "event3" : d.status === "fallback" ? "event4" : "event5",
        eVar5: d.status,
        eVar6: d.usedMock ? "mock" : "live",
        prop4: String(d.latencyMs ?? 0),
      };
    }
    case "error": {
      const d = event.data;
      return {
        ...base,
        pageName: "remotion-render:error",
        events: "event6",
        eVar7: d.errorType,
        eVar8: d.recoverable ? "recoverable" : "fatal",
        prop5: d.errorMessage.slice(0, 100),
      };
    }
    case "performance": {
      const d = event.data;
      return {
        ...base,
        pageName: `remotion-render:perf:${d.metric}`,
        events: "event7",
        eVar9: d.metric,
        prop6: String(d.value),
        prop7: d.unit,
      };
    }
  }
};

/**
 * Send event to Adobe Analytics via the Data Insertion API.
 * Docs: https://developer.adobe.com/analytics-apis/docs/2.0/guides/endpoints/data-insertion/
 *
 * This is a server-side REST API — no browser SDK or _satellite required.
 * Requires ADOBE_ANALYTICS_RSID to be set.
 */
const sendToAdobeAnalytics = async (
  event: TelemetryEvent,
  rsid: string | undefined
): Promise<void> => {
  if (!rsid) {
    console.warn("[Telemetry] adobe-analytics backend requires ADOBE_ANALYTICS_RSID");
    return;
  }

  const endpoint = `https://${rsid}.sc.omtrdc.net/b/ss/${rsid}/6/JSON`;
  const payload = buildAdobeAnalyticsPayload(event, rsid);

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      console.warn(`[Telemetry] Adobe Analytics returned ${res.status}`);
    }
  } catch (err) {
    console.warn("[Telemetry] Adobe Analytics delivery failed:", err);
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
