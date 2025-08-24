/* ───────────────────────── splitByToolCalls.ts ─────────────────────────
 * Break an LLM reply into:  textBefore | calls[] | textAfter
 *
 * Guarantees / Fixes:
 *  • Ignore tool-calls inside thinking blocks (<think>…</think>, <thinking>…</thinking>,
 *    and fenced ```think / ```thinking / ```thought(s) blocks).
 *  • Treat a header-only line (“Tool call: /music”) as a valid call.
 *  • Extend the call with its argument when it is:
 *      – an immediate fenced block on the next line, OR
 *      – a quoted string starting on the header line, OR
 *      – a quoted string starting on the next line.
 *  • Handle a trailing inline backtick after the header (e.g. `Tool call: /img`).
 * -------------------------------------------------------------------- */

import { TOOL_CALL_RE, TOOL_LINE_RE, THINK_BLOCK_RE, THINK_FENCE_START } from './regexes.js';

export function splitByToolCalls(full: string): {
  textBefore: string;
  calls: string[];
  textAfter: string;
} {
  const source = String(full ?? '');
  if (!source.trim()) return { textBefore: '', calls: [], textAfter: '' };

  // 1) Mask thinking blocks so the scanner never matches inside them.
  const masked = maskThoughtBlocks(source);

  // 2) Scan for tool-call headers in masked; build precise slices from original.
  const parts: { text: string; call?: string }[] = [];
  const seenStarts = new Set<number>();
  let cursor = 0;

  for (const m of masked.matchAll(TOOL_CALL_RE)) {
    let start = m.index ?? 0;
    const headerRaw = m[0];

    // If scanner captured a leading newline, drop it so we start at the 'T'
    if (headerRaw.startsWith('\n')) start += 1;
    if (seenStarts.has(start)) continue;
    seenStarts.add(start);

    // Push narration before this call (from original, not masked)
    parts.push({ text: source.slice(cursor, start) });

    // Compute the header line end in original. The scanner stops at EOL,
    // so endOfHeader is the position right after the matched header segment.
    const endOfHeader = start + headerRaw.length;

    // Extend with the following argument block (if any)
    const extendedEnd = extendArgumentBlock(source, start, endOfHeader);

    const fullCall = source.slice(start, extendedEnd).trim();
    parts.push({ text: '', call: fullCall });

    cursor = extendedEnd;
  }

  // 3) Trailing narration
  parts.push({ text: source.slice(cursor) });

  const calls = parts.map(p => p.call!).filter(Boolean);
  if (calls.length === 0) {
    // No calls found → everything is narration
    return { textBefore: source.trim(), calls: [], textAfter: '' };
  }

  const textBefore = (parts[0]?.text || '').trim();
  const textAfter  = (parts[parts.length - 1]?.text || '').trim();
  return { textBefore, calls, textAfter };
}

/* ────────────────────────── internals ──────────────────────────── */

/**
 * Try to extend a tool-call header that begins at `headerStart`:
 *   - a triple-backtick fence immediately after the header (skipping whitespace),
 *   - a multi-line quoted string that begins on the header line, or
 *   - a multi-line quoted string that begins on the next non-space line.
 *
 * Also skips a trailing inline backtick ` immediately after the header,
 * which happens when the model writes the header as inline code:
 *   `Tool call: /music`
 */
