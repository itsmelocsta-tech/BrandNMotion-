import { useState } from "react";
import axios from "axios";

export default function App() {
  const [prompt, setPrompt] = useState("");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);

  const generateVideo = async () => {
    try {
      setLoading(true);

      const response = await axios.post(
        "/api/generate",
        {
          prompt,
        }
      );

      setResult(response.data.result);
    } catch (error) {
      console.error(error);
      if (axios.isAxiosError(error)) {
        const detail = error.response?.data?.error;
        setResult(`Service error ${error.response?.status || "network"}: ${typeof detail === "string" ? detail : "Unable to reach AI endpoint."}`);
      } else {
        setResult("Unexpected error while generating a treatment.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-6">
      <div className="w-full max-w-3xl bg-zinc-900 rounded-3xl p-8 shadow-2xl border border-zinc-800">
        <h1 className="text-5xl font-bold mb-6 text-center">
          BrandNmotion
        </h1>

        <p className="text-zinc-400 text-center mb-8">
          AI Cinematic Production Treatment Planner
        </p>

        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Describe your cinematic music video..."
          className="w-full h-40 bg-zinc-800 text-white p-4 rounded-2xl outline-none border border-zinc-700"
        />

        <button
          onClick={generateVideo}
          disabled={loading}
          className="w-full mt-6 bg-white text-black py-4 rounded-2xl font-bold hover:bg-zinc-300 transition"
        >
          {loading ? "Planning..." : "Generate treatment"}
        </button>

        {result && (
          <div className="mt-8 bg-zinc-800 p-6 rounded-2xl border border-zinc-700 whitespace-pre-wrap">
            {result}
          </div>
        )}
      </div>
    </div>
  );
}

//