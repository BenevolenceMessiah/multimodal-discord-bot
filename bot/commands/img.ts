import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { generateImage } from "../services/image.js";

export const data = new SlashCommandBuilder()
  .setName("img")
  .setDescription("Generate an image with Stable Diffusion Forge")
  .addStringOption((o) =>
    o.setName("prompt").setDescription("Image prompt").setRequired(true)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();
  const prompt = interaction.options.getString("prompt", true);
  try {
    const img = await generateImage(prompt);
    await interaction.editReply({ files: [{ attachment: img, name: "image.png" }] });
  } catch (error: any) {
    console.error("Error generating image:", error); // Log the actual error
    await interaction.editReply({ content: `❌ Failed to generate image: ${error.message}` });
  }
}