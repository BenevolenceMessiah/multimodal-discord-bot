import fetch from "node-fetch";
import { config } from "../src/config.js";
import { logger } from "../src/utils/logger.js";
import fs from 'fs/promises';
import path from 'path';

// Cache for resolved system messages
let resolvedSystemMessage: string | null = null;

/**
 * Load and resolve the system message from config
 * Handles both direct strings and file references
 */
async function loadSystemMessage(): Promise<string> {
  if (resolvedSystemMessage) return resolvedSystemMessage;
  
  const msg = config.systemMessage;
  
  if (typeof msg === 'string' && msg.startsWith('file:')) {
    try {
      // Extract file path and resolve relative to app root
      const filePath = path.resolve(process.cwd(), msg.slice(5).trim());
      resolvedSystemMessage = await fs.readFile(filePath, 'utf-8');
      logger.info(`Loaded system prompt from ${filePath}`);
    } catch (err) {
      logger.error(`Failed to load system prompt file: ${(err as Error).message}`);
      resolvedSystemMessage = "System prompt could not be loaded"; // Fallback
    }
  } else {
    resolvedSystemMessage = msg as string;
  }
  
  return resolvedSystemMessage;
}

// Main function to generate text, routes to the configured provider
export async function generateText(prompt: string): Promise<string> {
  if (config.textgenProvider === "ollama") {
    return generateOllama(prompt);
  }
  // Assuming "openrouter" is the only other text generation provider for now
  return generateOpenRouter(prompt);
}

// Ollama Specific
interface OllamaResponse {
  response: string;
}

async function generateOllama(prompt: string): Promise<string> {
  const temperature = parseFloat(config.temperature as any);
  const maxTokens = parseInt(config.maxTokens as any, 10);
  const contextLength = parseInt(config.contextLength as any, 10);
  
  const systemMessage = await loadSystemMessage(); // Use resolved prompt
  
  let keepAliveVal: number | string;
  if (typeof config.keepAlive === 'string' && /^\d+$/.test(config.keepAlive)) {
    keepAliveVal = parseInt(config.keepAlive, 10);
  } else if (typeof config.keepAlive === 'string' && (
      config.keepAlive.endsWith('m') || 
      config.keepAlive.endsWith('s') || 
      config.keepAlive.endsWith('h')
    )) {
    keepAliveVal = config.keepAlive;
  } else if (typeof config.keepAlive === 'number') {
    keepAliveVal = config.keepAlive;
  } else {
    keepAliveVal = "5m"; 
    logger.warn(`Unexpected keepAlive format: '${config.keepAlive}', defaulting to "5m" for Ollama.`);
  }

  const streamVal = Boolean(config.stream); 
  
  // Prepend system message to prompt
  const augmentedPrompt = `
  ### System:
  ${systemMessage}
  
  ### User:
  ${prompt}
  
  ### Assistant:
  `;
  
  const body = {
    model: config.modelOllama,
    prompt: augmentedPrompt,
    stream: streamVal,
    options: {
      temperature: temperature,
      num_predict: maxTokens,
      num_ctx: contextLength,
      stop: ["</s>", "<|im_end|>", "[END]", "Human:"],
    },
    keep_alive: keepAliveVal
  };

  const ollamaEndpoint = config.endpoints.ollama || 'http://localhost:11434';
  
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
  
  const data = (await res.json()) as OllamaResponse; 
  return data.response.trim();
}

// OpenRouter Specific
interface OpenRouterChoice {
  message: { content: string; role?: string };
}

interface OpenRouterResponse {
  choices?: OpenRouterChoice[];
}

async function generateOpenRouter(prompt: string): Promise<string> {
  const temperature = parseFloat(config.temperature as any);
  const maxTokens = parseInt(config.maxTokens as any, 10);
  const systemMessage = await loadSystemMessage(); // Use resolved prompt

  const body = {
    model: config.modelOpenrouter,
    temperature: temperature,
    max_tokens: maxTokens,
    messages: [
      { role: "system", content: systemMessage },
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

// Export individual generators
export { generateOllama, generateOpenRouter };