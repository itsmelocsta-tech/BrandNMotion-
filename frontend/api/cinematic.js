const base = "https://generativelanguage.googleapis.com/v1beta/";
const model = "veo-3.1-fast-generate-preview";
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST" && req.method !== "GET") return res.status(405).json({ error: "Method not allowed." });
  if (!process.env.GEMINI_API_KEY) return res.status(503).json({ error: "Gemini credentials are not configured." });
  if (process.env.ENABLE_PAID_VIDEO_GENERATION !== "true") {
    return res.status(503).json({ error: "AI cinematic generation is not enabled. Veo requires paid API access; enable only after approving provider charges.", code: "BILLING_APPROVAL_REQUIRED" });
  }
  const key = process.env.GEMINI_API_KEY;
  try {
    if (req.method === "POST") {
      const prompt = req.body?.prompt;
      if (typeof prompt !== "string" || !prompt.trim() || prompt.length > 1500) return res.status(400).json({ error: "Provide a video prompt of 1–1500 characters." });
      const aspectRatio = req.body?.aspectRatio === "9:16" ? "9:16" : "16:9";
      const upstream = await fetch(base + "models/" + model + ":predictLongRunning", {
        method: "POST",
        headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
        body: JSON.stringify({ instances: [{ prompt: prompt.trim() }], parameters: { aspectRatio, sampleCount: 1 } }),
        signal: AbortSignal.timeout(25000)
      });
      const data = await upstream.json().catch(() => ({}));
      if (!upstream.ok) {
        console.error("Veo start failure", upstream.status, data.error?.status || "UNKNOWN");
        return res.status(upstream.status === 429 ? 429 : 502).json({ error: data.error?.message?.slice(0, 240) || "Video provider rejected the request.", providerStatus: upstream.status });
      }
      if (!/^operations\/[a-zA-Z0-9._:/-]+$/.test(data.name || "")) return res.status(502).json({ error: "Video provider returned an invalid operation identifier." });
      return res.status(202).json({ operation: data.name, status: "processing" });
    }
    const operation = req.query?.operation;
    if (typeof operation !== "string" || !/^operations\/[a-zA-Z0-9._:/-]+$/.test(operation)) return res.status(400).json({ error: "Invalid video operation." });
    const upstream = await fetch(base + operation, { headers: { "x-goog-api-key": key }, signal: AbortSignal.timeout(15000) });
    const data = await upstream.json().catch(() => ({}));
    if (!upstream.ok) return res.status(502).json({ error: "Unable to check video generation status.", providerStatus: upstream.status });
    if (data.error) return res.status(502).json({ error: data.error.message?.slice(0, 240) || "Video generation failed." });
    if (!data.done) return res.status(200).json({ status: "processing" });
    const videos = data.response?.generateVideoResponse?.generatedSamples || data.response?.generatedVideos || [];
    const uri = videos[0]?.video?.uri || videos[0]?.video?.videoUri || videos[0]?.video?.uri;
    if (!uri || !/^https:\/\//.test(uri)) return res.status(502).json({ error: "Generation completed without a downloadable video URL." });
    return res.status(200).json({ status: "completed", downloadUrl: "/api/cinematic-download?operation=" + encodeURIComponent(operation) });
  } catch (error) {
    console.error("Veo service exception", error?.name);
    return res.status(502).json({ error: "Video service timed out or could not be reached." });
  }
}
