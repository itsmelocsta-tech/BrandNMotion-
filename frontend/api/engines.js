const ENGINES = [
  { id: "veo", label: "Google Veo", model: "veo-3.1-fast-generate-preview", available: Boolean(process.env.GEMINI_API_KEY && process.env.ENABLE_PAID_VIDEO_GENERATION === "true"), description: "Google cinematic generation" },
  { id: "runway", label: "Runway", model: "gen4.5", available: Boolean(process.env.RUNWAYML_API_SECRET && process.env.ENABLE_PAID_VIDEO_GENERATION === "true"), description: "Runway text-to-video generation" }
];
const allowed = /^([a-zA-Z0-9_-]{1,60})$/;
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "GET" && !req.query?.id) return res.status(200).json({ engines: ENGINES.map(({ id, label, available, description }) => ({ id, label, available, description })), paidGenerationEnabled: process.env.ENABLE_PAID_VIDEO_GENERATION === "true" });
  if (req.method !== "POST" && req.method !== "GET") return res.status(405).json({ error: "Method not allowed." });
  const engine = req.method === "POST" ? req.body?.engine : req.query?.engine;
  if (!["runway", "veo"].includes(engine)) return res.status(400).json({ error: "Choose a supported video engine." });
  if (process.env.ENABLE_PAID_VIDEO_GENERATION !== "true") return res.status(503).json({ error: "Paid AI video generation is disabled pending your approval.", code: "BILLING_APPROVAL_REQUIRED" });
  const key = engine === "runway" ? process.env.RUNWAYML_API_SECRET : process.env.GEMINI_API_KEY;
  if (!key) return res.status(503).json({ error: engine + " is not configured. Provider credentials and account access are required." });
  const prompt = req.body?.prompt;
  const id = req.query?.id;
  if (req.method === "POST" && (typeof prompt !== "string" || !prompt.trim() || prompt.length > 1500)) return res.status(400).json({ error: "Provide a prompt of 1–1500 characters." });
  if (req.method === "GET" && (typeof id !== "string" || !allowed.test(id))) return res.status(400).json({ error: "Invalid job identifier." });
  try {
    if (engine === "runway") {
      const base = "https://api.dev.runwayml.com/v1/text_to_video";
      const url = req.method === "POST" ? base : "https://api.dev.runwayml.com/v1/tasks/" + encodeURIComponent(id);
      const upstream = await fetch(url, {
        method: req.method,
        headers: { Authorization: "Bearer " + key, "X-Runway-Version": "2024-11-06", "Content-Type": "application/json" },
        ...(req.method === "POST" ? { body: JSON.stringify({ model: "gen4.5", promptText: prompt.trim(), ratio: req.body?.aspectRatio === "9:16" ? "720:1280" : "1280:720", duration: 5 }) } : {}),
        signal: AbortSignal.timeout(25000)
      });
      const data = await upstream.json().catch(() => ({}));
      if (!upstream.ok) return res.status(upstream.status === 429 ? 429 : 502).json({ error: data.error?.message || data.message || "Runway provider error.", providerStatus: upstream.status });
      if (req.method === "POST") return res.status(202).json({ engine, id: data.id, status: "processing" });
      if (data.status === "SUCCEEDED" && Array.isArray(data.output) && data.output[0]) return res.status(200).json({ status: "completed", videoUrl: data.output[0] });
      if (["FAILED", "CANCELLED"].includes(data.status)) return res.status(502).json({ error: "Runway generation " + data.status.toLowerCase() + "." });
      return res.status(200).json({ status: "processing" });
    }
    const base = "https://generativelanguage.googleapis.com/v1beta/";
    if (req.method === "POST") {
      const upstream = await fetch(base + "models/veo-3.1-fast-generate-preview:predictLongRunning", { method: "POST", headers: { "x-goog-api-key": key, "Content-Type": "application/json" }, body: JSON.stringify({ instances: [{ prompt: prompt.trim() }], parameters: { aspectRatio: req.body?.aspectRatio === "9:16" ? "9:16" : "16:9", sampleCount: 1 } }), signal: AbortSignal.timeout(25000) });
      const data = await upstream.json().catch(() => ({}));
      if (!upstream.ok) return res.status(502).json({ error: data.error?.message?.slice(0, 200) || "Veo provider error." });
      return res.status(202).json({ engine, id: data.name?.replace(/^operations\//, ""), status: "processing" });
    }
    const upstream = await fetch(base + "operations/" + id, { headers: { "x-goog-api-key": key }, signal: AbortSignal.timeout(15000) });
    const data = await upstream.json().catch(() => ({}));
    if (!upstream.ok || data.error) return res.status(502).json({ error: "Veo generation failed." });
    if (!data.done) return res.status(200).json({ status: "processing" });
    const samples = data.response?.generateVideoResponse?.generatedSamples || [];
    if (!samples[0]?.video?.uri) return res.status(502).json({ error: "No Veo video was returned." });
    return res.status(200).json({ status: "completed", downloadUrl: "/api/cinematic-download?operation=" + encodeURIComponent("operations/" + id) });
  } catch (error) {
    console.error("Video provider failure", engine, error?.name);
    return res.status(502).json({ error: "The video provider could not be reached." });
  }
}
