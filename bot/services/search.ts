import fetch from 'node-fetch';
import { config } from '../src/config.js';
import { generateText } from './llm.js';
import { logger } from '../src/utils/logger.js';

interface TavilyResult {
  title: string;
  url: string;
}
interface TavilyResponse {
  results?: TavilyResult[];
}

export async function tavilySearch(query: string): Promise<string> {
  const key = config.search?.tavilyKey;
  if (!key) throw new Error('Tavily key missing');
  const url = `https://api.tavily.com/search?api_key=${key}&query=${encodeURIComponent(query)}&max_results=5`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Tavily ${res.status}`);
  
  // Type assertion for Tavily response
  const data = (await res.json()) as TavilyResponse;
  return data.results?.map((r: TavilyResult) => `• ${r.title} – ${r.url}`).join('\n') || 'No results';
}

export async function smartSearch(prompt: string): Promise<string> {
  let query = prompt;
  try {
    const crafted = await generateText(`In 8 words or fewer, create a web‑search query for: ${prompt}`);
    query = crafted.trim();
  } catch (err) {
    logger.warn('LLM unavailable, using raw prompt');
  }
  return tavilySearch(query);
}