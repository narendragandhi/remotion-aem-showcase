/**
 * AEM Connectivity Verification
 *
 * Validates that the configured AEM Cloud Service endpoint is reachable,
 * authenticated, and returns valid content for the expected Content Fragment path.
 *
 * Usage:
 *   node scripts/verify-aem.js            # exits 0 on success, 1 on failure
 *   node scripts/verify-aem.js --json     # machine-readable output
 *
 * Required env vars:
 *   AEM_BASE_URL               e.g. https://publish-p123-e456.adobeaemcloud.com
 *   AEM_TOKEN                  IMS bearer token
 *
 * Optional:
 *   AEM_GRAPHQL_ENDPOINT       default: /content/graphql/global/endpoint
 *   AEM_CONTENT_FRAGMENT_PATH  default: /content/dam/content-fragments/spotlight
 */

const jsonMode = process.argv.includes("--json");

const {
  AEM_BASE_URL,
  AEM_TOKEN,
  AEM_GRAPHQL_ENDPOINT = "/content/graphql/global/endpoint",
  AEM_CONTENT_FRAGMENT_PATH = "/content/dam/content-fragments/spotlight",
} = process.env;

const results = [];

function pass(check, detail = "") {
  results.push({ check, status: "pass", detail });
  if (!jsonMode) console.log(`  ✓  ${check}${detail ? ` — ${detail}` : ""}`);
}

function fail(check, detail = "") {
  results.push({ check, status: "fail", detail });
  if (!jsonMode) console.error(`  ✗  ${check}${detail ? ` — ${detail}` : ""}`);
}

function warn(check, detail = "") {
  results.push({ check, status: "warn", detail });
  if (!jsonMode) console.warn(`  ⚠  ${check}${detail ? ` — ${detail}` : ""}`);
}

async function run() {
  if (!jsonMode) console.log("\nAEM Connectivity Verification\n");

  // 1. Config present
  if (!AEM_BASE_URL) {
    fail("Config: AEM_BASE_URL set", "Missing — set AEM_BASE_URL env var");
    finish();
    return;
  }
  pass("Config: AEM_BASE_URL set", AEM_BASE_URL);

  if (!AEM_TOKEN) {
    warn("Config: AEM_TOKEN set", "Missing — unauthenticated requests may fail");
  } else {
    pass("Config: AEM_TOKEN set", "(token present, value hidden)");
  }

  // 2. Health ping — AEM /libs/granite/core/content/login.html redirects
  //    or /system/sling/health returns 200 on healthy instances
  if (!jsonMode) console.log("\n  Checking reachability…");
  try {
    const pingUrl = `${AEM_BASE_URL}/libs/granite/core/content/login.html`;
    const res = await fetch(pingUrl, { method: "HEAD", redirect: "manual" });
    if (res.status < 500) {
      pass("Reachability: AEM endpoint responds", `HTTP ${res.status}`);
    } else {
      fail("Reachability: AEM endpoint responds", `HTTP ${res.status} — server error`);
    }
  } catch (err) {
    fail("Reachability: AEM endpoint responds", err.message);
    finish();
    return;
  }

  // 3. GraphQL endpoint introspection
  if (!jsonMode) console.log("  Checking GraphQL endpoint…");
  const graphqlUrl = `${AEM_BASE_URL}${AEM_GRAPHQL_ENDPOINT}`;
  try {
    const res = await fetch(graphqlUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(AEM_TOKEN ? { Authorization: `Bearer ${AEM_TOKEN}` } : {}),
      },
      body: JSON.stringify({ query: "{ __typename }" }),
    });

    if (res.ok) {
      const json = await res.json();
      if (json.data?.__typename) {
        pass("GraphQL: endpoint reachable and authenticated", `${graphqlUrl}`);
      } else if (json.errors) {
        warn("GraphQL: endpoint reachable but returned errors", json.errors[0]?.message);
      } else {
        warn("GraphQL: unexpected response shape", JSON.stringify(json).slice(0, 80));
      }
    } else if (res.status === 401 || res.status === 403) {
      fail("GraphQL: endpoint reachable and authenticated", `HTTP ${res.status} — check AEM_TOKEN`);
    } else {
      fail("GraphQL: endpoint reachable and authenticated", `HTTP ${res.status}`);
    }
  } catch (err) {
    fail("GraphQL: endpoint reachable and authenticated", err.message);
  }

  // 4. Content Fragment query
  if (!jsonMode) console.log("  Checking Content Fragment…");
  const cfQuery = `
    query {
      contentFragmentByPath(_path: "${AEM_CONTENT_FRAGMENT_PATH}") {
        item { _path title }
      }
    }
  `;
  try {
    const res = await fetch(graphqlUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(AEM_TOKEN ? { Authorization: `Bearer ${AEM_TOKEN}` } : {}),
      },
      body: JSON.stringify({ query: cfQuery }),
    });

    if (res.ok) {
      const json = await res.json();
      const item = json.data?.contentFragmentByPath?.item;
      if (item) {
        pass("Content Fragment: found at configured path", `title="${item.title}", path=${item._path}`);
      } else if (json.errors) {
        fail("Content Fragment: found at configured path", json.errors[0]?.message);
      } else {
        warn(
          "Content Fragment: found at configured path",
          `Nothing at ${AEM_CONTENT_FRAGMENT_PATH} — create the fragment or update AEM_CONTENT_FRAGMENT_PATH`
        );
      }
    } else {
      fail("Content Fragment: found at configured path", `HTTP ${res.status}`);
    }
  } catch (err) {
    fail("Content Fragment: found at configured path", err.message);
  }

  finish();
}

function finish() {
  const passed = results.filter((r) => r.status === "pass").length;
  const failed = results.filter((r) => r.status === "fail").length;
  const warned = results.filter((r) => r.status === "warn").length;

  if (jsonMode) {
    console.log(JSON.stringify({ results, summary: { passed, warned, failed } }, null, 2));
  } else {
    console.log(`\nSummary: ${passed} passed, ${warned} warned, ${failed} failed\n`);
  }

  process.exit(failed > 0 ? 1 : 0);
}

run().catch((err) => {
  if (!jsonMode) console.error("Unexpected error:", err);
  process.exit(1);
});
