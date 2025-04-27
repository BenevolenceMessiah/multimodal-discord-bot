import fetch from "node-fetch";
import { config } from "../config.js";
import { logger } from "../utils/logger.js";

export async function generateText(prompt: string): Promise<string> {
  if (config.textgenProvider === "ollama") {
    return generateOllama(prompt);
  }
  return generateOpenRouter(prompt);
}

async function generateOllama(prompt: string): Promise<string> {
  const body = {
    model: config.modelOllama,
    prompt,
    stream: config.stream,
    options: {
      temperature: config.temperature,
      num_predict: config.maxTokens,
      stop: ["</s>"]
    }
  };
  const res = await fetch(`${config.endpoints.ollama}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Ollama error ${res.status}`);
  const data = await res.json();
  return data.response as string;
}

async function generateOpenRouter(prompt: string): Promise<string> {
  const body = {
    model: config.modelOpenrouter,
    stream: false,
    temperature: config.temperature,
    max_tokens: config.maxTokens,
    messages: [
      { role: "system", content: config.systemMessage },
      { role: "user", content: prompt },
    ],
  };
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.openrouterKey}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`OpenRouter error ${res.status}`);
  const data = await res.json();
  return data.choices[0].message.content as string;
}