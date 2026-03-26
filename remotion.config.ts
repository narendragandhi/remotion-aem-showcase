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

// Override Webpack config for WASM support
Config.overrideWebpackConfig((config) => {
  // Ensure WASM files are handled correctly
  config.module = config.module || { rules: [] };
  config.module.rules = config.module.rules || [];

  config.module.rules.push({
    test: /\.wasm$/,
    type: "asset/resource",
  });

  return config;
});

// Set public directory for static files
Config.setPublicDir("./public");
