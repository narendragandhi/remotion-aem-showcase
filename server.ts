import { createServer } from 'node:http';
import { createReadStream, existsSync } from 'node:fs';
import { resolve, extname, sep } from 'node:path';
import { timingSafeEqual } from 'node:crypto';
import { PostgresProvenanceStore } from './src/provenance/postgresStore';
import { validateAssets } from './scripts/lib/asset-policy.mjs';
import { randomUUID } from 'node:crypto';
import { CreateRenderJobInputSchema } from './src/provenance/provenance';

const secret = process.env.PILOT_API_TOKEN;
if (!secret || secret.length < 32) throw new Error('PILOT_API_TOKEN must contain at least 32 characters');
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
const store = new PostgresProvenanceStore(process.env.DATABASE_URL);
const root = resolve('dist');
const types: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.wasm': 'application/wasm', '.png': 'image/png' };
const requests = new Map<string, { start: number; count: number }>();
const server = createServer(async (req, res) => {
  const requestId = randomUUID();
  res.setHeader('X-Request-ID', requestId);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' https: data:; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");
  const started = Date.now();
  res.once('finish', () => console.log(JSON.stringify({ event: 'http_request', requestId, method: req.method, status: res.statusCode, durationMs: Date.now() - started })));

  try {
    const url = new URL(req.url || '/', 'http://localhost');
    if (url.pathname === '/health/live') { res.end('ok'); return; }
    if (url.pathname.startsWith('/api/')) {
      const now = Date.now();
      for (const [key, value] of requests) if (now - value.start >= 60_000) requests.delete(key);
      const key = req.socket.remoteAddress || 'unknown';
      if (!requests.has(key) && requests.size >= 10_000) { res.writeHead(503).end(); return; }
      const bucket = requests.get(key) || { start: now, count: 0 };
      requests.set(key, bucket);
      if (++bucket.count > 60) { res.setHeader('Retry-After', '60'); res.writeHead(429).end(); return; }

      res.setHeader('Cache-Control', 'no-store');
      const token = (req.headers.authorization || '').replace(/^Bearer /, '');
      const a = Buffer.from(token), b = Buffer.from(secret);
      if (a.length !== b.length || !timingSafeEqual(a, b)) { res.writeHead(401).end(); return; }
      if (url.pathname === '/api/health/ready' && req.method === 'GET') {
        await store.health(); res.end(JSON.stringify({ status: 'ready' })); return;
      }
      const chunks: Buffer[] = [];
      let bytes = 0;
      for await (const chunk of req) {
        bytes += chunk.length;
        if (bytes > 1_000_000) { res.writeHead(413).end(); return; }
        chunks.push(Buffer.from(chunk));
      }
      const body = Buffer.concat(chunks);
      res.setHeader('Content-Type', 'application/json');
      if (req.method === 'GET' && /^\/api\/provenance\/?$/.test(url.pathname)) {
        res.end(JSON.stringify({ jobs: await store.list() })); return;
      }
      if (req.method === 'POST' && url.pathname === '/api/provenance/jobs') {
        const input = CreateRenderJobInputSchema.parse(JSON.parse(body.toString()));
        validateAssets(input.content, process.env.ASSET_ALLOWED_ORIGINS || '');
        const job = await store.create({ ...input, requestedBy: 'pilot-operator' });
        res.writeHead(201).end(JSON.stringify({ job })); return;
      }
      if (url.pathname.startsWith('/api/aem/') && ['GET', 'POST'].includes(req.method || '')) {
        const path = url.pathname.slice('/api/aem'.length);
        if (!/^\/((content\/_cq_graphql\/|content\/graphql\/|graphql\/execute\.json\/))/.test(path)) {
          res.writeHead(403).end(); return;
        }
        const base = process.env.AEM_BASE_URL;
        if (!base) throw new Error('AEM_BASE_URL is required');
        const upstream = await fetch(base.replace(/\/$/, '') + path + url.search, {
          method: req.method, redirect: 'error', signal: AbortSignal.timeout(30_000),
          headers: { 'Content-Type': 'application/json', ...(process.env.AEM_TOKEN ? { Authorization: process.env.AEM_TOKEN } : {}) },
          body: req.method === 'POST' ? body : undefined
        });
        res.writeHead(upstream.status).end(Buffer.from(await upstream.arrayBuffer())); return;
      }
      res.writeHead(404).end(JSON.stringify({ error: 'Unknown API route' })); return;
    }
    if (!['GET', 'HEAD'].includes(req.method || '')) { res.writeHead(405).end(); return; }
    const file = resolve(root, '.' + decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname));
    if (!file.startsWith(root + sep) || !existsSync(file)) { res.writeHead(404).end(); return; }
    res.setHeader('Content-Type', types[extname(file)] || 'application/octet-stream');
    if (req.method === 'HEAD') res.end(); else createReadStream(file).on('error', () => res.destroy()).pipe(res);
  } catch (error) {
    console.error(JSON.stringify({ event: 'http_error', requestId, errorType: error instanceof Error ? error.name : 'Error' }));
    res.writeHead(400).end(JSON.stringify({ error: 'Request failed' }));
  }
});
server.requestTimeout = 35_000;
server.headersTimeout = 10_000;
server.keepAliveTimeout = 5_000;
process.on("SIGTERM", () => server.close(() => process.exit(0)));
server.listen(Number(process.env.PORT || 5176), process.env.HOST || '127.0.0.1');
