export default async function handler(req, res) {
  if (req.method === "GET") return res.status(200).json({ service: "BrandNMotion AI planner", configured: Boolean(process.env.GEMINI_API_KEY) });
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }
  const prompt = req.body?.prompt;
  if (typeof prompt !== "string" || !prompt.trim() || prompt.length > 3000) {
    return res.status(400).json({ error: "Enter a scene description under 3000 characters." });
  }
  const key = process.env.GEMINI_API_KEY;
  if (!key) return res.status(503).json({ error: "Gemini API key is not configured." });
  try {
    const headers = { "x-goog-api-key": key };
    const modelsResponse = await fetch("https://generativelanguage.googleapis.com/v1beta/models?pageSize=100", { headers });
    if (!modelsResponse.ok) {
      console.error("Gemini model listing failed", modelsResponse.status);
      const errors = { 400: "Gemini rejected the API request.", 401: "Gemini API key was rejected.", 403: "Gemini access denied. Check API key restrictions.", 429: "Gemini quota exceeded." };
      return res.status(502).json({ error: (errors[modelsResponse.status] || "Unable to list available Gemini models.") + " (provider " + modelsResponse.status + ")" });
    }
    const listing = await modelsResponse.json();
    const available = (listing.models || []).filter(m => m.supportedGenerationMethods?.includes("generateContent"));
    const preferred = ["gemini-2.5-flash-lite", "gemini-2.0-flash-lite", "gemini-2.0-flash", "gemini-2.5-flash"];
    const candidates = [...available].sort((a, b) => {
      const score = m => { const i = preferred.findIndex(p => m.name === "models/" + p); return i === -1 ? 100 : i; };
      return score(a) - score(b);
    }).filter(m => /gemini.*flash/i.test(m.name)).slice(0, 6);
    if (!candidates.length) return res.status(502).json({ error: "No compatible Gemini text models are available." });
    let lastStatus = 404;
    for (const model of candidates) {
      const response = await fetch("https://generativelanguage.googleapis.com/v1beta/" + model.name + ":generateContent", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({
          contents: [{ parts: [{ text: "Create a concise cinematic production treatment with concept, shots, camera moves, lighting, and editing notes for: " + prompt }] }],
          generationConfig: { maxOutputTokens: 1200 }
        })
      });
      if (response.ok) {
        const data = await response.json();
        const result = data.candidates?.[0]?.content?.parts?.map(p => p.text || "").join("") || "";
        if (result) return res.status(200).json({ success: true, result });
        return res.status(502).json({ error: "Gemini returned no text. Try a shorter prompt." });
      }
      lastStatus = response.status;
      console.error("Gemini generation failed", response.status, model.name);
      if (response.status !== 404) break;
    }
    const messages = { 400: "Gemini rejected the prompt.", 401: "Gemini authentication failed.", 403: "Gemini access denied.", 404: "All available Gemini models returned not found.", 429: "Gemini quota or rate limit reached." };
    return res.status(502).json({ error: (messages[lastStatus] || "Gemini generation failed.") + " (provider " + lastStatus + ")" });
  } catch (error) {
    console.error("Gemini request error", error?.name);
    return res.status(502).json({ error: "Unable to connect to Gemini." });
  }
}
