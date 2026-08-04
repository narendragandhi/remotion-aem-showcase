# Load Testing

## What is tested today

The repository includes a small concurrent provenance API test:

```bash
npm run load:test:provenance
```

Defaults are 20 create requests at concurrency 4. Override them when comparing
environments:

```bash
node scripts/load-test-provenance.mjs \
  --base-url=http://127.0.0.1:5176 \
  --requests=100 \
  --concurrency=10
```

The script reports success count, failure count, and p50/p95/maximum request
latency. It exercises request parsing, campaign hashing, and the configured
provenance store. It does not render video.

## What this proves

- The API accepts concurrent valid requests without process errors.
- The store and connection pool handle the tested request level.
- Request latency is measurable and repeatable for a given local environment.

The result is local evidence, not a production capacity claim. Record the command,
commit, environment, database size, and output JSON with any performance result.

### Local baseline

On 2026-08-04, the local Vite/PostgreSQL stack completed 100 of 100 create requests
at concurrency 10 with p50 latency of 15.1 ms, p95 latency of 102.5 ms, and maximum
latency of 163.8 ms. This is a repository baseline only; it does not include video
rendering, AEM traffic, authentication, or production networking.

## Required production test stages

1. **API baseline:** run this test against the deployed API with representative
   campaign sizes and authenticated requests.
2. **Queue pressure:** submit render jobs at a controlled rate and measure queue
   depth, lease expiry, retry rate, and time-to-first-attempt.
3. **Worker throughput:** test one, two, and many isolated workers across 16:9,
   9:16, 1:1, and 4K. Capture CPU, memory, render time, and failure rate.
4. **AEM behavior:** measure GraphQL and asset delivery latency, throttling, and
   cache effectiveness against the intended Author/Publish tier.
5. **Storage behavior:** measure upload latency, checksum cost, retention, and
   concurrent output reads from the selected object store or DAM.
6. **Soak and recovery:** run a representative workload long enough to expose
   leaks, stale leases, database pool exhaustion, and worker restarts.

## Capacity decisions

Do not choose worker counts from guesswork. Establish target service levels first:

- preview API p95 latency;
- maximum queued render age;
- render completion time by format;
- acceptable retry and failure rates;
- maximum concurrent renders per worker;
- database connection and storage thresholds.

The next production-grade step is a k6 or equivalent scenario wired to the deployed
API and queue. Keep this lightweight script for repository-level regression checks.
