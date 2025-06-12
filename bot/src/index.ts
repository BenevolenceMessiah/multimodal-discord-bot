/* ────────────────────────────── index.ts ──────────────────────────────
 * Discord bot main entry-point
 * ------------------------------------------------------------------- */

import "dotenv/config";
import {
  Client,
  GatewayIntentBits,
  Partials,
  Collection,
  REST,
  Routes,
  ChatInputCommandInteraction,
  TextBasedChannel
} from "discord.js";
import { logger } from "./utils/logger.js";
import { config } from "./config.js";

/* Context / memory ---------------------------------------------------- */
import { pushMessage as pushToMemory } from "../services/context.js";
import { pushMessage, getContext } from "../services/cache.js";

/* Utilities ----------------------------------------------------------- */
import { withTyping, splitMessage } from "./utils/messageUtils.js";
import { tryHandleToolCall } from "./utils/toolCallRouter.js";

/* Slash-command registrations ---------------------------------------- */
import { data as imgData, execute as imgExec }   from "../commands/img.js";
import { data as sayData, execute as sayExec }   from "../commands/say.js";
import { data as webData, execute as webExec }   from "../commands/web.js";
import { data as threadData, execute as threadExec }
  from "../commands/thread.js";
import {
  data as threadPrivData, execute as threadPrivExec
} from "../commands/threadPrivate.js";
import { data as clearData,  execute as clearExec } from "../commands/clear.js";

/* Services ----------------------------------------------------------- */
import { logInteraction } from "../services/db.js";
import { generateText }    from "../services/llm.js";

type CmdHandler = (i: ChatInputCommandInteraction) => Promise<void>;

const commands = [
  imgData, sayData, webData, threadData, threadPrivData, clearData
];

const handlers = new Collection<string, CmdHandler>([
  ["img",   imgExec],
  ["say",   sayExec],
  ["web",   webExec],
  ["thread",          threadExec],
  ["thread-private",  threadPrivExec],
  ["clear", clearExec]
]);

/* ─── Client bootstrap ──────────────────────────────────────────────── */
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.DirectMessages
  ],
  partials: [Partials.Channel]
});

client.once("ready", () =>
  client.user
    ? logger.info(`Logged in as ${client.user.tag}`)
    : logger.error("Client user is null on ready event.")
);

/* ───────────────────────── helper functions ────────────────────────── */

/** Escape regex meta-characters in a string. */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Strip internal thought-process and any
 * “BotName: …” prefix from an LLM response.
 */
function extractResponseContent(full: string, botName: string): string {
  const START = "<final_response>";
  const END   = "</final_response>";

  const raw =
    full.includes(START) && full.includes(END) && full.indexOf(START) < full.indexOf(END)
      ? full.slice(full.indexOf(START) + START.length, full.indexOf(END))
      : full;

  return raw.replace(new RegExp(`^${escapeRegex(botName)}:\\s*`, "i"), "").trim();
}

/* ───────────────────── slash-command dispatcher ────────────────────── */

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const start   = Date.now();
  const handler = handlers.get(interaction.commandName);

  if (!handler) {
    logger.warn(`No handler for /${interaction.commandName}`);
    const payload = { content: "❌ Unknown command." };
    try {
      interaction.replied || interaction.deferred
        ? await interaction.editReply(payload)
        : await interaction.reply({ ...payload, ephemeral: true });
    } catch (e) { logger.error(`Unknown-cmd reply failed: ${e}`); }
    return;
  }

  try {
    await handler(interaction);
    if (config.postgres?.enabled) {
      await logInteraction(
        interaction.guildId ?? "dm",
        interaction.user.id,
        interaction.commandName,
        Date.now() - start
      );
    }
  } catch (err: any) {
    logger.error(`Error in /${interaction.commandName}: ${err.message ?? err}`);
    const payload = { content: "❌ Error executing command." };
    interaction.replied || interaction.deferred
      ? await interaction.editReply(payload).catch(e => logger.error(`Edit-reply fail: ${e}`))
      : await interaction.reply({ ...payload, ephemeral: true })
          .catch(e => logger.error(`Reply-on-error fail: ${e}`));
  }
});

/* ───────────────────────────── message router ───────────────────────── */

