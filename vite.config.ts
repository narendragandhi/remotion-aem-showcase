import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { FileProvenanceStore } from "./src/provenance/fileStore";
import { PostgresProvenanceStore } from "./src/provenance/postgresStore";
import { CreateRenderJobInputSchema, RenderJobPatchSchema } from "./src/provenance/provenance";
import { resolve } from "node:path";

// Node built-ins and server-only packages to stub in the browser build.
// These live inside dynamic-import chunks (tokenManager, cache) that are
// never actually loaded in the browser showcase — but Rollup still needs
// to resolve them when code-splitting those chunks.
const SERVER_ONLY = [
  "jsonwebtoken",
  "fs",
  "fs/promises",
  "path",
  "path/posix",
  "path/win32",
  "crypto",
  "os",
  "util",
  "stream",
  "buffer",
  "net",
  "tls",
  "http",
  "https",
  "events",
  "child_process",
  "readline",
  "vm",
  "url",
  "assert",
  "zlib",
  "querystring",
  "string_decoder"
];

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const aemBaseUrl = env.AEM_BASE_URL || "http://localhost:4502";
  const aemToken = env.AEM_TOKEN || "";
  const provenanceStore = env.DATABASE_URL
    ? new PostgresProvenanceStore(env.DATABASE_URL)
    : new FileProvenanceStore(resolve(process.cwd(), ".local/provenance/jobs.json"));
  const readJsonBody = async (req: import("node:http").IncomingMessage): Promise<unknown> => {
    const maxBytes = 1_000_000;
    const declaredLength = Number(req.headers["content-length"] ?? 0);
    if (declaredLength > maxBytes) throw new Error("Request body exceeds the 1 MB limit");
    const chunks: Buffer[] = [];
    let total = 0;
    for await (const chunk of req) {
      const buffer = Buffer.from(chunk);
      total += buffer.length;
      if (total > maxBytes) throw new Error("Request body exceeds the 1 MB limit");
      chunks.push(buffer);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  };
  const setJsonHeaders = (res: import("node:http").ServerResponse): void => {
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
  };

  return {
    root: "web",
    publicDir: "../public",
    plugins: [
      react(),
      {
        name: "provenance-api",
        configureServer(server) {
          server.middlewares.use("/api/provenance", async (req, res, next) => {
            try {
              const requestPath = (req.url || "/").split("?")[0];
              if (req.method === "GET" && requestPath === "/") {
                setJsonHeaders(res);
                res.end(JSON.stringify({ jobs: await provenanceStore.list() }));
                return;
              }
              if (req.method === "POST" && requestPath === "/jobs") {
                const payload = CreateRenderJobInputSchema.parse(await readJsonBody(req));
                const job = await provenanceStore.create(payload);
                res.statusCode = 201;
                setJsonHeaders(res);
                res.end(JSON.stringify({ job }));
                return;
              }
              const match = requestPath.match(/^\/jobs\/([^/]+)$/);
              if (req.method === "PATCH" && match) {
                const patch = RenderJobPatchSchema.parse(await readJsonBody(req));
                const job = await provenanceStore.update(match[1], patch);
                if (!job) {
                  res.statusCode = 404;
                  setJsonHeaders(res);
                  res.end(JSON.stringify({ error: "Render job not found" }));
                  return;
                }
                setJsonHeaders(res);
                res.end(JSON.stringify({ job }));
                return;
              }
              res.statusCode = 404;
              setJsonHeaders(res);
              res.end(JSON.stringify({ error: "Unknown provenance route" }));
            } catch (error) {
              res.statusCode = 400;
              setJsonHeaders(res);
              res.end(
                JSON.stringify({
                  error: error instanceof Error ? error.message : "Invalid provenance request"
                })
              );
            }
          });
        }
      },
      {
        name: "aem-preview-api",
        configureServer(server) {
          server.middlewares.use("/api/aem", async (req, res, next) => {
            if (!req.url) return next();

            try {
              const chunks: Buffer[] = [];
              for await (const chunk of req) chunks.push(Buffer.from(chunk));
              const upstream = await fetch(`${aemBaseUrl}${req.url}`, {
                method: req.method,
                headers: {
                  ...(req.headers["content-type"]
                    ? { "Content-Type": req.headers["content-type"] }
                    : {}),
                  ...(aemToken ? { Authorization: aemToken } : {})
                },
                body: chunks.length > 0 ? Buffer.concat(chunks) : undefined
              });
              res.statusCode = upstream.status;
              const contentType = upstream.headers.get("content-type");
              if (contentType) res.setHeader("Content-Type", contentType);
              res.end(Buffer.from(await upstream.arrayBuffer()));
            } catch (error) {
              next(error);
            }
          });
        }
      },
      {
        // enforce: 'pre' ensures this runs before Vite's built-in browser-compat
        // externalization, which would otherwise make named imports from fs/crypto/path fail.
        name: "stub-server-only",
        enforce: "pre",
        resolveId(id) {
          const bare = id.replace(/^node:/, "");
          if (SERVER_ONLY.includes(bare) || SERVER_ONLY.includes(id)) {
            return "\0stub:" + id;
          }
        },
        load(id) {
          if (id.startsWith("\0stub:"))
            return "export default {}; export const existsSync = () => false; export const mkdirSync = () => {}; export const readFileSync = () => ''; export const writeFileSync = () => {}; export const unlinkSync = () => {}; export const readdirSync = () => []; export const join = (...a) => a.join('/'); export const createHash = () => ({ update: () => ({ digest: () => '' }) }); export const sign = () => ''; export const verify = () => ({});\n";
        }
      }
    ],
    define: {
      "process.env.USE_MOCK_AEM": '"true"',
      "process.env.AEM_BASE_URL": '""',
      "process.env.AEM_TOKEN": '""',
      "process.env.AEM_GRAPHQL_ENDPOINT": '""',
      "process.env.AEM_CONTENT_FRAGMENT_PATH": '""',
      "process.env.AEM_STRICT_MODE": '"false"',
      "process.env.AEM_PUBLISH_TIER": '"false"',
      "process.env.TELEMETRY_ENABLED": '"false"',
      "process.env.TELEMETRY_BACKEND": '"console"',
      "process.env.TELEMETRY_SAMPLE_RATE": '"1"',
      "process.env.TELEMETRY_INCLUDE_STACKS": '"false"',
      "process.env.CACHE_ENABLED": '"false"',
      "process.env.REMOTION_MOCK_FILE": '"default"',
      "process.env.TELEMETRY_WEBHOOK_URL": "undefined",
      "process.env.ADOBE_ANALYTICS_RSID": "undefined",
      "process.env.AEM_IMS_CLIENT_ID": "undefined",
      "process.env.AEM_IMS_CLIENT_SECRET": "undefined",
      "process.env.AEM_IMS_TECHNICAL_ACCOUNT_ID": "undefined",
      "process.env.AEM_IMS_ORG_ID": "undefined",
      "process.env.AEM_IMS_PRIVATE_KEY": "undefined",
      "process.env.AEM_IMS_ENDPOINT": "undefined",
      "process.env.AEM_IMS_METASCOPES": "undefined"
    },
    build: {
      outDir: "../dist",
      emptyOutDir: true
    },
    server: {
      proxy: {
        "/api/aem": {
          target: aemBaseUrl,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/aem/, ""),
          headers: aemToken ? { Authorization: aemToken } : undefined,
          configure: (proxy) => {
            proxy.on("proxyReq", (proxyReq) => {
              // The dev proxy owns the AEM trust boundary. Removing the
              // browser Origin prevents the local author CORS handler from
              // short-circuiting GraphQL POSTs with an empty 204 response.
              proxyReq.removeHeader("origin");
              proxyReq.removeHeader("referer");
              proxyReq.removeHeader("sec-fetch-site");
              proxyReq.removeHeader("sec-fetch-mode");
              proxyReq.removeHeader("sec-fetch-dest");
              if (aemToken) proxyReq.setHeader("Authorization", aemToken);
            });
          }
        }
      }
    }
  };
});
