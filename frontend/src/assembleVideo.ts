export type Clip = { file: File; duration: number };
export type EditOptions = { clips: Clip[]; audio?: File | null; transitionSeconds?: number; onProgress?: (percent: number) => void };
export async function assembleVideo({ clips, audio, transitionSeconds = 0.5, onProgress }: EditOptions): Promise<Blob> {
  if (!clips.length || clips.length > 12) throw Error("Add 1 to 12 clips.");
  if (!HTMLCanvasElement.prototype.captureStream || typeof MediaRecorder === "undefined") throw Error("This browser cannot export video.");
  const mimeType = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"].find(type => MediaRecorder.isTypeSupported(type));
  if (!mimeType) throw Error("WebM recording is not supported in this browser.");
  const urls: string[] = [];
  const elements: HTMLVideoElement[] = [];
  let audioElement: HTMLAudioElement | undefined;
  let audioContext: AudioContext | undefined;
  let recorder: MediaRecorder | undefined;
  let frame = 0;
  let stream: MediaStream | undefined;
  try {
    for (const clip of clips) {
      if (!clip.file.type.startsWith("video/")) throw Error("Only video files can be added as clips.");
      const url = URL.createObjectURL(clip.file); urls.push(url);
      const video = document.createElement("video");
      video.src = url; video.muted = true; video.playsInline = true; video.preload = "auto";
      await new Promise<void>((resolve, reject) => {
        video.onloadedmetadata = () => resolve();
        video.onerror = () => reject(Error("Cannot decode " + clip.file.name));
        video.load();
      });
      if (!Number.isFinite(video.duration) || video.duration <= 0) throw Error("Invalid duration for " + clip.file.name);
      elements.push(video);
    }
    const durations = clips.map((clip, i) => Math.min(elements[i].duration, Math.max(0.5, clip.duration || elements[i].duration)));
    const overlap = Math.max(0, Math.min(1, transitionSeconds));
    const starts = durations.map((_, i) => durations.slice(0, i).reduce((a,b)=>a+b,0) - overlap*i);
    const total = starts[starts.length - 1] + durations[durations.length - 1];
    const canvas = document.createElement("canvas"); canvas.width = 1280; canvas.height = 720;
    const ctx = canvas.getContext("2d"); if (!ctx) throw Error("Canvas unavailable.");
    stream = canvas.captureStream(30);
    if (audio) {
      if (!audio.type.startsWith("audio/")) throw Error("Soundtrack must be an audio file.");
      audioContext = new AudioContext();
      const destination = audioContext.createMediaStreamDestination();
      audioElement = document.createElement("audio");
      const audioUrl = URL.createObjectURL(audio); urls.push(audioUrl); audioElement.src = audioUrl;
      audioElement.preload = "auto";
      const source = audioContext.createMediaElementSource(audioElement);
      source.connect(destination);
      stream.addTrack(destination.stream.getAudioTracks()[0]);
      await audioContext.resume();
    }
    const chunks: BlobPart[] = [];
    recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 4_000_000 });
    const result = new Promise<Blob>((resolve, reject) => {
      recorder!.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
      recorder!.onerror = () => reject(Error("MediaRecorder failed."));
      recorder!.onstop = () => chunks.length ? resolve(new Blob(chunks, { type: mimeType })) : reject(Error("Empty export."));
    });
    // Start all tracks at the same timeline origin; mute original clip sound.
    await elements[0].play();
    if (audioElement) await audioElement.play();
    const origin = performance.now();
    recorder.start(250);
    await new Promise<void>((resolve, reject) => {
      let previous = -1;
      const tick = async () => {
        const t = Math.min(total, (performance.now() - origin) / 1000);
        const active = starts.findLastIndex(start => start <= t);
        const index = Math.max(0, Math.min(elements.length - 1, active));
        if (index !== previous) {
          previous = index;
          elements[index].currentTime = Math.max(0, t - starts[index]);
          elements[index].play().catch(() => {});
        }
        const draw = (v: HTMLVideoElement, alpha: number) => {
          if (v.readyState < 2) return;
          ctx.globalAlpha = alpha;
          const scale = Math.max(canvas.width / v.videoWidth, canvas.height / v.videoHeight);
          const w = v.videoWidth * scale, h = v.videoHeight * scale;
          ctx.drawImage(v, (canvas.width - w)/2, (canvas.height - h)/2, w, h);
          ctx.globalAlpha = 1;
        };
        ctx.fillStyle = "#000"; ctx.fillRect(0,0,canvas.width,canvas.height);
        if (index > 0 && overlap > 0 && t < starts[index] + overlap) {
          draw(elements[index-1], 1);
          draw(elements[index], Math.max(0, Math.min(1,(t-starts[index])/overlap)));
        } else draw(elements[index], 1);
        onProgress?.(Math.round(t / total * 100));
        if (t >= total) { resolve(); return; }
        frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
      recorder!.addEventListener("error", () => reject(Error("Video encoder error.")), { once: true });
    });
    recorder.stop();
    const blob = await result;
    if (blob.size < 1000) throw Error("Export was unexpectedly small.");
    return blob;
  } finally {
    cancelAnimationFrame(frame);
    elements.forEach(v => { v.pause(); v.removeAttribute("src"); v.load(); });
    audioElement?.pause();
    if (recorder && recorder.state !== "inactive") recorder.stop();
    stream?.getTracks().forEach(track => track.stop());
    await audioContext?.close().catch(() => {});
    urls.forEach(url => URL.revokeObjectURL(url));
  }
}
