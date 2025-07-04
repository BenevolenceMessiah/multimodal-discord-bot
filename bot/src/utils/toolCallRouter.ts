/****************************************************************************************
 * toolCallRouter.ts – routes “/img”, “/web”, and “/music” tool-calls issued by the LLM,
 *                    then streams results back to Discord. Strictly typed, lint-clean,
 *                    and guard-protected. Includes 2 000-char chunking for long /web
 *                    replies to avoid Discord “Invalid Form Body”.
 ****************************************************************************************/

import {
  TextBasedChannel,
  TextChannel,
  NewsChannel,
  ThreadChannel,
  DMChannel,
  AttachmentBuilder,
} from "discord.js";
import fetch from "node-fetch";

import { generateImage }  from "../../services/image.js";
import { generateMusic }  from "../../services/ace.js";
import { chunkAudio }     from "../../src/utils/audio.js";
import { logger }         from "../../src/utils/logger.js";
import { config }         from "../config.js";

/* ───────────────────────── typing-indicator helper ────────────────────────── */
export async function withTyping(
  channel: TextBasedChannel | null,
  fn: () => Promise<void>,
): Promise<void> {
  if (
    channel &&
    "sendTyping" in channel &&
    typeof (channel as any).sendTyping === "function"
  ) {
    (channel as TextChannel | DMChannel | NewsChannel | ThreadChannel)
      .sendTyping()
      .catch((e: unknown) =>
        logger.warn(`sendTyping failed: ${(e as NodeJS.ErrnoException).code ?? (e as Error).message}`),
      );
  }    
  await fn(); // always run the actual tool
}

/* ─────────────────────────── utils & shared types ─────────────────────────── */
type ToolCall = { cmd: string; arg: string };

/** sub-union of TextBasedChannel that actually has `.send()` */
type SendableChannel = Extract<TextBasedChannel, { send: (...a: any[]) => any }>;

interface TavilyHit {
  title: string;
  url: string;
  content: string;
}

/** Regex consumed by other helpers – must stay exported. */
export const TOOL_CALL_RE =
  /(?:^|\n)\s*(?:tool\s*call|toolcall)\s*:\s*\/(\w+)\s+([^\n]+)/gim;

const WRAPPERS: Record<string, string> = {
  '"': '"', "'": "'", "(": ")", "[": "]", "{": "}", "`": "`",
};
const stripWrapper = (raw: string) => {
  const t = raw.trim();
  const w = WRAPPERS[t[0] as keyof typeof WRAPPERS];
  return w && t.endsWith(w) ? t.slice(1, -1).trim() : t;
};

/** guard that removes TS2339 linting around `.send()` */
const isSendable = (c: TextBasedChannel | null): c is SendableChannel =>
  !!c && "send" in c && typeof (c as any).send === "function";

/** send long text in ≤2 000-char chunks with a small pause to dodge rate-limit */
async function sendChunked(ch: SendableChannel, text: string) {
  const CHUNK = 1_990;                                   // ≤2 000 incl. ellipsis if added
  const parts = text.match(new RegExp(`.{1,${CHUNK}}`, "gs")) ?? [];
  for (let i = 0; i < parts.length; i++) {
    await ch.send(parts[i] + (i < parts.length - 1 ? " …" : ""));
    if (parts.length > 1) await new Promise(r => setTimeout(r, 1_500));
  }
}

/* ───────────────────────────── main router ───────────────────────────── */
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
          /* ───────────── /img – Stable Diffusion Forge ───────────── */
          case "img": {
            const img = await generateImage(arg);               // returns AttachmentBuilder
            if (isSendable(channel))
              await channel.send({
                content: `🖼️ **Generated:** ${arg}`,
                files  : [img as AttachmentBuilder],
              });
            break;
          }

          /* ───────────── /web – Tavily Search (POST + fallback) ───────────── */
          case "web": {
            const key = process.env.TAVILY_KEY;
            if (!key) {
              if (isSendable(channel))
                await channel.send("⚠️ Tavily key missing – set `TAVILY_KEY`.");
              return;
            }

            const body = { query: arg, max_results: 8, include_answer: true };
            let res = await fetch("https://api.tavily.com/search", {
              method : "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
              body   : JSON.stringify(body),
            });

            /* legacy GET fallback for older keys that reject POST/Bearer */
            if (res.status === 401) {
              const url = `https://api.tavily.com/search?api_key=${key}&query=${encodeURIComponent(arg)}&max_results=8&include_answer=true`;
              res = await fetch(url);
            }
            if (!res.ok) throw new Error(`Tavily error: ${res.status}`);

            const { answer = "", results = [] } =
              (await res.json()) as { answer?: string; results: TavilyHit[] };

            if (!config.summarizeSearch && isSendable(channel)) {
              const lines: string[] = answer ? [`**Answer** → ${answer}`] : [];
              for (const { title, url, content } of results) {
                lines.push(`• **${title}** – ${content.slice(0, 140).trim()}…\n${url}`);
              }
              await sendChunked(channel, lines.join("\n\n"));
            }
            break;
          }

          /* ───────────── /music – ACE-Step generation ───────────── */
          case "music": {
            const [prompt, ...rest] = arg.split(/\n\s*\n/);
            const audio = await generateMusic({
              prompt: prompt.trim(),
              lyrics: rest.join("\n").trim(),
              format: (process.env.ACE_STEP_FORMAT ?? "mp3") as "mp3" | "wav" | "flac",
            });

            const parts = await chunkAudio(audio);               // Buffer[]
            for (let i = 0; i < parts.length; i += 10) {
              if (isSendable(channel))
                await channel.send({
                  content: `🎶 Track segment ${i / 10 + 1}/${Math.ceil(parts.length / 10)}`,
                  files  : parts
                             .slice(i, i + 10)
                             .map((buf, idx) => new AttachmentBuilder(buf, { name: `segment_${i + idx}.mp3` })),
                });
            }
            break;
          }

          /* ───────────── unknown tool ───────────── */
          default:
            if (isSendable(channel))
              await channel.send(`❌ Unknown tool \`/${cmd}\``);
        }
      } catch (err) {
        logger.error("Tool router error:", err);
        if (isSendable(channel))
          await channel.send("🚨 Error while running that tool call.");
      }
    }),
  );

  return true;
}
