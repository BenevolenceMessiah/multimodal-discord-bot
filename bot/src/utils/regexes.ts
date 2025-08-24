/* ───────────────────────────── regexes.ts ─────────────────────────────
 * Shared regex used by the router, splitter, and formatter.
 *
 * TOOL_LINE_RE
 *   – Parses a *single* tool-call “line” (we commonly feed it a canonical
 *     slice that starts at “Tool call: …”). `rest` uses dotAll so it can
 *     hold multi-line text (the splitter already chose the right span).
 *
 * TOOL_CALL_RE
 *   – Scanner used by the splitter to find just the *header* occurrence
 *     anywhere in the model’s reply. IMPORTANT: it accepts headers with
 *     OR without same-line args. (rest is optional)
 *
 * THINK_BLOCK_RE / THINK_FENCE_START
 *   – Utilities for thought masking (used by strip / splitter).
 * ------------------------------------------------------------------- */

export const TOOL_LINE_RE =
  /^\s*`?\s*tool\s*call\s*:\s*(?<cmd>\/[a-z0-9-]+)\s*(?<rest>.*)$/is;

/**
 * Header scanner:
 *  - optional leading newline
 *  - optional leading backtick before “tool call:”
 *  - captures only the command on the header
 *  - optional rest (if present on the same line)
 *
 * Examples matched:
 *   Tool call: /music
 *   Tool call: /music "arg starts here"
 *   `Tool call: /web`  (inline code header)
 */
export const TOOL_CALL_RE =
  /(?:^|\n)\s*`?\s*tool\s*call\s*:\s*\/(?<cmd>[a-z0-9-]+)(?:\s+(?<rest>[^\n]*))?/gim;

/** Tag-style think sections. */
export const THINK_BLOCK_RE =
  /<\s*(?:think|thinking)\s*>[\s\S]*?<\s*\/\s*(?:think|thinking)\s*>/gi;

/** Fenced think sections (```think / ```thinking / ```thought / ```thoughts). */
export const THINK_FENCE_START =
  /```(?:\s*(?:think|thinking|thoughts?)[^\n]*)\n/gi;
