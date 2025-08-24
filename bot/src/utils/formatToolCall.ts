/* utils/formatToolCall.ts
 * Pretty-print a raw Tool-call slice as:
 *
 *   `Tool call: /cmd`
 *   ```<full-arg>```
 *
 * If the slice doesn't match, return it unchanged (trimmed).
 */

import { TOOL_LINE_RE } from './regexes.js';

/* Non-global clone so .exec() is deterministic & group-aware */
const SINGLE = new RegExp(TOOL_LINE_RE.source, TOOL_LINE_RE.flags.replace('g', ''));

export function formatToolCallLine(slice: string): string {
  const text = String(slice ?? '');
  const m = SINGLE.exec(text);
  SINGLE.lastIndex = 0;

  if (!m) return text.trim();

  const cmd = (m.groups?.cmd ?? '').trim();
  const rawArg = String(m.groups?.rest ?? '');
  const arg = normalizeEdgeQuotes(rawArg);

  const code = `\`Tool call: ${cmd}\``;

  const t = arg.trim();
  if (!t) return code;

  // If arg is already a fenced block, don’t double-wrap — preserve as-is on a new line.
  if (t.startsWith('```')) return `${code}\n${t}`;

  // Otherwise show the arg in a fenced block (works great for multi-line quotes).
  return `${code}\n\`\`\`\n${arg}\n\`\`\``;
}

function normalizeEdgeQuotes(s: string): string {
  return String(s ?? '')
    .replace(/^“/, '"').replace(/”$/, '"')
    .replace(/^‘/, "'").replace(/’$/, "'")
    .trim();
}
