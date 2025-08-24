// bot/src/utils/toolCallPatterns.ts
/* ───────────────────────── toolCallPatterns.ts ─────────────────────────
 * Centralized regex for tool-call parsing.
 * - TOOL_LINE_RE: single-line, anchored, strict (use in router)
 * - TOOL_CALL_RE: multi-match scanner (use in splitters)
 * --------------------------------------------------------------------- */

export const TOOL_LINE_RE =
  /^\s*`?\s*tool\s*call\s*:\s*(?<cmd>\/[a-z0-9-]+)\s*(?<rest>.*)$/i;

export const TOOL_CALL_RE =
  /(?:^|\n)\s*`?\s*tool\s*call\s*:\s*\/([a-z0-9-]+)\s+([^\n]+)/gim;
