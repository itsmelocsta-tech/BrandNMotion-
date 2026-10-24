export type RenderOptions = { prompt: string; duration?: number; onProgress?: (value: number) => void };

export async function renderVideo({ prompt, duration = 12, onProgress }: RenderOptions): Promise<Blob> {
  if (!HTMLCanvasElement.prototype.captureStream || typeof MediaRecorder === "undefined") {
    throw new Error("Video recording is not supported in this browser. Try current Chrome or Edge.");
  }
  const mimeType = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"].find(type => MediaRecorder.isTypeSupported(type));
  if (!mimeType) throw new Error("This browser does not support WebM video recording.");
  const canvas = document.createElement("canvas");
  canvas.width = 1280;
  canvas.height = 720;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Unable to initialize video canvas.");
  const stream = canvas.captureStream(30);
  const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 3_000_000 });
  const chunks: BlobPart[] = [];
  const output = new Promise<Blob>((resolve, reject) => {
    recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
    recorder.onerror = () => reject(new Error("Video encoder failed."));
    recorder.onstop = () => chunks.length ? resolve(new Blob(chunks, { type: mimeType })) : reject(new Error("No video data was recorded."));
  });
  const words = prompt.trim().split(/\\s+/).filter(Boolean);
  const captions = [words.slice(0, 7).join(" "), words.slice(7, 15).join(" "), words.slice(15, 23).join(" ")].filter(Boolean);
  if (!captions.length) captions.push("BrandNMotion Studio");
  const started = performance.now();
  const draw = (elapsed: number) => {
    const t = Math.min(1, elapsed / (duration * 1000));
    const w = canvas.width, h = canvas.height;
    const hue = (215 + 110 * t) % 360;
    const bg = ctx.createLinearGradient(0, 0, w, h);
    bg.addColorStop(0, "hsl(" + hue + ",65%,8%)");
    bg.addColorStop(1, "hsl(" + ((hue + 75) % 360) + ",70%,23%)");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 28; i++) {
      const a = i * 2.399 + elapsed * 0.00016;
      const radius = (80 + i * 23 + elapsed * 0.012) % 850;
      const x = w / 2 + Math.cos(a) * radius;
      const y = h / 2 + Math.sin(a) * radius * 0.57;
      ctx.beginPath();
      ctx.arc(x, y, 6 + (i % 6) * 7, 0, Math.PI * 2);
      ctx.fillStyle = "hsla(" + ((hue + i * 13) % 360) + ",95%,70%,0.28)";
      ctx.fill();
    }
    ctx.textAlign = "center";
    ctx.fillStyle = "#ffffff";
    ctx.shadowColor = "#67e8f9";
    ctx.shadowBlur = 22;
    ctx.font = "bold 70px sans-serif";
    ctx.fillText("BRANDNMOTION", w / 2, 160);
    ctx.shadowBlur = 0;
    const scene = Math.min(captions.length - 1, Math.floor(t * captions.length));
    const caption = captions[scene].toUpperCase();
    ctx.font = "bold 46px sans-serif";
    const segments = caption.match(/.{1,35}(?:\\s|$)/g) || [caption];
    segments.slice(0, 3).forEach((line, i) => ctx.fillText(line.trim(), w / 2, 350 + i * 62, 1130));
    ctx.fillStyle = "#a5f3fc";
    ctx.font = "26px sans-serif";
    ctx.fillText("CINEMATIC MOTION PREVIEW", w / 2, 625);
    ctx.fillStyle = "#22d3ee";
    ctx.fillRect(0, h - 9, w * t, 9);
    onProgress?.(Math.round(t * 100));
  };
  draw(0);
  recorder.start(250);
  await new Promise<void>((resolve, reject) => {
    let frame = 0;
    const tick = () => {
      if (recorder.state === "inactive") { reject(new Error("Recording stopped unexpectedly.")); return; }
      const elapsed = performance.now() - started;
      draw(elapsed);
      if (elapsed >= duration * 1000) { resolve(); return; }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    recorder.addEventListener("error", () => { cancelAnimationFrame(frame); reject(new Error("Video recording failed.")); }, { once: true });
  }).finally(() => { if (recorder.state !== "inactive") recorder.stop(); });
  const blob = await output;
  stream.getTracks().forEach(track => track.stop());
  return blob;
}
