import fetch from 'node-fetch';
import { config } from '../src/config.js';
import { generateText } from './llm.js';
import { logger } from '../src/utils/logger.js';

interface TavilyResult { title: string; url: string; }
interface TavilyResponse { results?: TavilyResult[]; detail?: { error?: string }; }

const MAX_QUERY_LEN = 400;
const MAX_RETRIES = 3;
const INITIAL_BACKOFF = 500;

async function fetchWithRetry(url: string, options: any, retries = MAX_RETRIES, backoff = INITIAL_BACKOFF): Promise<any> {
  if (options.headers) {
    const safeKey = JSON.stringify(options.headers).replace(/Bearer (\w{5})\w+/, 'Bearer $1[REDACTED]');
    logger.debug(`➡️ POST ${url}\nHeaders: ${safeKey}\nBody: ${options.body}`);
  }

  try {
    const res = await fetch(url, options);
    const text = await res.text();
    if (!res.ok) {
      logger.error(`⬅️ ${res.status} ${res.statusText} from Tavily\nBody: ${text}`);
      throw new Error(`Tavily HTTP ${res.status}: ${text}`);
    }
    return { res, text };
  } catch (err: any) {
    if (retries > 0 && (err.message.includes('Tavily HTTP 5') || err.message.includes('NetworkError') || err.message.includes('ECONNRESET'))) {
      logger.warn(`Fetch failed (${err.message}). Retrying in ${backoff}ms…`);
      await new Promise(r => setTimeout(r, backoff));
      return fetchWithRetry(url, options, retries - 1, backoff * 2);
    }
    logger.error(`Final fetch error: ${err.message}`);
    throw err;
  }
}

export async function tavilySearch(query: string): Promise<string> {
  const key = config.search?.tavilyKey;
  logger.debug(`Loaded key prefix: ${key?.slice(0,5)}`);
  if (!key) throw new Error('Tavily key missing');

  let q = query.trim();
  if (q.length > MAX_QUERY_LEN) { logger.warn(`Trimming query from ${q.length}`); q = q.slice(0, MAX_QUERY_LEN); }

  const url = 'https://api.tavily.com/search';
  const payload = { query: q, max_results: 5, search_depth: 'basic', include_raw_content: false, include_answer: false };
  const options = {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  };

  const { res, text } = await fetchWithRetry(url, options);
  let data: TavilyResponse;
  try { data = JSON.parse(text); }
  catch { throw new Error('Invalid JSON from Tavily'); }

  if (data.detail?.error) throw new Error(`Tavily error: ${data.detail.error}`);
  const results = data.results;
  if (!results || results.length === 0) return 'No results found.';
  return results.map(r => `• ${r.title} – ${r.url}`).join('\n');
}

export async function smartSearch(prompt: string): Promise<string> {
  let query = prompt;
  try {
    const crafted = await generateText(`In 8 words or fewer, create a web‑search query for: ${prompt}`);
    if (crafted?.trim()) query = crafted.trim();
  } catch { logger.warn('LLM unavailable, using raw prompt'); }
  return tavilySearch(query);
}
