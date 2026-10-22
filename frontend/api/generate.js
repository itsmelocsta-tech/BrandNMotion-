export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }
  const prompt = req.body?.prompt;
  if (typeof prompt !== "string" || !prompt.trim() || prompt.length > 3000) {
    return res.status(400).json({ error: "Enter a scene description under 3000 characters." });
  }
  if (!process.env.GEMINI_API_KEY) {
    return res.status(503).json({ error: "AI planning is not configured yet." });
  }
  try {
    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": process.env.GEMINI_API_KEY,
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: "Create a concise, practical cinematic production treatment with concept, shot list, camera moves, lighting, and editing notes for: " + prompt }] }],
          generationConfig: { maxOutputTokens: 1200 },
        }),
      }
    );
    if (!response.ok) return res.status(502).json({ error: "AI planning provider unavailable." });
    const data = await response.json();
    const result = data.candidates?.[0]?.content?.parts?.map(p => p.text || "").join("") || "";
    if (!result) return res.status(502).json({ error: "No treatment was returned." });
    return res.status(200).json({ success: true, result });
  } catch {
    return res.status(502).json({ error: "AI planning request failed." });
  }
}
