import { useState } from "react";
import axios from "axios";
import { renderVideo } from "./videoRenderer";

export default function App() {
  const [prompt, setPrompt] = useState("");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [rendering, setRendering] = useState(false);
  const [progress, setProgress] = useState(0);
  const [videoUrl, setVideoUrl] = useState("");
  const [renderError, setRenderError] = useState("");
  const [cinematicStatus, setCinematicStatus] = useState("");
  const [cinematicUrl, setCinematicUrl] = useState("");
  const [cinematicBusy, setCinematicBusy] = useState(false);

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

  const makeVideo = async () => {
    setRendering(true);
    setRenderError("");
    setProgress(0);
    try {
      const blob = await renderVideo({ prompt: prompt || result || "BrandNMotion cinematic preview", onProgress: setProgress });
      setVideoUrl(old => { if (old) URL.revokeObjectURL(old); return URL.createObjectURL(blob); });
    } catch (error) {
      setRenderError(error instanceof Error ? error.message : "Rendering failed.");
    } finally {
      setRendering(false);
    }
  };

  const makeCinematic = async () => {
    setCinematicBusy(true);
    setCinematicUrl("");
    setCinematicStatus("Submitting cinematic video request...");
    try {
      const started = await axios.post("/api/cinematic", { prompt, aspectRatio: "16:9" });
      const operation = started.data.operation;
      for (let i = 0; i < 90; i++) {
        await new Promise(resolve => setTimeout(resolve, 8000));
        const status = await axios.get("/api/cinematic", { params: { operation } });
        if (status.data.status === "completed") {
          setCinematicUrl(status.data.downloadUrl);
          setCinematicStatus("AI cinematic footage ready to download.");
          return;
        }
        setCinematicStatus("Generating cinematic footage... " + Math.round((i + 1) * 8 / 60) + " min elapsed");
      }
      setCinematicStatus("Still processing. Generation exceeded the wait window.");
    } catch (error) {
      const detail = axios.isAxiosError(error) ? error.response?.data?.error : undefined;
      setCinematicStatus(typeof detail === "string" ? detail : "AI video generation failed.");
    } finally { setCinematicBusy(false); }
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

        <button onClick={makeVideo} disabled={rendering} className="w-full mt-4 bg-cyan-500 text-black py-4 rounded-2xl font-bold disabled:opacity-50">
          {rendering ? `Rendering video... ${progress}%` : "Render animated video (WebM)"}
        </button>
        <p className="text-zinc-400 text-sm mt-2">Creates a downloadable 12-second motion-graphics video locally in your browser. This is not AI-generated footage or a full cinematic scene render.</p>
        {renderError && <p role="alert" className="text-red-300 mt-3">{renderError}</p>}
        {videoUrl && <div className="mt-5"><video controls playsInline src={videoUrl} className="w-full rounded-xl" /><a href={videoUrl} download="BrandNMotion-preview.webm" className="block mt-3 text-cyan-300 underline">Download rendered WebM</a></div>}

        <div className="mt-6 border border-zinc-700 rounded-2xl p-4">
          <h2 className="text-xl font-semibold">AI cinematic footage (Veo)</h2>
          <p className="text-sm text-zinc-400 mt-2">Generate a new AI-created cinematic video clip from your prompt. Provider billing approval and enabled Veo access are required; no charge is initiated until enabled.</p>
          <button onClick={makeCinematic} disabled={cinematicBusy || !prompt.trim()} className="w-full mt-3 bg-purple-500 text-white py-4 rounded-xl font-bold disabled:opacity-50">{cinematicBusy ? "Generating AI footage..." : "Generate AI cinematic footage"}</button>
          {cinematicStatus && <p role="status" className="mt-3 text-sm">{cinematicStatus}</p>}
          {cinematicUrl && <a href={cinematicUrl} className="block mt-3 text-cyan-300 underline">Download AI-generated MP4</a>}
        </div>

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