export type PlannedShot = { id: number; title: string; prompt: string; seconds: number; camera: string; sound: string };
export type ShotPlan = { description: string; continuity: string; shots: PlannedShot[]; totalSeconds: number };
export function planShots(description: string, shotCount = 4): ShotPlan {
  const idea = description.trim();
  if (!idea || idea.length > 3000) throw new Error("Describe your scene in 1–3000 characters.");
  const count = Math.max(1, Math.min(8, Math.round(shotCount)));
  const continuity = "Keep the same lead character, clothing, face, hairstyle, location geography, time of day, weather, and cinematic style in every shot. Do not redesign or replace the character.";
  const cameras = ["Wide establishing tracking shot", "Medium handheld follow shot", "Tight reaction close-up", "Low-angle moving tracking shot", "Over-the-shoulder follow shot", "Wide reveal", "Side-profile tracking shot", "Close-up ending beat"];
  const beats = ["Establish the subject, setting, and immediate stakes", "Show the first urgent action", "Capture the emotional reaction and rising tension", "Escalate movement through the environment", "Show a new obstacle and a clear response", "Intensify the pursuit or central conflict", "Reveal a consequential change", "End on a compelling visual hook"];
  const shots = Array.from({length: count}, (_, i) => ({
    id: i + 1, title: "Shot " + (i + 1), seconds: 5,
    camera: cameras[i], sound: i === 0 ? "Establish location ambience" : "Continue ambience and action sounds without abrupt changes",
    prompt: "Scene concept: " + idea + ". " + beats[i] + ". Camera: " + cameras[i] + ". " + continuity + " Exactly one continuous five-second shot. Preserve spatial and emotional continuity with adjacent shots."
  }));
  return { description: idea, continuity, shots, totalSeconds: shots.reduce((n,s)=>n+s.seconds,0) };
}
