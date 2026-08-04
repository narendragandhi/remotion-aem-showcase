import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import { existsSync, statSync } from "node:fs";

const EXPECTED_DIMENSIONS = {
  "16x9": [1280, 720],
  "9x16": [720, 1280],
  "1x1": [1080, 1080],
  "4K": [3840, 2160]
};

export function validateMediaFile(filePath, format, options = {}) {
  const expected = EXPECTED_DIMENSIONS[format];
  if (!expected) throw new Error(`Unsupported media format: ${format}`);
  if (!existsSync(filePath)) throw new Error(`Media output does not exist: ${filePath}`);

  const ffprobe = options.binary || process.env.FFPROBE_BIN || "ffprobe";
  const result = spawnSync(
    ffprobe,
    ["-v", "error", "-print_format", "json", "-show_streams", "-show_format", filePath],
    { encoding: "utf8", maxBuffer: 1024 * 1024 }
  );
  if (result.error) {
    throw new Error(`ffprobe is required to validate media outputs: ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(`ffprobe rejected ${filePath}: ${(result.stderr || "unknown error").trim()}`);
  }

  let metadata;
  try {
    metadata = JSON.parse(result.stdout);
  } catch {
    throw new Error(`ffprobe returned invalid JSON for ${filePath}`);
  }

  const videoStreams = (metadata.streams || []).filter((stream) => stream.codec_type === "video");
  if (videoStreams.length !== 1) throw new Error(`Expected exactly one video stream in ${filePath}`);
  const video = videoStreams[0];
  if (video.width !== expected[0] || video.height !== expected[1]) {
    throw new Error(
      `Unexpected dimensions for ${format}: ${video.width}x${video.height}; expected ${expected[0]}x${expected[1]}`
    );
  }

  const duration = Number(metadata.format?.duration || video.duration || 0);
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new Error(`Media output has no usable duration: ${filePath}`);
  }

  return {
    container: metadata.format?.format_name || "unknown",
    codec: video.codec_name || "unknown",
    width: video.width,
    height: video.height,
    durationSeconds: Number(duration.toFixed(3)),
    byteSize: statSync(filePath).size
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [, , format, filePath] = process.argv;
  if (!format || !filePath) {
    console.error("Usage: node scripts/validate-media.mjs <format> <file>");
    process.exit(2);
  }
  try {
    console.log(JSON.stringify(validateMediaFile(filePath, format), null, 2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
