import { Collection, Snowflake } from "discord.js";
import { config } from "../src/config.js";

const memory = new Collection<Snowflake, string[]>();

export function pushMessage(channelId: Snowflake, author: string, content: string) {
  const arr = memory.get(channelId) ?? [];
  arr.push(`${author}: ${content}`);  // Add username prefix
  if (arr.length > config.maxLines) arr.shift();
  memory.set(channelId, arr);
}

export function getContext(channelId: Snowflake): string {
  return memory.get(channelId)?.join("\n") ?? "";
}

export function clearContext(channelId: Snowflake) {
  memory.delete(channelId);
}