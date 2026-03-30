# Monitoring & Observability Guide

This guide covers telemetry, error tracking, and performance monitoring for the Remotion AEM Showcase in production environments.

## Table of Contents

1. [Quick Start](#quick-start)
2. [Telemetry Configuration](#telemetry-configuration)
3. [Metrics Reference](#metrics-reference)
4. [Error Tracking](#error-tracking)
5. [Integration Examples](#integration-examples)
6. [Alerting](#alerting)

---

## Quick Start

### Enable Telemetry

```bash
# .env
TELEMETRY_ENABLED=true
TELEMETRY_BACKEND=console  # console | webhook | adobe-analytics | custom
```

### Basic Usage

```typescript
import {
  trackRenderStart,
  trackRenderComplete,
  trackError,
  createTimer,
} from './telemetry';

// Track a render operation
const metrics = trackRenderStart({
  compositionId: 'AEMSpotlight-16x9',
  width: 1280,
  height: 720,
  durationFrames: 450,
  fps: 30,
  sceneCount: 3,
  effectsUsed: ['glow', 'glitch'],
  wasmEnabled: true,
});

try {
  await renderVideo();
  trackRenderComplete(metrics);
} catch (error) {
  trackRenderError(metrics, error);
}

// Track performance
const timer = createTimer('aem_graphql_query');
await fetchFromAEM();
timer.stop(); // Automatically records duration
```

---

## Telemetry Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `TELEMETRY_ENABLED` | Enable/disable telemetry | `false` |
| `TELEMETRY_BACKEND` | Output destination | `console` |
| `TELEMETRY_WEBHOOK_URL` | Webhook endpoint URL | - |
| `TELEMETRY_SAMPLE_RATE` | Sampling rate (0-1) | `1` |
| `TELEMETRY_INCLUDE_STACKS` | Include stack traces | `true` |
| `ADOBE_ANALYTICS_RSID` | Adobe Analytics Report Suite ID | - |

### Programmatic Configuration

```typescript
import { configureTelemetry } from './telemetry';

configureTelemetry({
  enabled: true,
  backend: 'webhook',
  webhookUrl: 'https://your-metrics-endpoint.com/ingest',
  sampleRate: 0.5, // Sample 50% of events
  includeStackTraces: false, // Reduce payload size
});
```

### Custom Handler

```typescript
import { configureTelemetry, TelemetryEvent } from './telemetry';

configureTelemetry({
  enabled: true,
  backend: 'custom',
  customHandler: async (event: TelemetryEvent) => {
    // Send to your custom backend
    await myMetricsService.record(event);

    // Or log to specific service
    if (event.type === 'error') {
      await sentryClient.captureException(event.data);
    }
  },
});
```

---

## Metrics Reference

### Render Metrics

Captured for every video render operation.

```typescript
interface RenderMetrics {
  compositionId: string;     // e.g., "AEMSpotlight-16x9"
  width: number;             // 1280
  height: number;            // 720
  durationFrames: number;    // 450
  fps: number;               // 30
  startTime: number;         // Unix timestamp
  endTime: number;           // Unix timestamp
  renderTimeMs: number;      // Total render duration
  sceneCount: number;        // Number of scenes
  effectsUsed: string[];     // ["glow", "glitch"]
  wasmEnabled: boolean;      // WASM module loaded
  status: "started" | "completed" | "failed";
  errorMessage?: string;     // On failure
}
```

### AEM Fetch Metrics

Captured for every AEM GraphQL request.

```typescript
interface AemFetchMetrics {
  endpoint: string;           // GraphQL endpoint URL
  contentFragmentPath: string; // CF path requested
  startTime: number;
  endTime: number;
  latencyMs: number;          // Request duration
  status: "success" | "fallback" | "error";
  usedMock: boolean;          // Fell back to mock data
  sceneCount: number;         // Scenes in response
  errorMessage?: string;
}
```

### Performance Events

Custom performance measurements.

```typescript
interface PerformanceEvent {
  metric: string;             // Metric name
  value: number;              // Measured value
  unit: "ms" | "bytes" | "count" | "percent";
  context: Record<string, unknown>;
  timestamp: number;
}
```

### Error Events

Captured for all tracked errors.

```typescript
interface ErrorEvent {
  errorType: string;          // Error class name
  errorMessage: string;
  errorStack?: string;        // If enabled
  context: Record<string, unknown>;
  timestamp: number;
  recoverable: boolean;       // Can recover from error
  recovered: boolean;         // Did recover successfully
}
```

---

## Error Tracking

### Automatic Error Capture

Errors thrown within compositions are automatically captured:

```typescript
import { trackError } from './telemetry';

try {
  await riskyOperation();
} catch (error) {
  trackError(
    'AssetLoadError',
    error,
    { assetUrl: imageUrl, compositionId },
    true,  // recoverable
    true   // recovered (using fallback)
  );
}
```

### Error Categories

| Error Type | Recoverable | Action |
|------------|-------------|--------|
| `AemFetchError` | Yes | Falls back to mock data |
| `AemValidationError` | Yes | Uses partial data + defaults |
| `WasmLoadError` | Yes | Falls back to JavaScript |
| `AssetLoadError` | Yes | Shows placeholder |
| `ConfigurationError` | No | Fails render |

### Integration with Error Services

#### Sentry

```typescript
import * as Sentry from '@sentry/node';
import { configureTelemetry } from './telemetry';

Sentry.init({ dsn: process.env.SENTRY_DSN });

configureTelemetry({
  enabled: true,
  backend: 'custom',
  customHandler: async (event) => {
    if (event.type === 'error') {
      Sentry.captureMessage(event.data.errorMessage, {
        level: event.data.recoverable ? 'warning' : 'error',
        extra: event.data.context,
      });
    }
  },
});
```

#### Datadog

```typescript
import { datadogLogs } from '@datadog/browser-logs';
import { configureTelemetry } from './telemetry';

datadogLogs.init({
  clientToken: process.env.DD_CLIENT_TOKEN,
  site: 'datadoghq.com',
  service: 'remotion-aem-showcase',
});

configureTelemetry({
  enabled: true,
  backend: 'custom',
  customHandler: async (event) => {
    datadogLogs.logger.info(event.type, event.data);
  },
});
```

---

## Integration Examples

### Adobe Analytics

```typescript
// Enable Adobe Analytics backend
TELEMETRY_BACKEND=adobe-analytics
ADOBE_ANALYTICS_RSID=your-report-suite-id

// Events are sent via Adobe Launch (_satellite.track)
// or Data Insertion API for server-side rendering
```

### Webhook (Generic)

```bash
# Configure webhook endpoint
TELEMETRY_BACKEND=webhook
TELEMETRY_WEBHOOK_URL=https://your-endpoint.com/metrics

# Payload format:
# POST /metrics
# Content-Type: application/json
# {
#   "type": "render",
#   "data": { ...RenderMetrics }
# }
```

### CloudWatch (AWS)

```typescript
import { CloudWatch } from '@aws-sdk/client-cloudwatch';
import { configureTelemetry } from './telemetry';

const cloudwatch = new CloudWatch({ region: 'us-east-1' });

configureTelemetry({
  enabled: true,
  backend: 'custom',
  customHandler: async (event) => {
    if (event.type === 'render' && event.data.status === 'completed') {
      await cloudwatch.putMetricData({
        Namespace: 'RemotionAEM',
        MetricData: [
          {
            MetricName: 'RenderTime',
            Value: event.data.renderTimeMs,
            Unit: 'Milliseconds',
            Dimensions: [
              { Name: 'CompositionId', Value: event.data.compositionId },
            ],
          },
        ],
      });
    }
  },
});
```

### GitHub Actions (CI/CD)

```yaml
# .github/workflows/render.yml
- name: Render videos with telemetry
  env:
    TELEMETRY_ENABLED: true
    TELEMETRY_BACKEND: webhook
    TELEMETRY_WEBHOOK_URL: ${{ secrets.METRICS_WEBHOOK }}
  run: npm run render:all

- name: Check render metrics
  run: |
    # Parse render output for metrics
    npm run render -- AEMSpotlight-16x9 out/test.mp4 2>&1 | \
      grep -E "Render completed|renderTimeMs" | \
      tee metrics.log
```

---

## Alerting

### Recommended Alert Thresholds

| Metric | Warning | Critical | Action |
|--------|---------|----------|--------|
| Render Time (16x9) | > 60s | > 120s | Check CPU/memory |
| Render Time (4K) | > 300s | > 600s | Scale resources |
| AEM Latency | > 2s | > 5s | Check AEM health |
| Mock Fallback Rate | > 10% | > 25% | Investigate AEM issues |
| Error Rate | > 1% | > 5% | Review error logs |
| WASM Load Failures | > 5% | > 15% | Check WASM binary |

### Example Alert Rules (Prometheus)

```yaml
# prometheus/alerts.yml
groups:
  - name: remotion-aem
    rules:
      - alert: HighRenderTime
        expr: remotion_render_time_ms > 120000
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High render time detected"

      - alert: AEMFallbackRate
        expr: rate(aem_fetch_fallback_total[5m]) / rate(aem_fetch_total[5m]) > 0.1
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "High AEM fallback rate"

      - alert: RenderFailureRate
        expr: rate(remotion_render_failed_total[5m]) / rate(remotion_render_total[5m]) > 0.05
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High render failure rate"
```

### Grafana Dashboard

Import the included dashboard for visualization:

```json
// grafana/remotion-aem-dashboard.json
{
  "title": "Remotion AEM Showcase",
  "panels": [
    {
      "title": "Render Time Distribution",
      "type": "histogram"
    },
    {
      "title": "AEM Fetch Latency",
      "type": "graph"
    },
    {
      "title": "Error Rate",
      "type": "stat"
    },
    {
      "title": "WASM vs JS Usage",
      "type": "piechart"
    }
  ]
}
```

---

## Best Practices

1. **Sample in Production**: Use `TELEMETRY_SAMPLE_RATE=0.1` to reduce volume
2. **Batch Events**: Events are buffered and sent every 5 seconds
3. **Flush on Exit**: Call `flushTelemetry()` before process termination
4. **Exclude Stack Traces**: Set `TELEMETRY_INCLUDE_STACKS=false` for privacy
5. **Monitor the Monitor**: Track telemetry delivery failures separately

---

## Troubleshooting

### Events Not Appearing

```bash
# Enable debug logging
DEBUG=telemetry:* npm run render

# Check telemetry status
node -e "const t = require('./src/telemetry'); console.log(t.getTelemetryStatus())"
```

### High Latency to Webhook

- Increase `BUFFER_FLUSH_INTERVAL` in telemetry config
- Use async webhook with queue (SQS, Pub/Sub)
- Consider sampling rate reduction

### Memory Issues with Buffering

- Reduce `BUFFER_MAX_SIZE`
- Enable more aggressive flushing
- Use streaming backend instead of buffering
