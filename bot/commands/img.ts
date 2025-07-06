import {
  AttachmentBuilder,
  ChatInputCommandInteraction,
  RESTJSONErrorCodes,
  SlashCommandBuilder,
  TextBasedChannel,
} from "discord.js";
import { generateImage } from "../services/image.js";
import { logger } from "../src/utils/logger.js";

const DEFAULT_LORA_WEIGHT = 1;

/* ─── Slash-command definition ─────────────────────────────────────── */
export const data = new SlashCommandBuilder()
  .setName("img")
  .setDescription("Generate an image with Stable Diffusion Forge")
  .addStringOption((o) =>
    o.setName("prompt").setDescription("Image prompt").setRequired(true),
  )
  .addStringOption((o) =>
    o
      .setName("lora")
      .setDescription("LoRA(s)—comma or space separated")
      .setAutocomplete(true),
  );

/* ─── Helpers ──────────────────────────────────────────────────────── */

/** Channel narrow for .sendTyping() */
function isTypingChannel(
  c: TextBasedChannel | null,
): c is TextBasedChannel & { sendTyping(): Promise<void> } {
  return !!c && "sendTyping" in c;
}

/** Build `<lora:foo:1>` tags */
function buildLoraTags(names: string[]): string {
  return [...new Set(names)] // dedupe
    .map((n) => `<lora:${n}:${DEFAULT_LORA_WEIGHT}>`)
    .join(" ");
}

/** Extract LoRA names from prompt (`--lora …` OR `lora:"…"`), return clean prompt */
function extractInlineLoras(
  text: string,
): { prompt: string; loras: string[] } {
  const names: string[] = [];
  let out = text;

  /* --lora foo bar,baz */
  const flag = /--lora\s+([\w\-.,\s]+)/i.exec(out);
  if (flag) {
    names.push(...flag[1].split(/[\s,]+/).filter(Boolean));
    out = out.replace(flag[0], " ");
  }

  /* lora:"foo bar,baz"  OR  lora:'foo' */
  const quoted = /lora:\s*(['"])([^'"]+)\1/gi;
  out = out.replace(quoted, (_m, _q, inner) => {
    names.push(...inner.split(/[\s,]+/).filter(Boolean));
    return " ";
  });

  return { prompt: out.trim(), loras: names };
}

/* ─── Command handler ──────────────────────────────────────────────── */
export async function execute(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  await interaction.deferReply(); // 15-min window

  let rawPrompt = interaction.options.getString("prompt", true);
  const optionLora = interaction.options.getString("lora") ?? "";

  /* 1️⃣ inline LoRA extraction */
  const { prompt: cleanedPrompt, loras: inline } = extractInlineLoras(rawPrompt);
  const optionNames = optionLora.split(/[\s,]+/).filter(Boolean);
  const loraNames = [...new Set([...inline, ...optionNames])];

  const finalPrompt =
    loraNames.length > 0
      ? `${cleanedPrompt} ${buildLoraTags(loraNames)}`
      : cleanedPrompt;

  /* 2️⃣ ensure channel is sendable */
  const chan = interaction.channel;
  if (!chan?.isSendable()) {
    await interaction.editReply("❌ I can’t post images in this channel.");
    return;
  }
  const sendToChannel = chan.send.bind(chan);

  /* 3️⃣ typing indicator */
  if (isTypingChannel(chan))
    chan.sendTyping().catch((e: Error) =>
      logger.warn(`sendTyping failed: ${e.message}`),
    );

  /* 4️⃣ generate image */
  let img: AttachmentBuilder;
  try {
    img = await generateImage(finalPrompt); // unchanged service
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error.";
    await interaction.editReply(`❌ ${msg}`);
    return;
  }

  /* 5️⃣ deliver */
  try {
    await interaction.editReply({ files: [img] });
  } catch (err: any) {
    if (err?.code === RESTJSONErrorCodes.InvalidWebhookToken) {
      await sendToChannel({
        content: `**Image for "${cleanedPrompt}"**`,
        files: [img],
      });
    } else throw err;
  }
}
