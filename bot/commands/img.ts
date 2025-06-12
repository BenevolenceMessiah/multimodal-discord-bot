import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  RESTJSONErrorCodes,
  AttachmentBuilder,
} from "discord.js";
import { generateImage } from "../services/image.js";

/* ─── Slash-command definition ───────────────────────────────────────────── */
export const data = new SlashCommandBuilder()
  .setName("img")
  .setDescription("Generate an image with Stable Diffusion Forge")
  .addStringOption((o) =>
    o.setName("prompt").setDescription("Image prompt").setRequired(true),
  );

/* ─── Command handler ────────────────────────────────────────────────────── */
export async function execute(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  /* Acknowledge the interaction: opens a 15-min token window. */
  await interaction.deferReply();

  const prompt = interaction.options.getString("prompt", true);

  /* 1 Ensure we have a channel that supports .send() */
  const chan = interaction.channel;
  if (!chan?.isSendable()) {
    await interaction.editReply("❌ I can’t post images in this channel.");
    return;
  }
  const sendToChannel = chan.send.bind(chan);

  /* 2 Generate the image */
  let img: AttachmentBuilder;
  try {
    img = await generateImage(prompt);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unknown error while generating.";
    await interaction.editReply(`❌ ${message}`);
    return;
  }

  /* 3 Deliver the result */
  try {
    await interaction.editReply({
      files: [img],
    });
  } catch (err: any) {
    /* 50027 → interaction token expired: fall back to a normal message */
    if (err?.code === RESTJSONErrorCodes.InvalidWebhookToken) {
      await sendToChannel({
        content: `**Image for "${prompt}"**`,
        files: [img],
      });
    } else {
      throw err;
    }
  }
}