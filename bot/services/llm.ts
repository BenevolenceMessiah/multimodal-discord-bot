import fetch from "node-fetch";
import { config } from "../src/config.js";
import { logger } from "../src/utils/logger.js";

export async function generateText(prompt: string): Promise<string> {
  if (config.textgenProvider === "ollama") {
    return generateOllama(prompt);
  }
  return generateOpenRouter(prompt);
}

interface OllamaResponse {
  response: string;
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
  
  // Type assertion for Ollama response
  const data = (await res.json()) as OllamaResponse;
  return data.response;
}

interface OpenRouterChoice {
  message: { content: string };
}
interface OpenRouterResponse {
  choices?: OpenRouterChoice[];
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
  
  // Type assertion for OpenRouter response
  const data = (await res.json()) as OpenRouterResponse;
  if (!data?.choices?.[0]?.message?.content) {
    throw new Error('Invalid response from LLM API');
  }
  return data.choices[0].message.content;
}