export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end();
  const key = process.env.GEMINI_API_KEY;
  if (!key || process.env.ENABLE_PAID_VIDEO_GENERATION !== "true") return res.status(503).json({ error: "Video provider not enabled." });
  const operation = req.query?.operation;
  if (typeof operation !== "string" || !/^operations\/[a-zA-Z0-9._:/-]+$/.test(operation)) return res.status(400).json({ error: "Invalid operation." });
  try {
    const status = await fetch("https://generativelanguage.googleapis.com/v1beta/" + operation, { headers: { "x-goog-api-key": key }, signal: AbortSignal.timeout(15000) });
    if (!status.ok) return res.status(502).json({ error: "Unable to verify video." });
    const data = await status.json();
    const samples = data.response?.generateVideoResponse?.generatedSamples || data.response?.generatedVideos || [];
    const uri = samples[0]?.video?.uri || samples[0]?.video?.videoUri;
    if (!data.done || !uri || !/^https:\/\//.test(uri)) return res.status(409).json({ error: "Video is not ready." });
    const target = new URL(uri);
    if (target.hostname !== "generativelanguage.googleapis.com") return res.status(502).json({ error: "Untrusted video host." });
    const video = await fetch(uri, { headers: { "x-goog-api-key": key }, redirect: "error", signal: AbortSignal.timeout(60000) });
    if (!video.ok || !video.body) return res.status(502).json({ error: "Video download unavailable." });
    res.setHeader("Content-Type", video.headers.get("content-type") || "video/mp4");
    res.setHeader("Content-Disposition", 'attachment; filename="BrandNMotion-cinematic.mp4"');
    res.setHeader("Cache-Control", "private, no-store");
    const reader = video.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(Buffer.from(value));
    }
    res.end();
  } catch (error) {
    console.error("Veo download failed", error?.name);
    if (!res.headersSent) return res.status(502).json({ error: "Video download failed." });
    res.end();
  }
}
