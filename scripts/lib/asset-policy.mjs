// Exact trusted HTTPS origins only. Render workers must additionally run with
// outbound network restrictions: Chromium may follow redirects from approved hosts.
export function validateAssets(content, origins) {
  const allowed = new Set(origins.split(',').filter(Boolean).map(value => {
    const url = new URL(value.trim());
    if (url.protocol !== 'https:' || url.username || url.password) throw new Error('Asset origins must use HTTPS');
    return url.origin;
  }));
  if (!Array.isArray(content?.scenes) || content.scenes.length > 30) throw new Error('Expected at most 30 scenes');
  let duration = 0;
  for (const scene of content.scenes) {
    duration += scene.durationSeconds;
    for (const key of ['imageUrl', 'svgOverlayUrl', 'lottieUrl']) {
      const value = scene[key];
      if (!value) continue;
      const url = new URL(value);
      if (url.protocol !== 'https:' || url.username || url.password || !allowed.has(url.origin)) {
        throw new Error('Asset origin is not permitted');
      }
    }
  }
  if (!Number.isFinite(duration) || duration <= 0 || duration > 120) throw new Error('Campaign duration must be 1–120 seconds');
}
