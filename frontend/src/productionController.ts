import type { ShotPlan } from "./shotPlanner";
export type ProductionStage = "pending" | "generating" | "ready" | "failed";
export type ProductionShot = { id: number; prompt: string; status: ProductionStage; videoUrl?: string; error?: string };
export type Production = { shots: ProductionShot[]; finished: boolean };
type Api = (url: string, init?: RequestInit) => Promise<Response>;
const pause = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));
export async function produceShots(plan: ShotPlan, engine: string, onUpdate: (state: Production) => void, api: Api = fetch, signal?: AbortSignal, aspectRatio = "16:9"): Promise<Production> {
  if (!["kling", "veo", "runway"].includes(engine)) throw Error("Select an enabled video provider.");
  if (!plan.shots.length || plan.shots.length > 8) throw Error("Plan must have 1â€“8 shots.");
  const shots: ProductionShot[] = plan.shots.map(s => ({ id: s.id, prompt: s.prompt.slice(0, 1500), status: "pending" }));
  const emit = () => onUpdate({ shots: shots.map(s => ({...s})), finished: shots.every(s => s.status === "ready") });
  emit();
  for (const shot of shots) {
    if (signal?.aborted) throw Error("Production cancelled.");
    shot.status = "generating"; emit();
    try {
      const response = await api("/api/engines", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ engine, prompt: shot.prompt, aspectRatio }), signal });
      const started = await response.json();
      if (!response.ok || !started.id) throw Error(started.error || "Provider did not start a generation.");
      let ready = false;
      for (let attempt = 0; attempt < 90; attempt++) {
        await pause(8000);
        if (signal?.aborted) throw Error("Production cancelled.");
        const status = await api("/api/engines?engine=" + encodeURIComponent(engine) + "&id=" + encodeURIComponent(started.id), { signal });
        const data = await status.json();
        if (["failed", "cancelled"].includes(data.status)) throw Error(data.error || "Provider generation failed.");
        if (!status.ok) throw Error(data.error || "Provider status check failed.");
        if (data.status === "completed") {
          const url = data.downloadUrl || data.videoUrl;
          if (!url) throw Error("Provider completed without a video URL.");
          shot.videoUrl = url; shot.status = "ready"; ready = true; emit(); break;
        }
      }
      if (!ready) throw Error("Generation timed out; check provider before retrying to avoid duplicate charges.");
    } catch (error) {
      shot.status = "failed"; shot.error = error instanceof Error ? error.message : "Generation failed"; emit();
      break; // Stop on the first failure to avoid spending on further shots.
    }
  }
  const result = { shots: shots.map(s => ({...s})), finished: shots.every(s => s.status === "ready") };
  onUpdate(result);
  return result;
}
