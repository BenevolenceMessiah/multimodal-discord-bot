/* utils/stripThought.ts -------------------------------------------------- */
export function stripThought(content: string): string {
  //  <think> … </think>            or            <thinking> … </thinking>
  return content.replace(/<think(?:ing)?>([\s\S]*?)<\/think(?:ing)?>\n?/gi, '')
                .trim();
}
