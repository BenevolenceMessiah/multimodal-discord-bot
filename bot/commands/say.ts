import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { generateText } from "../services/llm.js";
import { pushMessage } from "../services/context.js";

export const data = new SlashCommandBuilder()
  .setName("say")
  .setDescription("Force the LLM to reply")
  .addStringOption((o) => o.setName("prompt").setDescription("Prompt").setRequired(true));

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();
  const prompt = interaction.options.getString("prompt", true);
  const context = `${prompt}\n${interaction.user.username}: ${prompt}`;
  const reply = await generateText(context);
  pushMessage(interaction.channelId, `Bot: ${reply}`);
  await interaction.editReply(reply);
}