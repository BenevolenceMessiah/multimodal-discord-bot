import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { smartSearch } from '../services/search.js';

export const data = new SlashCommandBuilder()
  .setName('web')
  .setDescription('Run a Tavily web search')
  .addStringOption(o => o.setName('prompt').setDescription('Search topic').setRequired(true));

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();
  const prompt = interaction.options.getString('prompt', true);
  try {
    const results = await smartSearch(prompt);
    await interaction.editReply(results);
  } catch (err:any) {
    await interaction.editReply(`❌ ${err.message}`);
  }
}