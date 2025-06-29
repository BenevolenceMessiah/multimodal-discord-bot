/* ───────────────────────── splitByToolCalls.ts ─────────────────────────
 * Utility: break an LLM reply into      textBefore | calls[] | textAfter
 * Adds support for /music (nothing else changes — the regex lives in
 * toolCallRouter.ts). Multiline args wrapped in quotes/back-ticks survive,
 * because we only trim at *tool-call lines*, not inside wrappers.
 * -------------------------------------------------------------------- */

import { TOOL_CALL_RE } from './toolCallRouter.js';

export function splitByToolCalls(full: string): {
  textBefore: string;
  calls: string[];
  textAfter: string;
} {
  const parts: { text: string; call?: string }[] = [];
  let lastIdx = 0;

  // iterate over every tool-call match and slice the text around it
  for (const m of full.matchAll(TOOL_CALL_RE)) {
    const [line] = m;
    parts.push({ text: full.slice(lastIdx, m.index) });
    parts.push({ text: '', call: line.trim() });
    lastIdx = (m.index ?? 0) + line.length;
  }
  // push trailing chunk
  parts.push({ text: full.slice(lastIdx) });

  const calls = parts.filter(Boolean).map(p => p.call!).filter(Boolean);

  /* ── No tool calls? return everything in textBefore only ─────────── */
  if (calls.length === 0) {
    return { textBefore: full.trim(), calls: [], textAfter: '' };
  }

  /* ── At least one tool call present ──────────────────────────────── */
  const textBefore = (parts[0]?.text || '').trim();
  const textAfter  = (parts[parts.length - 1]?.text || '').trim();

  return { textBefore, calls, textAfter };
}
