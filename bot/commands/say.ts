import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";

export const data = new SlashCommandBuilder()
  .setName("say")
  .setDescription("Echoes your input.")
  .addStringOption((o) => o.setName("prompt").setDescription("The text to echo").setRequired(true));

export async function execute(interaction: ChatInputCommandInteraction) {
  const userInput = interaction.options.getString("prompt", true);
  
  // Defer reply to acknowledge the command immediately.
  // For a simple echo, defer might be overkill, but good practice if there's any processing.
  // If it's truly instant, interaction.reply() directly would also be fine.
  await interaction.deferReply(); 
  
  // Edit the reply with the user's input.
  await interaction.editReply(userInput); 
}