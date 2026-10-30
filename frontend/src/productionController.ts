import type { ShotPlan } from "./shotPlanner";
export type ProductionStage = "pending" | "generating" | "ready" | "failed";
export type ProductionShot = { id: number; prompt: string; status: ProductionStage; jobId?: string; videoUrl?: string; error?: string };
export type Production = { shots: ProductionShot[]; finished: boolean; engine: string; aspectRatio: string; fingerprint: string };
type Api = (url: string, init?: RequestInit) => Promise<Response>;
export const productionFingerprint = (plan: ShotPlan) => JSON.stringify(plan.shots.map(s => [s.id, s.prompt.slice(0,1500), s.seconds]));
const pause = (ms: number, signal?: AbortSignal) => new Promise<void>((resolve, reject) => {
  if (signal?.aborted) { reject(Error("Production paused.")); return; }
  const abort = () => { clearTimeout(timer); reject(Error("Production paused.")); };
  const timer = setTimeout(() => { signal?.removeEventListener("abort", abort); resolve(); }, ms);
  signal?.addEventListener("abort", abort, { once: true });
});
export async function produceShots(plan: ShotPlan, engine: string, onUpdate: (state: Production) => void, api: Api = fetch, signal?: AbortSignal, aspectRatio = "16:9", previous?: Production | null, wait = pause): Promise<Production> {
  if (!["kling", "veo", "runway"].includes(engine)) throw Error("Select an enabled video provider.");
  if (!plan.shots.length || plan.shots.length > 8) throw Error("Plan must have 1–8 shots.");
  const fingerprint = productionFingerprint(plan);
  if (previous && (previous.fingerprint !== fingerprint || previous.engine !== engine || previous.aspectRatio !== aspectRatio)) throw Error("Resume with the original plan, provider and aspect ratio, or start a new plan.");
  const state: Production = previous ? structuredClone(previous) : { engine, aspectRatio, fingerprint, shots: plan.shots.map(s => ({ id: s.id, prompt: s.prompt.slice(0,1500), status: "pending" })), finished: false };
  const emit = () => { state.finished = state.shots.every(s => s.status === "ready"); onUpdate(structuredClone(state)); };
  emit();
  for (const shot of state.shots) {
    if (signal?.aborted) break;
    if (shot.status === "ready") continue;
    // A lost submission response may already represent a paid job. Never auto-resubmit it.
    if (shot.status !== "pending" && !shot.jobId) throw Error("Submission outcome is unknown. Check the provider before starting another job to avoid duplicate charges.");
    shot.status = "generating"; shot.error = undefined; emit();
    try {
      if (!shot.jobId) {
        const response = await api("/api/engines", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ engine, prompt: shot.prompt, aspectRatio }), signal });
        const started = await response.json();
        if (!response.ok || !started.id) throw Error(started.error || "Provider did not start a generation.");
        shot.jobId = started.id; emit(); // Persist the provider ID before the first poll.
      }
      let ready = false;
      for (let attempt = 0; attempt < 90; attempt++) {
        await wait(8000, signal);
        if (signal?.aborted) throw Error("Production paused.");
        const status = await api("/api/engines?engine=" + encodeURIComponent(engine) + "&id=" + encodeURIComponent(shot.jobId!), { signal });
        const data = await status.json();
        if (["failed", "cancelled"].includes(data.status)) throw Error(data.error || "Provider generation failed.");
        if (!status.ok) throw Error(data.error || "Provider status check failed.");
        if (data.status === "completed") {
          const url = data.downloadUrl || data.videoUrl;
          if (!url) throw Error("Provider completed without a video URL.");
          shot.videoUrl = url; shot.status = "ready"; ready = true; emit(); break;
        }
      }
      if (!ready) throw Error("Still processing. Resume to check the existing job; do not generate it again.");
    } catch (error) {
      shot.status = "failed"; shot.error = error instanceof Error ? error.message : "Generation failed"; emit(); break;
    }
  }
  emit(); return structuredClone(state);
}