function extendArgumentBlock(src: string, headerStart: number, endOfHeader: number): number {
  const lineEnd = src.indexOf('\n', headerStart);
  const headerLine = src.slice(headerStart, lineEnd === -1 ? src.length : lineEnd);

  // Parse header line to inspect same-line rest
  const lm = TOOL_LINE_RE.exec(headerLine);
  TOOL_LINE_RE.lastIndex = 0;
  const restOnHeader = (lm?.groups?.rest ?? '').trim();

  // Convenience scanner for multi-line quotes
  const scanQuoteClose = (from: number, quote: '"' | "'"): number => {
    for (let i = from; i < src.length; i++) {
      if (src[i] === quote && src[i - 1] !== '\\') return i;
    }
    return -1;
  };

  // -------------- Case A: same-line quote begins here ---------------
  const first = restOnHeader[0] as '"' | "'" | undefined;
  if ((first === '"' || first === "'") && !closesOnSameLine(restOnHeader, first)) {
    const closeIdx = scanQuoteClose(endOfHeader, first);
    return closeIdx !== -1 ? closeIdx + 1 : src.length;
  }

  // -------------- Case B: look after header (next non-space char) ---
  let i = endOfHeader;

  // Skip a trailing inline-code closing backtick right after /cmd`
  if (src[i] === '`') {
    while (src[i] === '`') i++;
  }

  // Skip whitespace (including newlines)
  while (i < src.length && /\s/.test(src[i])) i++;

  // (B1) immediate fenced block ```…```
  if (src.slice(i, i + 3) === '```') {
    const fenceClose = src.indexOf('```', i + 3);
    return fenceClose !== -1 ? fenceClose + 3 : src.length;
  }

  // (B2) a quote begins on the next line
  const ch = src[i] as '"' | "'" | undefined;
  if (ch === '"' || ch === "'") {
    const closeIdx = scanQuoteClose(i + 1, ch);
    return closeIdx !== -1 ? closeIdx + 1 : src.length;
  }

  // Default: header line only
  return endOfHeader;
}

function closesOnSameLine(arg: string, quote: '"' | "'"): boolean {
  const trimmed = arg.replace(/\s+$/, '');
  if (!trimmed || trimmed[0] !== quote) return false;
  if (trimmed[trimmed.length - 1] !== quote) return false;
  // not closed if last quote is escaped
  return trimmed.length < 2 || trimmed[trimmed.length - 2] !== '\\';
}

/**
 * Replace all characters inside recognized “thinking” blocks with spaces
 * (preserve indices for the scanner).
 */
function maskThoughtBlocks(input: string): string {
  const chars = Array.from(input);
  const ranges: Array<[number, number]> = [];

  collectTagRanges(input, /<\s*think\s*>/gi, /<\s*\/\s*think\s*>/gi, ranges);
  collectTagRanges(input, /<\s*thinking\s*>/gi, /<\s*\/\s*thinking\s*>/gi, ranges);
  collectFenceRanges(input, THINK_FENCE_START, /```/g, ranges);

  for (const [s, e] of mergeRanges(ranges)) {
    for (let i = s; i < e && i < chars.length; i++) chars[i] = ' ';
  }
  return chars.join('');
}

function collectTagRanges(text: string, startRe: RegExp, endRe: RegExp, out: Array<[number, number]>) {
  startRe.lastIndex = 0; endRe.lastIndex = 0;
  let mStart: RegExpExecArray | null;
  while ((mStart = startRe.exec(text)) !== null) {
    const s = mStart.index;
    endRe.lastIndex = startRe.lastIndex;
    const mEnd = endRe.exec(text);
    const e = mEnd ? (mEnd.index + mEnd[0].length) : text.length;
    out.push([s, e]);
    startRe.lastIndex = e;
  }
}

function collectFenceRanges(text: string, fenceStartRe: RegExp, fenceEndRe: RegExp, out: Array<[number, number]>) {
  fenceStartRe.lastIndex = 0; fenceEndRe.lastIndex = 0;
  let mStart: RegExpExecArray | null;
  while ((mStart = fenceStartRe.exec(text)) !== null) {
    const s = mStart.index;
    fenceEndRe.lastIndex = fenceStartRe.lastIndex;
    const mEnd = fenceEndRe.exec(text);
    const e = mEnd ? (mEnd.index + mEnd[0].length) : text.length;
    out.push([s, e]);
    fenceStartRe.lastIndex = e;
  }
}

function mergeRanges(ranges: Array<[number, number]>): Array<[number, number]> {
  if (ranges.length <= 1) return ranges.slice().sort((a, b) => a[0] - b[0]);
  const sorted = ranges.slice().sort((a, b) => a[0] - b[0]);
  const out: Array<[number, number]> = [];
  let [s, e] = sorted[0];
  for (let i = 1; i < sorted.length; i++) {
    const [ns, ne] = sorted[i];
    if (ns <= e) e = Math.max(e, ne);
    else { out.push([s, e]); [s, e] = [ns, ne]; }
  }
  out.push([s, e]);
  return out;
}
