/* utils/stripThought.ts
 * Remove model “thinking” content from a string:
 *   - <think>…</think> or <thinking>…</thinking> (case-insensitive)
 *   - fenced blocks whose opener line is ```think / ```thinking / ```thought(s)
 *
 * This is deliberately aggressive and safe to run on narration around tools.
 */

export function stripThought(input: string): string {
  let s = String(input ?? '');

  // Remove tag blocks first
  s = s.replace(/<\s*(?:think|thinking)\s*>[\s\S]*?<\s*\/\s*(?:think|thinking)\s*>/gi, '');

  // Remove fenced think/thinking/thought(s) blocks
  s = s.replace(/```(?:\s*(?:think|thinking|thoughts?)[^\n]*)\n[\s\S]*?```/gi, '');

  // Tidy excess blank lines left behind
  s = s.replace(/\n{3,}/g, '\n\n').trim();

  return s;
}
export default stripThought;
