/**
 * Splits long messages into Discord-safe chunks
 * @param content Message content to split
 * @param maxLength Max characters per chunk (default: 1800)
 * @returns Array of message chunks
 */
export function splitMessage(content: string, maxLength = 1800): string[] {
  const chunks: string[] = [];
  
  while (content.length > 0) {
    if (content.length <= maxLength) {
      chunks.push(content);
      break;
    }
    
    // Find last space within maxLength
    let splitIndex = content.lastIndexOf(' ', maxLength);
    if (splitIndex === -1) splitIndex = maxLength; // No space found
    
    chunks.push(content.substring(0, splitIndex));
    content = content.substring(splitIndex).trimStart();
  }
  
  return chunks;
}