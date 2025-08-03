import { generateText } from './llm.js';
import { config } from '../src/config.js';
import { stripThought } from '../src/utils/stripThought.js';

/** Summarise Tavily link + snippet list into ≤600 words */
export async function autoSummarize(raw: string): Promise<string> {
  const prompt = [
    "You are a research assistant.",
    "The following web results were fetched by Tavily:",
    raw,
    "",
    "• Write a concise (≤600 words) answer to the user's original question.",
    "• Do not show the raw URLs.",
  ].join("\n");
  return stripThought(await generateText(prompt));
}
