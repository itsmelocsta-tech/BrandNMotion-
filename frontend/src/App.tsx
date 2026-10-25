import { useEffect, useState } from "react";
import axios from "axios";
import { renderVideo } from "./videoRenderer";
import { assembleVideo } from "./assembleVideo";
import { planShots, type ShotPlan } from "./shotPlanner";
import { produceShots, type Production } from "./productionController";

export default function App() {
  const [prompt, setPrompt] = useState("");
  const [shotPlan, setShotPlan] = useState<ShotPlan | null>(null);
  const [activeShot, setActiveShot] = useState(0);
  const [production, setProduction] = useState<Production | null>(null);
  const [producing, setProducing] = useState(false);
  const [approvedCost, setApprovedCost] = useState(false);
  const [estimatedRate, setEstimatedRate] = useState(0.12);
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [rendering, setRendering] = useState(false);
  const [progress, setProgress] = useState(0);
  const [videoUrl, setVideoUrl] = useState("");
  const [renderError, setRenderError] = useState("");
  const [cinematicStatus, setCinematicStatus] = useState("");
  const [cinematicUrl, setCinematicUrl] = useState("");
  const [cinematicBusy, setCinematicBusy] = useState(false);
  const [clips, setClips] = useState<File[]>([]);
  const [soundtrack, setSoundtrack] = useState<File | null>(null);
  const [assembledUrl, setAssembledUrl] = useState("");
  const [assemblyStatus, setAssemblyStatus] = useState("");
  const [assembling, setAssembling] = useState(false);
  const [assemblyProgress, setAssemblyProgress] = useState(0);
  const [crossfade, setCrossfade] = useState(0.5);
  const [soundtrackVolume, setSoundtrackVolume] = useState(1);
  const [engines, setEngines] = useState<{ id: string; label: string; available: boolean; description: string }[]>([]);
  const [selectedEngine, setSelectedEngine] = useState("auto");
  const [aspectRatio, setAspectRatio] = useState("16:9");
  useEffect(() => { axios.get("/api/engines").then(response => setEngines(response.data.engines || [])).catch(() => setCinematicStatus("Unable to load video engines.")); }, []);

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
    if (!approvedCost) { setCinematicStatus("Review the estimated generation cost and check approval before requesting paid footage."); return; }
    setCinematicBusy(true);
    setCinematicUrl("");
    setCinematicStatus("Submitting cinematic video request...");
    try {
      const engine = selectedEngine === "auto" ? (engines.find(item => item.available)?.id || "") : selectedEngine;
      if (!engine || !engines.some(item => item.id === engine && item.available)) { setCinematicStatus("No AI video provider is currently enabled. Connect a provider and approve generation costs before rendering."); return; }
      const scenePrompt = shotPlan?.shots[activeShot]?.prompt || prompt;
      const started = await axios.post("/api/engines", { engine, prompt: scenePrompt.slice(0,1500), aspectRatio });
      const id = started.data.id;
      if (!id) throw new Error("Video provider did not return a job identifier.");
      for (let i = 0; i < 90; i++) {
        await new Promise(resolve => setTimeout(resolve, 8000));
        const status = await axios.get("/api/engines", { params: { engine, id } });
        if (status.data.status === "completed") {
          setCinematicUrl(status.data.downloadUrl || status.data.videoUrl);
          setCinematicStatus("AI cinematic footage ready to download.");
          return;
        }
        setCinematicStatus("Generating cinematic footage... " + Math.round((i + 1) * 8 / 60) + " min elapsed");
      }
      setCinematicStatus("Still processing. Generation exceeded the wait window.");
    } catch (error) {
      const detail = axios.isAxiosError(error) ? error.response?.data?.error : error instanceof Error ? error.message : undefined;
      setCinematicStatus(typeof detail === "string" ? detail : "AI video generation failed.");
    } finally { setCinematicBusy(false); }
  };

  const runProduction = async () => {
    if (!shotPlan || !approvedCost || producing) return;
    const engine = selectedEngine === "auto" ? engines.find(item => item.available)?.id : selectedEngine;
    if (!engine || !engines.some(item => item.id === engine && item.available)) { setCinematicStatus("No enabled video provider. Production cannot start."); return; }
    setProducing(true); setApprovedCost(false);
    try { const result = await produceShots(shotPlan, engine, setProduction); setCinematicStatus(result.finished ? "All shots generated. Download the clips and assemble them below." : "Production stopped at a failed shot. No remaining shots were requested."); }
    catch (error) { setCinematicStatus(error instanceof Error ? error.message : "Production failed."); }
    finally { setProducing(false); }
  };

  const exportSequence = async () => {
    setAssembling(true); setAssemblyStatus(""); setAssemblyProgress(0);
    try {
      const blob = await assembleVideo({ clips: clips.map(file => ({ file, duration: 120 })), audio: soundtrack, transitionSeconds: crossfade, soundtrackVolume, onProgress: setAssemblyProgress });
      setAssembledUrl(old => { if (old) URL.revokeObjectURL(old); return URL.createObjectURL(blob); });
      setAssemblyStatus("Sequence exported successfully.");
    } catch (error) { setAssemblyStatus(error instanceof Error ? error.message : "Video assembly failed."); }
    finally { setAssembling(false); }
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

        <section className="mt-5 border border-zinc-700 rounded-xl p-4" aria-label="Automatic shot planner">
          <h2 className="text-xl font-semibold">Automatic shot planner</h2>
          <p className="text-zinc-400 text-sm mt-2">Turn one idea into a sequence with consistent characters, settings and camera direction. Planning does not generate paid footage.</p>
          <button className="w-full mt-3 bg-indigo-500 text-white py-3 rounded-lg font-bold disabled:opacity-50" disabled={!prompt.trim()} onClick={() => { try { setShotPlan(planShots(prompt)); setActiveShot(0); setApprovedCost(false); } catch (e) { setCinematicStatus(e instanceof Error ? e.message : "Planning failed"); } }}>Plan my shots (free)</button>
          {shotPlan && <div className="mt-4"><p className="text-sm">Continuity: {shotPlan.continuity}</p><p className="text-sm mt-2">Planned runtime: {shotPlan.totalSeconds} seconds</p><label className="block mt-3" htmlFor="shot-select">Select shot to generate</label><select id="shot-select" className="w-full bg-zinc-800 p-2 rounded-lg mt-1" value={activeShot} onChange={e => { setActiveShot(Number(e.target.value)); setApprovedCost(false); }}>{shotPlan.shots.map((shot,i) => <option value={i} key={shot.id}>{shot.title}: {shot.camera}</option>)}</select><p className="text-sm mt-3 whitespace-pre-wrap">{shotPlan.shots[activeShot].prompt}</p></div>}
        </section>
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
          <h2 className="text-xl font-semibold">Multi-engine AI cinematic studio</h2>
          <p className="text-sm text-zinc-400 mt-2">Choose a provider or automatic selection. AI footage requires provider credentials and billing approval. No paid generation is started unless enabled.</p>
          <label className="block mt-3 text-sm" htmlFor="engine">Video engine</label>
          <select id="engine" value={selectedEngine} onChange={event => setSelectedEngine(event.target.value)} className="w-full bg-zinc-800 p-3 rounded-lg mt-1">
            <option value="auto">Auto: first available engine</option>
            {engines.map(engine => <option key={engine.id} value={engine.id}>{engine.label} {engine.available ? "• Ready" : "• Not configured"}</option>)}
          </select>
          <label className="block mt-3 text-sm" htmlFor="aspect">Aspect ratio</label>
          <select id="aspect" value={aspectRatio} onChange={event => setAspectRatio(event.target.value)} className="w-full bg-zinc-800 p-3 rounded-lg mt-1"><option value="16:9">Landscape 16:9</option><option value="9:16">Vertical 9:16</option></select>
          <label htmlFor="cost-rate" className="block mt-3 text-sm">Estimated provider rate (USD per second; verify with provider)</label>
          <select id="cost-rate" value={estimatedRate} onChange={e => { setEstimatedRate(Number(e.target.value)); setApprovedCost(false); }} className="w-full bg-zinc-800 p-3 rounded-lg mt-1"><option value={0.05}>Budget estimate: $0.05/sec</option><option value={0.12}>Premium estimate: $0.12/sec</option><option value={0.4}>High-end estimate: $0.40/sec</option></select>
          <p className="mt-3 text-sm">Estimated cost for one 5-second generation: <strong>${(5 * estimatedRate).toFixed(2)}</strong>. Estimated cost for all {shotPlan?.shots.length || 1} shots: <strong>${(5 * estimatedRate * (shotPlan?.shots.length || 1)).toFixed(2)}</strong>. Estimates only, not provider quotes; retries cost extra. Each click requests one shot.</p>
          <label className="flex items-start gap-2 mt-3 text-sm"><input type="checkbox" checked={approvedCost} onChange={e => setApprovedCost(e.target.checked)} /> I approve provider charges for the selected shot, or all planned shots if I select Generate all. The estimate is not a guaranteed maximum.</label>
          {shotPlan && <button className="w-full mt-3 bg-amber-500 text-black py-3 rounded-lg font-bold disabled:opacity-50" disabled={!approvedCost || producing || !engines.some(e => e.available)} onClick={runProduction}>{producing ? "Producing shots..." : "Generate all planned shots (paid)"}</button>}
          {production && <ol className="mt-3 text-sm list-decimal ml-5">{production.shots.map(shot => <li key={shot.id}>Shot {shot.id}: {shot.status} {shot.videoUrl && <a className="underline text-cyan-300" href={shot.videoUrl}>Download clip</a>} {shot.error && <span role="alert">{shot.error}</span>}</li>)}</ol>}
          <button onClick={makeCinematic} disabled={cinematicBusy || !prompt.trim() || !approvedCost} className="w-full mt-3 bg-purple-500 text-white py-4 rounded-xl font-bold disabled:opacity-50">{cinematicBusy ? "Generating AI footage..." : "Generate AI cinematic footage"}</button>
          {cinematicStatus && <p role="status" className="mt-3 text-sm">{cinematicStatus}</p>}
          {cinematicUrl && <a href={cinematicUrl} className="block mt-3 text-cyan-300 underline">Download AI-generated MP4</a>}
        </div>

        <section className="mt-6 border border-zinc-700 rounded-2xl p-4" aria-label="Video sequence editor">
          <h2 className="text-xl font-semibold">Video sequence editor</h2>
          <p className="text-sm text-zinc-400 mt-2">Combine up to 12 downloaded video clips in order, blend scenes with half-second crossfades, add a soundtrack, and export a WebM movie. Works with your own clips or generated footage.</p>
          <label htmlFor="clips" className="block mt-4 text-sm">Video clips (selected order)</label>
          <input id="clips" aria-label="Video clips" type="file" accept="video/*" multiple className="w-full mt-2" onChange={event => setClips(Array.from(event.target.files || []).slice(0,12))} />
          {clips.length > 0 && <ol className="list-decimal ml-5 text-sm mt-2">{clips.map((file,i) => <li key={i}>{file.name}</li>)}</ol>}
          <label htmlFor="soundtrack" className="block mt-4 text-sm">Soundtrack (optional)</label>
          <input id="soundtrack" aria-label="Soundtrack" type="file" accept="audio/*" className="w-full mt-2" onChange={event => setSoundtrack(event.target.files?.[0] || null)} />
          <label htmlFor="crossfade" className="block mt-3 text-sm">Crossfade: {crossfade.toFixed(1)} seconds</label>
          <input id="crossfade" type="range" min="0" max="1" step="0.1" value={crossfade} onChange={e => setCrossfade(Number(e.target.value))} className="w-full" />
          <label htmlFor="soundtrack-volume" className="block mt-3 text-sm">Soundtrack volume: {Math.round(soundtrackVolume * 100)}%</label>
          <input id="soundtrack-volume" type="range" min="0" max="2" step="0.1" value={soundtrackVolume} onChange={e => setSoundtrackVolume(Number(e.target.value))} className="w-full" />
          <button onClick={exportSequence} disabled={assembling || !clips.length} className="w-full mt-4 bg-emerald-500 text-black py-4 rounded-xl font-bold disabled:opacity-50">{assembling ? `Exporting sequence ${assemblyProgress}%` : "Stitch clips and export movie"}</button>
          {assemblyStatus && <p role="status" className="text-sm mt-3">{assemblyStatus}</p>}
          {assembledUrl && <div className="mt-4"><video controls playsInline src={assembledUrl} className="w-full rounded-xl" /><a href={assembledUrl} download="BrandNMotion-sequence.webm" className="block mt-2 underline text-cyan-300">Download stitched movie</a></div>}
        </section>

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