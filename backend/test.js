import { askGemini } from "./gemini.js";

const result = await askGemini(
  "Create a cinematic futuristic trap music video concept."
);

console.log(result);
