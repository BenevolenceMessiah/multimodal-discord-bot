import fetch from "node-fetch";
import { config } from "../src/config.js";
import { logger } from "../src/utils/logger.js";

// Main function to generate text, routes to the configured provider
export async function generateText(prompt: string): Promise<string> {
  if (config.textgenProvider === "ollama") {
    return generateOllama(prompt);
  }
  // Assuming "openrouter" is the only other text generation provider for now
  return generateOpenRouter(prompt);
}

// ----- Ollama Specific -----

interface OllamaResponse {
  response: string;
  // Add other fields from Ollama's response if they become necessary
  // e.g., done, context, total_duration, etc.
}

async function generateOllama(prompt: string): Promise<string> {
  // Ensure numeric and boolean values are correctly typed for Ollama
  const temperature = parseFloat(config.temperature as any);
  const maxTokens = parseInt(config.maxTokens as any, 10);
  const contextLength = parseInt(config.contextLength as any, 10);
  
  let keepAliveVal: number | string;
  if (typeof config.keepAlive === 'string' && /^\d+$/.test(config.keepAlive)) {
    keepAliveVal = parseInt(config.keepAlive, 10);
  } else if (typeof config.keepAlive === 'string' && (config.keepAlive.endsWith('m') || config.keepAlive.endsWith('s') || config.keepAlive.endsWith('h'))) {
    keepAliveVal = config.keepAlive;
  } else if (typeof config.keepAlive === 'number') {
    keepAliveVal = config.keepAlive;
  } else {
    keepAliveVal = "5m"; 
    logger.warn(`Unexpected keepAlive format: '${config.keepAlive}', defaulting to "5m" for Ollama.`);
  }

  // Correctly use config.stream, assuming it's already a boolean
  const streamVal = Boolean(config.stream); 
  // If you are absolutely sure config.stream is always a boolean and never undefined/null,
  // you could even simplify to: const streamVal = config.stream;

  const body = {
    model: config.modelOllama,
    prompt,
    stream: streamVal,
    options: {
      temperature: temperature,
      num_predict: maxTokens,
      num_ctx: contextLength,
      stop: ["</s>", "<|im_end|>", "[END]", "Human:"],
    },
    keep_alive: keepAliveVal
  };

  const ollamaEndpoint = config.endpoints.ollama || 'http://localhost:11434'; // Sensible default
  
  logger.debug(`Ollama request body: ${JSON.stringify(body)} to endpoint ${ollamaEndpoint}/api/generate`);

  const res = await fetch(`${ollamaEndpoint}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errorBodyText = await res.text();
    logger.error(`Ollama API error ${res.status}: ${errorBodyText} for prompt: "${prompt.substring(0,100)}..."`);
    throw new Error(`Ollama error ${res.status} for prompt: "${prompt.substring(0,100)}..."`);
  }
  
  // Assuming OllamaResponse type matches the actual non-streaming response structure
  const data = (await res.json()) as OllamaResponse; 
  return data.response.trim();
}

// ----- OpenRouter Specific -----

interface OpenRouterChoice {
  message: { content: string; role?: string }; // Role might be useful for logging/debugging
}
interface OpenRouterResponse {
  choices?: OpenRouterChoice[];
  // Add other fields from OpenRouter's response if needed
  // e.g., id, model, usage statistics, etc.
}

async function generateOpenRouter(prompt: string): Promise<string> {
  // Ensure numeric values are correctly typed before sending to OpenRouter
  const temperature = parseFloat(config.temperature as any);
  const maxTokens = parseInt(config.maxTokens as any, 10);

  const body = {
    model: config.modelOpenrouter,
    // stream: false, // For OpenRouter's /chat/completions, streaming is a separate setup (SSE)
                     // and `stream: false` is implicit for standard JSON response.
    temperature: temperature,
    max_tokens: maxTokens,
    messages: [
      { role: "system", content: config.systemMessage },
      { role: "user", content: prompt },
    ],
  };

  logger.debug(`OpenRouter request body: ${JSON.stringify(body)}`);

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.openrouterKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errorBodyText = await res.text();
    logger.error(`OpenRouter API error ${res.status}: ${errorBodyText}`);
    throw new Error(`OpenRouter error ${res.status}`);
  }
  
  const data = (await res.json()) as OpenRouterResponse;
  if (!data?.choices?.[0]?.message?.content) {
    logger.error('Invalid response structure from OpenRouter LLM API', data);
    throw new Error('Invalid response from LLM API (OpenRouter)');
  }
  return data.choices[0].message.content.trim();
}

// Export individual generators in case they are used directly elsewhere,
// though generateText is the primary intended public interface from this module.
export { generateOllama, generateOpenRouter };