/* ─────────────────────────── messageUtils.ts ───────────────────────────
 * Utility helpers:
 *   – withTyping  : keeps the typing indicator alive while an async task runs
 *   – splitMessage: chunks long strings to stay under Discord’s 2 000-char limit
 * --------------------------------------------------------------------- */

import {
  TextBasedChannel,
  DMChannel,
  NewsChannel,
  TextChannel,
  ThreadChannel,
} from "discord.js";
import { logger } from "./logger.js";

/* ───────────────────────── helper: type-guard ───────────────────────── */
/**
 * True if the channel instance exposes a usable `sendTyping()` method.
 *
 * The return type narrows to `TextBasedChannel & { sendTyping(): Promise<void> }`,
 * which satisfies TypeScript and avoids union members lacking the method
 * (e.g. `PartialGroupDMChannel`).
 */
function hasSendTyping(
  channel: TextBasedChannel | null
): channel is TextBasedChannel & { sendTyping(): Promise<void> } {
  return (
    !!channel &&
    typeof (channel as any).sendTyping === "function" && (
      channel instanceof TextChannel ||
      channel instanceof DMChannel ||
      channel instanceof NewsChannel ||
      channel instanceof ThreadChannel
    )
  );
}

/* ─────────────────────────── splitMessage ──────────────────────────── */
export function splitMessage(content: string, maxLen = 1_800): string[] {
  const chunks: string[] = [];

  while (content.length > 0) {
    if (content.length <= maxLen) {
      chunks.push(content);
      break;
    }

    let idx = content.lastIndexOf(" ", maxLen);
    if (idx === -1) idx = maxLen;

    chunks.push(content.slice(0, idx));
    content = content.slice(idx).trimStart();
  }

  return chunks;
}

/* ─────────────────────────── withTyping ────────────────────────────── */
export async function withTyping(
  channel: TextBasedChannel | null,
  fn: () => Promise<void>
): Promise<void> {
  if (!hasSendTyping(channel)) {
    await fn();
    return;
  }

  const sendTyping = () =>
    channel
      .sendTyping()
      .catch((e: Error) =>
        logger.error(`Failed to send typing indicator: ${e.message}`)
      );

  sendTyping();                       // initial indicator
  const timer = setInterval(sendTyping, 8_000);

  try {
    await fn();
  } finally {
    clearInterval(timer);
  }
}