client.on("messageCreate", async (msg) => {
  if (msg.author.bot) return;                          // ignore bots

  /* Top-level tool call detection (user commands) */
  if (await tryHandleToolCall(msg.content, msg.channel)) return;

  if (!client.user) return;
  const botUser = client.user!;

  const isDM      = !msg.guild;
  const mentioned = msg.mentions.has(botUser.id);
  const wakeWordUsed = Array.isArray(config.wakeWords)
    ? config.wakeWords.some(w => msg.content.toLowerCase().includes(w.toLowerCase()))
    : msg.content.toLowerCase().includes(String(config.wakeWords).toLowerCase());

  if (!isDM && !mentioned && !wakeWordUsed) return;

  /* ── Clean prompt ─────────────────────────────────────────────────── */
  let userPrompt = msg.content;

  if (mentioned)
    userPrompt = userPrompt.replace(new RegExp(`<@!?${botUser.id}>`, "g"), "").trim();

  if (wakeWordUsed && !isDM) {
    const pattern = Array.isArray(config.wakeWords)
      ? config.wakeWords.map(w => `(^|\\s)${w}(\\s|$)`).join("|")
      : `(^|\\s)${config.wakeWords}(\\s|$)`;
    userPrompt = userPrompt.replace(new RegExp(pattern, "gi"), " ").trim();
  }

  if (!userPrompt && msg.attachments.size > 0) userPrompt = "[Attachment content]";
  if (!userPrompt) {
    logger.info(`Empty prompt from ${msg.author.tag}.`);
    if (isDM || mentioned)
      await msg.reply("How can I help you?")
        .catch(e => logger.error(`Default-reply fail: ${e}`));
    return;
  }

  /* ── Generate & send response with typing indicator ──────────────── */
  try {
    await withTyping(msg.channel as TextBasedChannel, async () => {
      /* 1️⃣  store user prompt */
      config.redis?.enabled
        ? await pushMessage(msg.channelId, msg.author.username, userPrompt)
        : pushToMemory   (msg.channelId, msg.author.username, userPrompt);

      /* 2️⃣  get context */
      const context = await getContext(msg.channelId);

      logger.info(
        `LLM > ${msg.author.tag} | prompt "${userPrompt}" `
        + `(${context.split("\n").length} ctx lines)`
      );

      /* 3️⃣  generate LLM response */
      const full = await generateText(context); // Removed channel param

      /* 4️⃣  handle nested tool calls */
      const containsToolCalls = await tryHandleToolCall(full, msg.channel);
      
      /* 5️⃣  process and send text response */
      const clean = extractResponseContent(full, botUser.username);

      if (clean) {
        /* Persist bot reply */
        config.redis?.enabled
          ? await pushMessage(msg.channelId, botUser.username, clean)
          : pushToMemory   (msg.channelId, botUser.username, clean);

        /* Format and send text */
        const outgoing = config.hideThoughtProcess
          ? `${botUser.username}: ${clean}`
          : full;

        // Add visual separator when tools were used
        if (containsToolCalls) {
          await msg.channel.send("🎨 *Tool execution complete! Here's your text response:*");
        }
        
        const chunks = splitMessage(outgoing, 1_800);
        await msg.reply(chunks[0]);
        for (const extra of chunks.slice(1)) await msg.channel.send(extra);
      } else {
        logger.warn(`Empty LLM reply for prompt: "${userPrompt}"`);
        await msg.reply("I couldn't come up with a response for that.");
      }
    });
  } catch (err: any) {
    logger.error(`Message handler error: ${err.message ?? err}`);
    await msg.reply(
      "Sorry, I hit a snag while responding. Please try again shortly."
    ).catch(e => logger.error(`Fail sending error-reply: ${e}`));
  }
});

/* ─────────────────── slash-command registration & login ────────────── */

(async () => {
  if (!process.env.DISCORD_TOKEN || !process.env.CLIENT_ID) {
    logger.error("Missing DISCORD_TOKEN or CLIENT_ID env vars");
    process.exit(1);
  }

  const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);

  try {
    logger.info("Refreshing application commands…");
    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: commands.map(c => c.toJSON()) }
    );
    logger.info("Application commands reloaded.");
  } catch (err) {
    logger.error("Command refresh failed:", err);
  }

  try { await client.login(process.env.DISCORD_TOKEN); }
  catch (err) {
    logger.error("Discord login failed:", err);
    process.exit(1);
  }
})();