/**
 * Remotion Configuration
 *
 * This file configures the Remotion CLI for rendering and previewing.
 * See: https://www.remotion.dev/docs/config
 */

import { Config } from "@remotion/cli/config";

// Video codec configuration
Config.setCodec("h264");

// Enable multi-threading for faster renders
Config.setConcurrency("50%");

// Mute audio by default (no audio in spotlight videos)
Config.setMuted(true);

// Override Webpack config for WASM support and Node built-in stubs
Config.overrideWebpackConfig((config) => {
  // Ensure WASM files are handled correctly
  config.module = config.module || { rules: [] };
  config.module.rules = config.module.rules || [];

  config.module.rules.push({
    test: /\.wasm$/,
    type: "asset/resource",
  });

  // Stub out all Node-only built-ins so webpack doesn't fail when
  // server-side modules (cache/index.ts, tokenManager.ts, jsonwebtoken)
  // are reachable via dynamic imports in aemClient.ts.
  // These modules are never actually called inside a Remotion composition.
  config.resolve = {
    ...config.resolve,
    fallback: {
      ...(config.resolve?.fallback as Record<string, false> | undefined),
      assert: false,
      buffer: false,
      child_process: false,
      constants: false,
      crypto: false,
      domain: false,
      events: false,
      fs: false,
      http: false,
      https: false,
      net: false,
      os: false,
      path: false,
      punycode: false,
      querystring: false,
      readline: false,
      stream: false,
      string_decoder: false,
      sys: false,
      timers: false,
      tls: false,
      tty: false,
      url: false,
      util: false,
      vm: false,
      zlib: false,
    },
  };

  return config;
});

// Set public directory for static files
Config.setPublicDir("./public");
