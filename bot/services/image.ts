import fetch from "node-fetch";
import { config } from "../src/config.js";

interface SDResponse {
  images?: string[];
}

export async function generateImage(prompt: string): Promise<Buffer> {
  const payload = {
    prompt,
    steps: 28,
  };
  const res = await fetch(`${config.endpoints.stablediffusion}/sdapi/v1/txt2img`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Stable Diffusion error ${res.status}`);
  
  // Type assertion ensures TypeScript knows the structure
  const data = (await res.json()) as SDResponse;
  if (!data?.images?.[0]) throw new Error("No image returned from API");
  return Buffer.from(data.images[0], "base64");
}