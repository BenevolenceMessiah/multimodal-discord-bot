import {
  ChannelType,
  TextBasedChannel,
  NewsChannel,
  ThreadChannel,
  DMChannel,
  TextChannel,
  EmbedBuilder,
} from "discord.js";
import fetch from "node-fetch";

import { generateImage }   from "../../services/image.js";
import { generateMusic }   from "../../services/ace.js";        // NEW
import { chunkAudio }      from "../../src/utils/audio.js";         // NEW
import { config }          from "../config.js";

/* ------------------------------------------------------------------ */
export async function withTyping(
  channel: TextBasedChannel | null,
  fn: () => Promise<void>,
): Promise<void> { /* … unchanged … */ }

/* ──────────────── Helper types ───────────────── */
type ToolCall = { cmd: string; arg: string };
interface TavilyResult { title: string; url: string; snippet: string }

/* ─────────────── Regex + utils ───────────────── */
export const TOOL_CALL_RE =
  /(?:^|\n)\s*(?:tool\s*call|toolcall)\s*:\s*\/(\w+)\s+([^\n]+)/gim;

const WRAPPERS: Record<string, string> = {
  '"': '"', "'": "'", "(": ")", "[": "]", "{": "}", "`": "`",
};
const stripWrapper = (raw: string) => {
  const t = raw.trim();
  const w = WRAPPERS[t[0]];
  return w && t.endsWith(w) ? t.slice(1, -1).trim() : t;
};
const isSendableChannel = (c: TextBasedChannel) =>
  [
    ChannelType.GuildText,
    ChannelType.GuildAnnouncement,
    ChannelType.PublicThread,
    ChannelType.PrivateThread,
    ChannelType.AnnouncementThread,
    ChannelType.DM,
  ].includes(c.type);

/* ───────────── MAIN DISPATCHER ───────────── */
export async function tryHandleToolCall(
  rawText: string,
  channel: TextBasedChannel,
): Promise<boolean> {
  if (!config.agenticToolcall) return false;

  const calls: ToolCall[] = [];
  for (const [, cmd, arg] of rawText.matchAll(TOOL_CALL_RE)) {
    calls.push({ cmd: cmd.toLowerCase(), arg: stripWrapper(arg) });
  }
  if (!calls.length) return false;

  await Promise.all(
    calls.map(async ({ cmd, arg }) => {
      try {
        switch (cmd) {
          /* ---------- /img ---------- */
          case "img": {
            const attachment = await generateImage(arg);
            if (isSendableChannel(channel))
              await (channel as TextChannel | NewsChannel | ThreadChannel | DMChannel).send({
                content: `🖼️ **Generated:** ${arg}`,
                files: [{ attachment: attachment.attachment, name: "image.png" }],
              });
            break;
          }

          /* ---------- /web ---------- */
          case "web": {
            if (!process.env.TAVILY_KEY) {
              if (isSendableChannel(channel))
                await (channel as TextChannel | NewsChannel | ThreadChannel | DMChannel).send(
                  "⚠️ Tavily key missing – set `TAVILY_KEY` in your env.",
                );
              return;
            }
            const key = process.env.TAVILY_KEY;
            const url = `https://api.tavily.com/search?api_key=${key}&query=${encodeURIComponent(arg)}&max_results=5`;
            const res = await fetch(url);
            if (!res.ok) throw new Error(`Tavily error: ${res.status}`);

            const { results = [] } = (await res.json()) as { results: TavilyResult[] };
            const embed = new EmbedBuilder()
              .setTitle(`🔎 Tavily results for “${arg}”`)
              .setFooter({ text: "Powered by Tavily" });
            for (const { title, url, snippet } of results) {
              embed.addFields({ name: title, value: `[Link](${url})\n${snippet}` });
            }
            if (isSendableChannel(channel))
              await (channel as TextChannel | NewsChannel | ThreadChannel | DMChannel).send({ embeds: [embed] });
            break;
          }

          /* ---------- /music ---------- */
          case "music": {
            // Split first blank line into prompt & lyrics
            const [prompt, ...rest] = arg.split(/\n\s*\n/);
            const lyrics = rest.join("\n").trim();

            try {
              const audio = await generateMusic({
                prompt: prompt.trim(),
                lyrics,
                format: (process.env.ACE_STEP_FORMAT ?? "mp3") as "mp3" | "wav" | "flac",
              });
              const parts = await chunkAudio(audio);

              // Discord: ≤10 attachments/message
              for (let idx = 0; idx < parts.length; idx += 10) {
                const slice = parts.slice(idx, idx + 10);
                if (isSendableChannel(channel))
                  await (channel as TextChannel | NewsChannel | ThreadChannel | DMChannel).send({
                    content: `🎶 Track segment ${idx / 10 + 1}/${Math.ceil(parts.length / 10)}`,
                    files: slice.map(p => ({ attachment: p })),
                  });
              }
            } catch (err) {
              console.error("ACE-Step error:", err);
              if (isSendableChannel(channel))
                await (channel as TextChannel | NewsChannel | ThreadChannel | DMChannel).send(
                  "🚨 Unable to generate music – is ACE-Step running?",
                );
            }
            break;
          }

          /* ---------- unknown ---------- */
          default:
            if (isSendableChannel(channel))
              await (channel as TextChannel | NewsChannel | ThreadChannel | DMChannel).send(
                `❌ Unknown tool \`/${cmd}\``,
              );
        }
      } catch (err) {
        console.error("Tool router error:", err);
        if (isSendableChannel(channel))
          await (channel as TextChannel | NewsChannel | ThreadChannel | DMChannel).send(
            "🚨 Error while running that tool call.",
          );
      }
    }),
  );

  return true;
}
