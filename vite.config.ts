import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

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
  "string_decoder",
];

export default defineConfig({
  root: "web",
  publicDir: "../public",
  plugins: [
    react(),
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
          return "export default {}; export const existsSync = () => false; export const mkdirSync = () => {}; export const readFileSync = () => ''; export const writeFileSync = () => {}; export const unlinkSync = () => {}; export const join = (...a) => a.join('/'); export const createHash = () => ({ update: () => ({ digest: () => '' }) }); export const sign = () => ''; export const verify = () => ({});\n";
      },
    },
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
    "process.env.AEM_IMS_METASCOPES": "undefined",
  },
  build: {
    outDir: "../dist",
    emptyOutDir: true,
  },
});
