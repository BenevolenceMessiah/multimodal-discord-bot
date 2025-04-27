import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { clearContext } from "../services/context.js";

export const data = new SlashCommandBuilder()
  .setName("clear")
  .setDescription("Forget everything in this channel");

export async function execute(interaction: ChatInputCommandInteraction) {
  clearContext(interaction.channelId);
  await interaction.reply("🔄 Memory cleared for this channel.");
}