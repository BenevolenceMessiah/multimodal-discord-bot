/* utils/toolPatterns.ts ---------------------------------------------------
 * Shared regex patterns for detecting AI-initiated tool calls.
 * These are intentionally strict and line-anchored.
 * ---------------------------------------------------------------------- */

/** Strict single-line match (used by tryHandleToolCall) */
export const TOOL_LINE_RE =
  /^\s*`?\s*tool\s*call\s*:\s*(?<cmd>\/[a-z0-9-]+)\s*(?<rest>.*)$/i;

/** Multi-match regex for scanners (e.g., splitByToolCalls) */
export const TOOL_CALL_RE =
  /(?:^|\n)\s*`?\s*tool\s*call\s*:\s*\/([a-z0-9-]+)\s+([^\n]+)/gim;
