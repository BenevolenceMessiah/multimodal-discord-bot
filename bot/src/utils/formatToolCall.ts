/* utils/formatToolCall.ts
 * Pretty-print a raw “Tool call: /img something” line as
 * `Tool call: /img` ```something```
 * If the line doesn't match, return it unchanged.
 */

import { TOOL_CALL_RE } from './toolCallRouter.js';

/* Create a non-global clone of the router regex so .exec() yields groups */
const TOOL_CALL_SINGLE = new RegExp(
  TOOL_CALL_RE.source,            // same pattern body
  TOOL_CALL_RE.flags.replace('g', '') // drop the global flag
);

export function formatToolCallLine(line: string): string {
  const m = TOOL_CALL_SINGLE.exec(line);

  if (!m) return line.trim();               // fall back untouched

  const [, cmd = '', argRaw = ''] = m;      // groups always safe now
  const arg  = argRaw.trim().replace(/^“|”$/g, '"'); // normalise smart quotes
  const code = `\`Tool call: /${cmd}\``;    // inline back-tick
  const block = arg ? ` \`\`\`${arg}\`\`\`` : '';    // fenced block when arg exists
  return code + block;
}
