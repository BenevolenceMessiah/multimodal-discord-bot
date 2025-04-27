import fetch from "node-fetch";
import { config } from "../config.js";

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
  const data = await res.json();
  return Buffer.from(data.images[0], "base64");
}